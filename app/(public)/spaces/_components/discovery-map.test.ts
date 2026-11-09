import { describe, expect, it } from 'vitest'

import { buildPopupHtml, escapeHtml } from './discovery-map'

const space = {
  id: 'e0000000-0000-4000-8000-000000000003',
  name: 'Sulok Co-working',
  address: '48 Sample Avenue, IT Park, Cebu City',
  price_tier: 'budget' as const,
  distance_km: 1.2,
}

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    )
  })
})

describe('buildPopupHtml (pin popup, D-003)', () => {
  it('shows the name, price tier, address, distance and the profile link', () => {
    const html = buildPopupHtml(space)
    expect(html).toContain('>Sulok Co-working</h4>')
    expect(html).toContain('>Budget</span>')
    expect(html).toContain('48 Sample Avenue, IT Park, Cebu City')
    expect(html).toContain('1.2 km away')
    expect(html).toContain('href="/spaces/e0000000-0000-4000-8000-000000000003"')
  })

  it('leaves out the distance when there is no search center', () => {
    expect(buildPopupHtml({ ...space, distance_km: null })).not.toContain('km away')
  })

  it("never turns a Host's name or address into markup", () => {
    const html = buildPopupHtml({
      ...space,
      name: 'Sulok <img src=x onerror="alert(1)">',
      address: '<script>alert(2)</script>',
    })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('Sulok &lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;')
  })
})
