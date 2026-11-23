import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ register: vi.fn() }))

import RegisterPage from './page'

async function checkedRoles(search: Record<string, string>) {
  const html = renderToStaticMarkup(
    await RegisterPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(search),
    }),
  )
  return [...html.matchAll(/<input[^>]*name="role"[^>]*>/g)]
    .filter(([input]) => /\schecked=""/.test(input))
    .map(([input]) => input.match(/value="([^"]+)"/)?.[1])
}

describe('/register role preselection (STORY-03)', () => {
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
})
