import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateSession } from './proxy'

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return {
    getUser: vi.fn(),
    from: vi.fn(() => ({ select })),
    select,
    eq,
    maybeSingle,
  }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}))

type SetAll = (
  cookies: { name: string; value: string; options: object }[],
  headers: Record<string, string>,
) => void

// What @supabase/ssr does when it refreshes the session: it calls setAll.
function refreshSession(...calls: Parameters<SetAll>[]) {
  const [, , options] = vi.mocked(createServerClient).mock.calls[0]!
  const { setAll } = options!.cookies as { setAll: SetAll }
  for (const call of calls) setAll(...call)
}

const cacheHeaders = { 'Cache-Control': 'private, no-cache, no-store', Expires: '0' }
const newToken = { name: 'sb-test-auth-token', value: 'new', options: { path: '/' } }

function request(path = '/seeker') {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie: 'sb-test-auth-token=old' },
  })
}

function signedInAs(role: string | null, userMetadata: object = {}) {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', user_metadata: userMetadata } },
  })
  mocks.maybeSingle.mockResolvedValue({ data: role ? { role } : null })
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    mocks.getUser.mockResolvedValue({ data: { user: null } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the project URL and the publishable key, and reads the request cookies', async () => {
    await updateSession(request())

    const [url, key, options] = vi.mocked(createServerClient).mock.calls[0]!
    expect([url, key]).toEqual(['http://127.0.0.1:54321', 'sb_publishable_test'])
    const { getAll } = options!.cookies as { getAll: () => unknown }
    expect(getAll()).toEqual([{ name: 'sb-test-auth-token', value: 'old' }])
  })

  it('has no role and queries nothing when signed out', async () => {
    const session = await updateSession(request())

    expect(session.role).toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("reads the role from the user's own profiles row", async () => {
    signedInAs('host')

    const session = await updateSession(request())

    expect(session.role).toBe('host')
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.select).toHaveBeenCalledWith('role')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('ignores a role written into user_metadata', async () => {
    signedInAs('seeker', { role: 'admin' })

    expect((await updateSession(request())).role).toBe('seeker')
  })

  it('has no role when the profile cannot be read', async () => {
    signedInAs(null)

    expect((await updateSession(request())).role).toBeNull()
  })

  it('passes no cookies on when the session did not change', async () => {
    const response = (await updateSession(request())).next()

    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('gives a refreshed session to the page and to the browser', async () => {
    const req = request()
    mocks.getUser.mockImplementation(async () => {
      refreshSession([[newToken], cacheHeaders])
      return { data: { user: null } }
    })

    const response = (await updateSession(req)).next()

    expect(req.cookies.get('sb-test-auth-token')?.value).toBe('new')
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'sb-test-auth-token=new',
    )
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('new')
    expect(response.headers.get('cache-control')).toBe(cacheHeaders['Cache-Control'])
  })

  it('keeps the refreshed session on a redirect', async () => {
    mocks.getUser.mockImplementation(async () => {
      refreshSession([[newToken], cacheHeaders])
      return { data: { user: null } }
    })

    const response = (await updateSession(request('/host'))).redirect('/seeker')

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/seeker')
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('new')
    expect(response.headers.get('cache-control')).toBe(cacheHeaders['Cache-Control'])
    expect(response.headers.get('expires')).toBe('0')
  })

  it('keeps the cache headers and every cookie when setAll runs twice', async () => {
    mocks.getUser.mockImplementation(async () => {
      refreshSession(
        [[newToken], cacheHeaders],
        [[{ name: 'sb-test-auth-token.1', value: 'more', options: {} }], {}],
      )
      return { data: { user: null } }
    })

    const response = (await updateSession(request())).next()

    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('new')
    expect(response.cookies.get('sb-test-auth-token.1')?.value).toBe('more')
    expect(response.headers.get('cache-control')).toBe(cacheHeaders['Cache-Control'])
  })

  it('fails with a clear message when the environment is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')

    await expect(updateSession(request())).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
