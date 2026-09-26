import { createServerClient } from '@supabase/ssr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from './server'

const cookieStore = {
  getAll: vi.fn(() => [{ name: 'sb-test-auth-token', value: 'session' }]),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({})) }))

// The cookie methods server.ts hands to @supabase/ssr.
function cookieMethods() {
  const [, , options] = vi.mocked(createServerClient).mock.calls[0]!
  const { getAll, setAll } = options!.cookies as {
    getAll: () => unknown
    setAll: (cookies: { name: string; value: string; options: object }[]) => void
  }
  return { getAll, setAll }
}

describe('createClient (server)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the project URL and the publishable key', async () => {
    await createClient()

    expect(createServerClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.anything(),
    )
  })

  it('reads the session from the request cookies', async () => {
    await createClient()

    expect(cookieMethods().getAll()).toEqual([
      { name: 'sb-test-auth-token', value: 'session' },
    ])
  })

  it('writes refreshed session cookies when the caller may set cookies', async () => {
    await createClient()
    cookieMethods().setAll([
      { name: 'sb-test-auth-token', value: 'new', options: { path: '/' } },
    ])

    expect(cookieStore.set).toHaveBeenCalledWith('sb-test-auth-token', 'new', {
      path: '/',
    })
  })

  it('does not throw when a Server Component cannot set cookies', async () => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.')
    })
    await createClient()

    expect(() =>
      cookieMethods().setAll([{ name: 'sb-test-auth-token', value: 'new', options: {} }]),
    ).not.toThrow()
  })

  it('fails with a clear message when the environment is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })
})
