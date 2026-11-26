import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pathname = vi.hoisted(() => ({ current: '/seeker' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

import { SeekerNav, dashboardCurrent, reservationsCurrent } from './seeker-nav'

const HOLD_PATH = '/seeker/reservations/0b7e9a52-1c2d-4e3f-9a8b-7c6d5e4f3a2b'

describe('dashboardCurrent (STORY-17)', () => {
  it.each([
    ['/seeker', 'page'],
    ['/seeker/profile', 'true'],
    ['/seeker/reservations', undefined],
    [HOLD_PATH, undefined],
    ['/spaces', undefined],
    ['/seekers', undefined],
  ] as const)('marks %s as %s', (path, expected) => {
    expect(dashboardCurrent(path)).toBe(expected)
  })
})

describe('reservationsCurrent (#433)', () => {
  it.each([
    ['/seeker/reservations', 'page'],
    [HOLD_PATH, 'true'],
    ['/seeker', undefined],
    ['/seeker/reservationsx', undefined],
    ['/spaces', undefined],
  ] as const)('marks %s as %s', (path, expected) => {
    expect(reservationsCurrent(path)).toBe(expected)
  })
})

describe('SeekerNav (STORY-17)', () => {
  beforeEach(() => {
    pathname.current = '/seeker'
  })

  it('is a labelled nav with Dashboard, My reservations and Find a Space', () => {
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toContain('<nav aria-label="Seeker portal"')
    expect(html).toMatch(/<a[^>]*href="\/seeker"[^>]*>.*Dashboard<\/a>/)
    expect(html).toMatch(
      /<a[^>]*href="\/seeker\/reservations"[^>]*>.*My reservations<\/a>/,
    )
    expect(html).toMatch(/<a[^>]*href="\/spaces"[^>]*>.*Find a Space<\/a>/)
  })

  it('gives every link a 48 x 48 px target (SRS §3.2.2)', () => {
    const links = renderToStaticMarkup(<SeekerNav />).match(/<a\b[^>]*>/g) ?? []

    expect(links).toHaveLength(3)
    for (const link of links) {
      expect(link).toContain('min-h-12')
      expect(link).toContain('min-w-12')
    }
  })

  it('marks Dashboard as the current page on /seeker, and only Dashboard', () => {
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/seeker"/)
    expect(html).not.toMatch(
      /<a[^>]*aria-current="[^"]*"[^>]*href="\/seeker\/reservations"/,
    )
  })

  it('marks My reservations as the current page on /seeker/reservations, not Dashboard (#433)', () => {
    pathname.current = '/seeker/reservations'
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/seeker\/reservations"/)
    expect(html).not.toMatch(/<a[^>]*aria-current="[^"]*"[^>]*href="\/seeker"/)
  })

  it('keeps Find a Space reachable while the Seeker is on a hold page', () => {
    pathname.current = HOLD_PATH
    const html = renderToStaticMarkup(<SeekerNav />)

    expect(html).toMatch(/<a[^>]*aria-current="true"[^>]*href="\/seeker\/reservations"/)
    expect(html).not.toMatch(/<a[^>]*aria-current="[^"]*"[^>]*href="\/seeker"/)
    expect(html).toContain('href="/spaces"')
  })
})
