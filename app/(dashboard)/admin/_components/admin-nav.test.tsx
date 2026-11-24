import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const usePathnameMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

import { AdminNav } from './admin-nav'

function anchorFor(html: string, href: string): string {
  const match = html.match(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`))
  return match?.[0] ?? ''
}

describe('AdminNav (STORY-14, TSK-14.4)', () => {
  it('marks only Verification Queue active on /admin', () => {
    usePathnameMock.mockReturnValue('/admin')
    const html = renderToStaticMarkup(<AdminNav />)

    expect(html).toContain('aria-label="Administration portal"')
    expect(anchorFor(html, '/admin')).toContain('aria-current="page"')
    expect(anchorFor(html, '/admin/payments')).not.toContain('aria-current="page"')
    expect(html).toContain('min-h-12')
    expect(html).toContain('min-w-12')
  })

  it('marks only Payments active on /admin/payments', () => {
    usePathnameMock.mockReturnValue('/admin/payments')
    const html = renderToStaticMarkup(<AdminNav />)

    expect(anchorFor(html, '/admin')).not.toContain('aria-current="page"')
    expect(anchorFor(html, '/admin/payments')).toContain('aria-current="page"')
  })
})
