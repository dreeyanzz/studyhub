import { beforeEach, describe, expect, it, vi } from 'vitest'

const { Redirected, supabase } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  return { Redirected, supabase: { auth: { signUp: vi.fn() } } }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ origin: 'http://localhost:3000' })),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { register } from './actions'

const back = '/spaces/e0000000-0000-4000-8000-000000000002'

function form(returnUrl?: string) {
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
  supabase.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
})

describe('register (STORY-03, D-058)', () => {
  it('lands a new Seeker on their dashboard', async () => {
    expect(await landing(register({}, form()))).toBe('/seeker')
  })

  it("goes back to a hold prompt's Space profile, with no unit chosen", async () => {
    expect(await landing(register({}, form(back)))).toBe(back)
  })

  it('keeps the returnUrl in the email confirmation link', async () => {
    await landing(register({}, form(back)))
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: `http://localhost:3000/api/auth/callback?returnUrl=${encodeURIComponent(back)}`,
        }),
      }),
    )
  })

  it('drops a returnUrl that leaves the site', async () => {
    expect(await landing(register({}, form('https://evil.example/')))).toBe('/seeker')
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost:3000/api/auth/callback',
        }),
      }),
    )
  })
})
