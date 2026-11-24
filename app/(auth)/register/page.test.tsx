import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ register: vi.fn(), signInWithGoogle: vi.fn() }))

import RegisterPage from './page'

async function renderRegister(search: Record<string, string>) {
  return renderToStaticMarkup(
    await RegisterPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(search),
    }),
  )
}

async function checkedRoles(search: Record<string, string>) {
  const html = await renderRegister(search)
  return [...html.matchAll(/<input[^>]*name="role"[^>]*>/g)]
    .filter(([input]) => /\schecked=""/.test(input))
    .map(([input]) => input.match(/value="([^"]+)"/)?.[1])
}

describe('/register role preselection and Google OAuth (STORY-03, STORY-21)', () => {
  it('preselects Host for ?role=host, the landing page\'s "Become a Host"', async () => {
    expect(await checkedRoles({ role: 'host' })).toEqual(['host'])
  })

  it('still preselects Seeker for ?role=seeker, a hold prompt (D-058)', async () => {
    expect(await checkedRoles({ role: 'seeker' })).toEqual(['seeker'])
  })

  it('preselects nothing without a role, or for any other value (D-013)', async () => {
    expect(await checkedRoles({})).toEqual([])
    expect(await checkedRoles({ role: 'admin' })).toEqual([])
  })

  it('renders Continue with Google and shows OAuth cancellation and error notices', async () => {
    const cancelled = await renderRegister({ error: 'oauth-cancelled' })
    expect(cancelled).toContain('Continue with Google')
    expect(cancelled).toContain('Google sign-in was cancelled.')

    const failed = await renderRegister({ error: 'oauth' })
    expect(failed).toContain('We could not sign you in with Google.')
  })
})
