import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AdminMobileHeader } from './admin-mobile-header'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}))

describe('AdminMobileHeader (STORY-17)', () => {
  it('renders administrator name, pending count, and mobile navigation tabs', () => {
    const html = renderToStaticMarkup(
      <AdminMobileHeader displayName="Admin Jane" pendingCount={3} />,
    )

    expect(html).toContain('Admin Jane')
    expect(html).toContain('Verification (3)')
    expect(html).toContain('href="/admin"')
    expect(html).toContain('href="/admin/moderation"')
    expect(html).toContain('href="/admin/payments"')
    expect(html).toContain('Log out')
  })
})
