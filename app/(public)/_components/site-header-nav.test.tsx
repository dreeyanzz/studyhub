import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/client'
import { SiteHeaderNavView, fetchHeaderViewer } from './site-header-nav'

function mockSupabaseClient({
  hasSession = true,
  user,
  profile,
}: {
  hasSession?: boolean
  user: { id: string; email?: string } | null
  profile: {
    full_name: string | null
    role: 'seeker' | 'host' | 'admin'
    role_confirmed: boolean
  } | null
}) {
  const getUser = vi.fn(async () => ({ data: { user }, error: null }))
  const getSession = vi.fn(async () => ({
    data: { session: hasSession ? { user } : null },
    error: null,
  }))
  return {
    getUser,
    client: {
      auth: { getSession, getUser },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createClient>,
  }
}

describe('fetchHeaderViewer', () => {
  it('short-circuits to guest without calling getUser when no local session exists', async () => {
    const { client, getUser } = mockSupabaseClient({
      hasSession: false,
      user: null,
      profile: null,
    })
    await expect(fetchHeaderViewer(client)).resolves.toEqual({ status: 'guest' })
    expect(getUser).not.toHaveBeenCalled()
  })

  it('returns guest when session exists locally but getUser returns null', async () => {
    const { client } = mockSupabaseClient({ user: null, profile: null })
    await expect(fetchHeaderViewer(client)).resolves.toEqual({ status: 'guest' })
  })

  it('returns guest when the user has no profiles row', async () => {
    const { client } = mockSupabaseClient({
      user: { id: 'u1', email: 'orphan@example.test' },
      profile: null,
    })
    await expect(fetchHeaderViewer(client)).resolves.toEqual({ status: 'guest' })
  })

  it('returns unconfirmed when role_confirmed is false', async () => {
    const { client } = mockSupabaseClient({
      user: { id: 'u2', email: 'new@example.test' },
      profile: { full_name: 'New User', role: 'seeker', role_confirmed: false },
    })
    await expect(fetchHeaderViewer(client)).resolves.toEqual({ status: 'unconfirmed' })
  })

  it('returns confirmed with role and display name from profiles', async () => {
    const { client } = mockSupabaseClient({
      user: { id: 'u3', email: 'seeker@example.test' },
      profile: { full_name: 'Maria Clara', role: 'seeker', role_confirmed: true },
    })
    await expect(fetchHeaderViewer(client)).resolves.toEqual({
      status: 'confirmed',
      role: 'seeker',
      displayName: 'Maria Clara',
    })
  })
})

describe('SiteHeaderNavView', () => {
  it('hides Log in and Sign up behind a decorative placeholder while loading', () => {
    const html = renderToStaticMarkup(
      <SiteHeaderNavView viewer={{ status: 'loading' }} pathname="/spaces" />,
    )

    expect(html).toContain('href="/spaces"')
    expect(html).toContain('href="/for-hosts"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('href="/login"')
    expect(html).not.toContain('href="/register"')
    expect(html).not.toContain('Log out')
  })

  it('shows Log in, Sign up, and For Hosts for guest visitors', () => {
    const html = renderToStaticMarkup(
      <SiteHeaderNavView viewer={{ status: 'guest' }} pathname="/" />,
    )

    expect(html).toContain('href="/spaces"')
    expect(html).toContain('href="/for-hosts"')
    expect(html).toContain('href="/login"')
    expect(html).toContain('Log in')
    expect(html).toContain('href="/register"')
    expect(html).toContain('Sign up')
    expect(html).not.toContain('Log out')
    expect(html).not.toContain('Dashboard')
  })

  it('shows Seeker links, badge, and Log out instead of Log in / Sign up on /spaces', () => {
    const html = renderToStaticMarkup(
      <SiteHeaderNavView
        viewer={{ status: 'confirmed', role: 'seeker', displayName: 'Maria Clara' }}
        pathname="/spaces"
      />,
    )

    expect(html).toContain('href="/seeker"')
    expect(html).toContain('Dashboard')
    expect(html).toContain('href="/seeker/reservations"')
    expect(html).toContain('My reservations')
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/spaces"/)
    expect(html).toContain('Maria Clara')
    expect(html).toContain('Seeker')
    expect(html).toContain('Log out')
    expect(html).not.toContain('href="/login"')
    expect(html).not.toContain('href="/register"')
  })

  it.each([
    ['host', '/host', 'Host'],
    ['admin', '/admin', 'Administrator'],
  ] as const)(
    'links Dashboard to %s and omits My reservations for %s',
    (role, expectedHref, expectedLabel) => {
      const html = renderToStaticMarkup(
        <SiteHeaderNavView
          viewer={{ status: 'confirmed', role, displayName: 'Jose Rizal' }}
          pathname="/spaces"
        />,
      )

      expect(html).toContain(`href="${expectedHref}"`)
      expect(html).toContain(expectedLabel)
      expect(html).toContain('Log out')
      expect(html).not.toContain('href="/seeker/reservations"')
      expect(html).not.toContain('href="/login"')
      expect(html).not.toContain('href="/register"')
    },
  )

  it('shows Finish sign-up and Log out for unconfirmed OAuth users', () => {
    const html = renderToStaticMarkup(
      <SiteHeaderNavView viewer={{ status: 'unconfirmed' }} pathname="/spaces" />,
    )

    expect(html).toContain('href="/choose-role"')
    expect(html).toContain('Finish sign-up')
    expect(html).toContain('Log out')
    expect(html).not.toContain('href="/login"')
    expect(html).not.toContain('href="/register"')
  })
})
