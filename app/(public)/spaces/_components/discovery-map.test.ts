import { describe, expect, it } from 'vitest'

import { buildPopupHtml, escapeHtml } from './discovery-map'

const space = {
  id: 'e0000000-0000-4000-8000-000000000003',
  name: 'Sulok Co-working',
  address: '48 Sample Avenue, IT Park, Cebu City',
  price_tier: 'budget' as const,
  distance_km: 1.2,
  curated_tags: [
    { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
    { id: 'outlets_all', label: 'Outlets: Every Seat', category: 'power' },
  ],
}

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    )
  })
})

describe('buildPopupHtml (pin popup, D-003)', () => {
  it('shows the name, price tier, address, distance, curated tags and the profile link', () => {
    const html = buildPopupHtml(space)
    expect(html).toContain('>Sulok Co-working</h3>')
    expect(html).toContain('>Budget</span>')
    expect(html).toContain('48 Sample Avenue, IT Park, Cebu City')
    expect(html).toContain('1.2 km away')
    expect(html).toContain('>Wi-Fi: Fast (50+ Mbps)</span>')
    expect(html).toContain('>Outlets: Every Seat</span>')
    expect(html).toContain('href="/spaces/e0000000-0000-4000-8000-000000000003"')
    expect(html).toContain('min-height: 48px;')
  })

  it('leaves out the distance and tag list when empty', () => {
    const html = buildPopupHtml({ ...space, distance_km: null, curated_tags: [] })
    expect(html).not.toContain('km away')
    expect(html).not.toContain('Wi-Fi: Fast')
  })

  it("never turns a Host's name, address or tag label into markup", () => {
    const html = buildPopupHtml({
      ...space,
      name: 'Sulok <img src=x onerror="alert(1)">',
      address: '<script>alert(2)</script>',
      curated_tags: [{ id: 't1', label: '<b>Tag</b>', category: 'wifi' }],
    })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<b>Tag</b>')
    expect(html).toContain('Sulok &lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;Tag&lt;/b&gt;')
  })
})
