'use server'

// Server Actions for /login and /register, and signOut for the portals' Log out
// buttons (STORY-03 design §1, D-010). The forms check their input in the
// browser; these check it again, because a request can skip the browser.
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { dashboardFor, landingPathFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, registerSchema } from '@/lib/validation/auth'

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

  // The role comes from profiles, never user_metadata (STORY-03 design §2).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile) {
    await supabase.auth.signOut({ scope: 'local' })
    return { formError: 'We could not load your account. Please try again.', values }
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

  const { fullName, email, password, role } = parsed.data
  const origin = (await headers()).get('origin')
  const supabase = await createClient()
  // The sign-up trigger creates the profile from this metadata, and refuses any
  // role but seeker or host (STORY-01).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: origin ? `${origin}/api/auth/callback` : undefined,
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

  redirect(dashboardFor(role))
}

export async function signOut() {
  const supabase = await createClient()
  // Only this session: the team shares test accounts, and the default, 'global',
  // would sign every teammate out of the same account.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/')
}
