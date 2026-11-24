import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { Redirected, supabase } = vi.hoisted(() => {
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
    supabase: {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => ({ select })),
      _maybeSingle: maybeSingle,
    },
  }
})

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('../actions', () => ({ completeOAuthRole: vi.fn(), signOut: vi.fn() }))

import ChooseRolePage from './page'

async function renderPage(search: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await ChooseRolePage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(search),
    }),
  )
}

async function redirectTarget(search: Record<string, string> = {}) {
  try {
    await renderPage(search)
  } catch (error) {
    if (error instanceof Redirected) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'oauth-1', email: 'new-google@example.test' } },
  })
  supabase._maybeSingle.mockResolvedValue({
    data: { full_name: 'Mika Tan', role: 'seeker', role_confirmed: false },
    error: null,
  })
})

describe('/choose-role page (STORY-21, D-095)', () => {
  it('redirects a signed-out visitor to /login (G13)', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await redirectTarget()).toBe('/login')
  })

  it('redirects an already-confirmed user to their dashboard (G13)', async () => {
    supabase._maybeSingle.mockResolvedValue({
      data: { full_name: 'Hugo Santos', role: 'host', role_confirmed: true },
      error: null,
    })
    expect(await redirectTarget()).toBe('/host')
  })

  it('renders the signed-in email, pre-filled Full name, preselected role, and Log out button', async () => {
    const html = await renderPage({ role: 'host' })
    expect(html).toContain('Finish setting up your account')
    expect(html).toContain('new-google@example.test')
    expect(html).toContain('value="Mika Tan"')
    expect(html).toContain('Continue to Worq')
    expect(html).toContain('Log out and use a different account')

    const checked = [...html.matchAll(/<input[^>]*name="role"[^>]*>/g)]
      .filter(([input]) => /\schecked=""/.test(input))
      .map(([input]) => input.match(/value="([^"]+)"/)?.[1])
    expect(checked).toEqual(['host'])
  })

  it('ignores ?role=admin so Administrator is never offered or preselected (O-N9)', async () => {
    const html = await renderPage({ role: 'admin' })
    expect(html).not.toContain('value="admin"')
    const checked = [...html.matchAll(/<input[^>]*name="role"[^>]*>/g)].filter(
      ([input]) => /\schecked=""/.test(input),
    )
    expect(checked).toEqual([])
  })
})
