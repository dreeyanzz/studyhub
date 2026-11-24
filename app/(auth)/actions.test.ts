import { beforeEach, describe, expect, it, vi } from 'vitest'

const { Redirected, supabase, mockHeaders } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return {
    Redirected,
    mockHeaders: vi.fn(async () => new Headers({ origin: 'http://localhost:3000' })),
    supabase: {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signInWithOAuth: vi.fn(),
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(() => ({ select })),
      rpc: vi.fn(),
      _select: select,
      _maybeSingle: maybeSingle,
    },
  }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { completeOAuthRole, login, register, signInWithGoogle } from './actions'

const back = '/spaces/e0000000-0000-4000-8000-000000000002'

function registerForm(returnUrl?: string) {
  const data = new FormData()
  const fields: Record<string, string> = {
    fullName: 'Rosa Villareal',
    email: 'new-seeker@example.test',
    password: 'SecurePassword1!',
    confirmPassword: 'SecurePassword1!',
    role: 'seeker',
  }
  if (returnUrl !== undefined) fields.returnUrl = returnUrl
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

function formOf(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

async function landing(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof Redirected) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHeaders.mockResolvedValue(new Headers({ origin: 'http://localhost:3000' }))
  supabase.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  })
  supabase.auth.signInWithOAuth.mockResolvedValue({
    data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1' },
    error: null,
  })
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'oauth-1' } } })
  supabase.rpc.mockResolvedValue({ data: { role: 'host' }, error: null })
  supabase._maybeSingle.mockResolvedValue({
    data: { role: 'seeker', role_confirmed: true },
    error: null,
  })
})

describe('register (STORY-03, D-058)', () => {
  it('lands a new Seeker on their dashboard', async () => {
    expect(await landing(register({}, registerForm()))).toBe('/seeker')
  })

  it("goes back to a hold prompt's Space profile, with no unit chosen", async () => {
    expect(await landing(register({}, registerForm(back)))).toBe(back)
  })

  it('keeps the returnUrl in the email confirmation link', async () => {
    await landing(register({}, registerForm(back)))
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: `http://localhost:3000/api/auth/callback?returnUrl=${encodeURIComponent(back)}`,
        }),
      }),
    )
  })

  it('drops a returnUrl that leaves the site', async () => {
    expect(await landing(register({}, registerForm('https://evil.example/')))).toBe(
      '/seeker',
    )
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost:3000/api/auth/callback',
        }),
      }),
    )
  })
})

describe('login role_confirmed check (STORY-21, D-095)', () => {
  it('routes an unconfirmed profile to /choose-role preserving returnUrl', async () => {
    supabase._maybeSingle.mockResolvedValue({
      data: { role: 'seeker', role_confirmed: false },
      error: null,
    })

    const url = await landing(
      login(
        {},
        formOf({
          email: 'oauth@example.test',
          password: 'Password1!',
          returnUrl: back,
        }),
      ),
    )

    expect(url).toBe(`/choose-role?returnUrl=${encodeURIComponent(back)}`)
  })
})

describe('signInWithGoogle (STORY-21, D-095)', () => {
  it('starts PKCE OAuth with prompt=select_account and preserves sanitized returnUrl, role, and source (G9)', async () => {
    const url = await landing(
      signInWithGoogle(
        {},
        formOf({
          source: '/register',
          returnUrl: back,
          role: 'host',
        }),
      ),
    )

    expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1')
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `http://localhost:3000/api/auth/callback?source=%2Fregister&returnUrl=${encodeURIComponent(back)}&role=host`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    })
  })

  it('drops unsafe returnUrl, invalid role=admin, and invalid source (O-N8, O-N9)', async () => {
    await landing(
      signInWithGoogle(
        {},
        formOf({
          source: '/evil',
          returnUrl: '//evil.example',
          role: 'admin',
        }),
      ),
    )

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/api/auth/callback',
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    })
  })

  it('returns a formError when signInWithOAuth fails (G1)', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: 'provider disabled' },
    })

    const state = await signInWithGoogle({}, formOf({ source: '/login' }))

    expect(state.formError).toMatch(/could not start Google sign-in/i)
  })
})

describe('completeOAuthRole (STORY-21, D-095)', () => {
  it('calls complete_oauth_role and redirects to the confirmed role dashboard or returnUrl (G7, G9)', async () => {
    const hostUrl = await landing(
      completeOAuthRole({}, formOf({ fullName: '  Mika Tan  ', role: 'host' })),
    )
    expect(supabase.rpc).toHaveBeenCalledWith('complete_oauth_role', {
      p_role: 'host',
      p_full_name: 'Mika Tan',
    })
    expect(hostUrl).toBe('/host')

    const seekerUrl = await landing(
      completeOAuthRole(
        {},
        formOf({ fullName: 'Mika Tan', role: 'seeker', returnUrl: back }),
      ),
    )
    expect(seekerUrl).toBe(back)
  })

  it('rejects role=admin and blank fullName before calling Postgres (O-N1, O-N11)', async () => {
    const adminResult = await completeOAuthRole(
      {},
      formOf({ fullName: 'Sneaky Admin', role: 'admin' }),
    )
    expect(adminResult.fieldErrors?.role?.[0]).toMatch(/Seeker or a Host/)

    const blankName = await completeOAuthRole(
      {},
      formOf({ fullName: '   ', role: 'seeker' }),
    )
    expect(blankName.fieldErrors?.fullName?.[0]).toBe('Full name is required')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('recovers from role_already_confirmed (stale second tab) by redirecting to the stored role dashboard (G8)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        hint: 'role_already_confirmed',
        message: 'Role already confirmed',
      },
    })
    supabase._maybeSingle.mockResolvedValue({ data: { role: 'host' }, error: null })

    const url = await landing(
      completeOAuthRole({}, formOf({ fullName: 'Mika Tan', role: 'seeker' })),
    )

    expect(url).toBe('/host')
  })

  it('redirects to /login when the session expired before submit', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const url = await landing(
      completeOAuthRole({}, formOf({ fullName: 'Mika Tan', role: 'seeker' })),
    )
    expect(url).toBe('/login')
  })
})
