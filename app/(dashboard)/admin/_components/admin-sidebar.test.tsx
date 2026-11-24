import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AdminSidebar } from './admin-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}))

describe('AdminSidebar (STORY-17)', () => {
  it('renders administrator name, pending count, and navigation links', () => {
    const html = renderToStaticMarkup(
      <AdminSidebar displayName="Admin Jane" pendingCount={4} />,
    )

    // Identity and pending count
    expect(html).toContain('Admin Jane')
    expect(html).toContain('Administrator')
    expect(html).toContain('4')

    // Navigation links
    expect(html).toContain('href="/admin"')
    expect(html).toContain('href="/admin/moderation"')
    expect(html).toContain('href="/admin/payments"')
    expect(html).toContain('Space Verification')
    expect(html).toContain('Review Moderation')
    expect(html).toContain('Payments &amp; Refunds')

    // No duplicate h1 in the sidebar
    expect(html).not.toMatch(/<h1[^>]*>Worq<\/h1>/)
    expect(html).not.toContain('<h1')
  })

  it('renders shortcuts and accessible log out button', () => {
    const html = renderToStaticMarkup(
      <AdminSidebar displayName="Admin John" pendingCount={0} />,
    )

    expect(html).toContain('href="/spaces"')
    expect(html).toContain('View Discovery Map')
    expect(html).toContain('Log out')
  })
})
