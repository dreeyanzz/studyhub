import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({
  auth: { exchangeCodeForSession: vi.fn() },
  from: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

import { GET } from './route'

function profileRole(role: string | null) {
  supabase.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
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
})
