'use server'

// Server Actions for /login, /register, /choose-role, Google OAuth initiation,
// and signOut for the portals' Log out buttons (STORY-03 design §1, STORY-21, D-010, D-095).
// The forms check their input in the browser; these check it again, because a
// request can skip the browser.
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { chooseRolePath, landingPathFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import {
  chooseRoleSchema,
  loginSchema,
  parseRegistrationRole,
  registerSchema,
  sanitizeAuthSource,
  sanitizeReturnUrl,
} from '@/lib/validation/auth'

export type AuthFormState = {
  fieldErrors?: Partial<Record<string, string[]>>
  formError?: string
  notice?: string
  // What the user typed, so the form can show it again. Never a password.
  values?: Partial<Record<'fullName' | 'email' | 'role', string>>
}

function textValues(formData: FormData, names: ('fullName' | 'email' | 'role')[]) {
  return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? '')]))
}

function resolveOrigin(hdrs: Headers): string | null {
  const origin = hdrs.get('origin')
  if (origin) return origin
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  if (!host) return null
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = textValues(formData, ['email'])
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    // The same message whether the email or the password was wrong.
    return error.code === 'invalid_credentials'
      ? { formError: 'Invalid email or password.', values }
      : { formError: 'We could not log you in. Please try again.', values }
  }

  // Role and role_confirmed come from profiles, never user_metadata (STORY-03 §2, D-095).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, role_confirmed')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile) {
    await supabase.auth.signOut({ scope: 'local' })
    return { formError: 'We could not load your account. Please try again.', values }
  }

  if (!profile.role_confirmed) {
    redirect(chooseRolePath(parsed.data.returnUrl))
  }

  redirect(landingPathFor(profile.role, parsed.data.returnUrl))
}

export async function register(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = textValues(formData, ['fullName', 'email', 'role'])
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { fullName, email, password, role, returnUrl } = parsed.data
  const origin = resolveOrigin(await headers())
  const supabase = await createClient()
  // The sign-up trigger creates the profile from this metadata, and refuses any
  // role but seeker or host (STORY-01).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      // The confirmation link keeps the returnUrl, so it lands there too (D-058).
      emailRedirectTo: origin
        ? `${origin}/api/auth/callback${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`
        : undefined,
    },
  })
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return {
        fieldErrors: {
          email: ['An account with this email already exists. Log in instead.'],
        },
        values,
      }
    }
    return { formError: 'We could not create your account. Please try again.', values }
  }

  // With email confirmation on, there is no session until the user follows the link.
  if (!data.session) {
    return { notice: 'Check your email for a link to confirm your account.', values }
  }

  redirect(landingPathFor(role, returnUrl))
}

export async function signInWithGoogle(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const source = sanitizeAuthSource(String(formData.get('source') ?? ''))
  const returnUrl = sanitizeReturnUrl(String(formData.get('returnUrl') ?? ''), '')
  const roleHint = parseRegistrationRole(String(formData.get('role') ?? ''))

  const origin = resolveOrigin(await headers())
  if (!origin) {
    return {
      formError:
        'We could not start Google sign-in. Try again, or use your email and password.',
    }
  }

  const callbackParams = new URLSearchParams()
  if (source === '/register') callbackParams.set('source', '/register')
  if (returnUrl) callbackParams.set('returnUrl', returnUrl)
  if (roleHint) callbackParams.set('role', roleHint)
  const query = callbackParams.toString()
  const redirectTo = `${origin}/api/auth/callback${query ? `?${query}` : ''}`

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data?.url) {
    return {
      formError:
        'We could not start Google sign-in. Try again, or use your email and password.',
    }
  }

  redirect(data.url)
}

export async function completeOAuthRole(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = textValues(formData, ['fullName', 'role'])
  const parsed = chooseRoleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { fullName, role, returnUrl } = parsed.data
  const { error } = await supabase.rpc('complete_oauth_role', {
    p_role: role,
    p_full_name: fullName,
  })

  if (error) {
    // Stale second tab or double submit after role is already confirmed (G8, D-095).
    if (
      error.hint === 'role_already_confirmed' ||
      error.message?.includes('Role already confirmed')
    ) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) {
        redirect(landingPathFor(profile.role, returnUrl))
      }
      redirect('/')
    }
    if (error.hint === 'invalid_full_name') {
      return {
        fieldErrors: { fullName: ['Full name must be between 1 and 100 characters'] },
        values,
      }
    }
    if (error.hint === 'invalid_role') {
      return {
        fieldErrors: { role: ['Please select whether you are a Seeker or a Host'] },
        values,
      }
    }
    return {
      formError: 'We could not finish setting up your account. Please try again.',
      values,
    }
  }

  redirect(landingPathFor(role, returnUrl))
}

export async function signOut() {
  const supabase = await createClient()
  // Only this session: the team shares test accounts, and the default, 'global',
  // would sign every teammate out of the same account.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/')
}
