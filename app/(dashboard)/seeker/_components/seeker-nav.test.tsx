import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pathname = vi.hoisted(() => ({ current: '/seeker' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

import { SeekerNav, dashboardCurrent } from './seeker-nav'

describe('dashboardCurrent (STORY-17)', () => {
  it.each([
    ['/seeker', 'page'],
    ['/seeker/reservations/0b7e9a52-1c2d-4e3f-9a8b-7c6d5e4f3a2b', 'true'],
    ['/spaces', undefined],
    ['/seekers', undefined],
  ] as const)('marks %s as %s', (path, expected) => {
    expect(dashboardCurrent(path)).toBe(expected)
  })
})

describe('SeekerNav (STORY-17)', () => {
  beforeEach(() => {
    pathname.current = '/seeker'
  })

  it('is a labelled nav with Dashboard and Find a Space', () => {
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toContain('<nav aria-label="Seeker portal"')
    expect(html).toMatch(/<a[^>]*href="\/seeker"[^>]*>.*Dashboard<\/a>/)
    expect(html).toMatch(/<a[^>]*href="\/spaces"[^>]*>.*Find a Space<\/a>/)
  })

  it('marks Dashboard as the current page on /seeker', () => {
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toMatch(/<a[^>]*href="\/seeker"[^>]*aria-current="page"/)
  })

  it('keeps Find a Space reachable while the Seeker is on a hold page', () => {
    pathname.current = '/seeker/reservations/0b7e9a52-1c2d-4e3f-9a8b-7c6d5e4f3a2b'
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toMatch(/<a[^>]*href="\/seeker"[^>]*aria-current="true"/)
    expect(html).toContain('href="/spaces"')
  })
})
