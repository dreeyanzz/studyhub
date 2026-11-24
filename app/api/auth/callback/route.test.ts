import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({
  auth: { exchangeCodeForSession: vi.fn() },
  from: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { GET } from './route'

function profileRole(role: string | null, roleConfirmed = true) {
  supabase.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: role ? { role, role_confirmed: roleConfirmed } : null,
          error: null,
        }),
      }),
    }),
  })
}

async function landing(query: string) {
  const response = await GET(
    new NextRequest(`http://localhost:3000/api/auth/callback?${query}`),
  )
  return (
    new URL(response.headers.get('location')!).pathname +
    new URL(response.headers.get('location')!).search
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: 'new-seeker' } },
    error: null,
  })
})

describe('the auth callback (STORY-03, D-058)', () => {
  it('sends a confirmed account to its dashboard', async () => {
    profileRole('seeker')
    expect(await landing('code=abc')).toBe('/seeker')
  })

  it("goes back to a hold prompt's Space profile when the link carries it", async () => {
    profileRole('seeker')
    const back = '/spaces/e0000000-0000-4000-8000-000000000002'
    expect(await landing(`code=abc&returnUrl=${encodeURIComponent(back)}`)).toBe(back)
  })

  it('ignores a returnUrl that leaves the site', async () => {
    profileRole('seeker')
    expect(
      await landing(`code=abc&returnUrl=${encodeURIComponent('//evil.example')}`),
    ).toBe('/seeker')
  })

  it('sends a missing or failed code to log in', async () => {
    expect(await landing('')).toBe('/login?error=link')
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { code: 'bad' },
    })
    expect(await landing('code=expired')).toBe('/login?error=link')
  })

  it('returns a cancelled Google sign-in to its source page with returnUrl (G2)', async () => {
    const back = '/spaces/e0000000-0000-4000-8000-000000000002'
    expect(
      await landing(
        `error=access_denied&source=/register&returnUrl=${encodeURIComponent(back)}&role=host`,
      ),
    ).toBe(
      `/register?error=oauth-cancelled&returnUrl=${encodeURIComponent(back)}&role=host`,
    )
    expect(await landing('error=access_denied')).toBe('/login?error=oauth-cancelled')
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('returns an OAuth failure to its source page with error=oauth (G3)', async () => {
    expect(await landing('error=server_error&source=/login&returnUrl=%2Fhost')).toBe(
      '/login?error=oauth&returnUrl=%2Fhost',
    )
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('drops unsafe source, returnUrl, and role=admin on OAuth errors (O-N8, O-N9)', async () => {
    expect(
      await landing(
        'error=access_denied&source=/evil&returnUrl=//evil.example&role=admin',
      ),
    ).toBe('/login?error=oauth-cancelled')
  })

  it('sends a confirmed returning or linked account straight to its dashboard (G5)', async () => {
    profileRole('host', true)
    expect(await landing('code=abc')).toBe('/host')
    profileRole('admin', true)
    expect(await landing('code=abc')).toBe('/admin')
  })

  it('sends an unconfirmed Google OAuth user to /choose-role keeping safe returnUrl and role hint (G6, G9)', async () => {
    profileRole('seeker', false)
    const back = '/spaces/e0000000-0000-4000-8000-000000000002'
    expect(
      await landing(`code=abc&returnUrl=${encodeURIComponent(back)}&role=host`),
    ).toBe(`/choose-role?returnUrl=${encodeURIComponent(back)}&role=host`)
  })

  it('drops role=admin and unsafe returnUrl when redirecting to /choose-role (O-N8, O-N9)', async () => {
    profileRole('seeker', false)
    expect(await landing('code=abc&returnUrl=//evil.example&role=admin')).toBe(
      '/choose-role',
    )
  })

  it('falls back to / if the profile row is missing', async () => {
    profileRole(null)
    expect(await landing('code=abc')).toBe('/')
  })
})
