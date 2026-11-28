import { describe, expect, it } from 'vitest'

import { buildPopupHtml, CARD_FOCUS_ZOOM, escapeHtml, planMapMove } from './discovery-map'

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
  review_count: 2,
  avg_overall: 4.25,
}

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    )
  })
})

describe('buildPopupHtml (pin popup, D-003)', () => {
  it('shows the name, price tier, address, rating, distance, curated tags and the profile link', () => {
    const html = buildPopupHtml(space)
    expect(html).toContain('>Sulok Co-working</h3>')
    expect(html).toContain('>Budget</span>')
    expect(html).toContain('48 Sample Avenue, IT Park, Cebu City')
    expect(html).toContain('4.3 · 2 reviews')
    expect(html).toContain('1.2 km away')
    expect(html).toContain('>Wi-Fi: Fast (50+ Mbps)</span>')
    expect(html).toContain('>Outlets: Every Seat</span>')
    expect(html).toContain('href="/spaces/e0000000-0000-4000-8000-000000000003"')
    expect(html).toContain('min-height: 48px;')
  })

  it('shows "No reviews yet" when review_count is 0 and singular "1 review" for one review (STORY-13, TSK-13.4)', () => {
    const unrated = buildPopupHtml({ ...space, review_count: 0, avg_overall: null })
    expect(unrated).toContain('No reviews yet')

    const single = buildPopupHtml({ ...space, review_count: 1, avg_overall: 4 })
    expect(single).toContain('4.0 · 1 review')
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

describe('planMapMove (card click centres the map, FR-1.1)', () => {
  const A = 'e0000000-0000-4000-8000-000000000001'
  const B = 'e0000000-0000-4000-8000-000000000003'
  const base = {
    activeSpaceId: A,
    prevActiveSpaceId: null,
    focusRequest: null,
    lastFocusSeq: 0,
    currentZoom: 13,
  }

  it('does nothing with no selection', () => {
    expect(planMapMove({ ...base, activeSpaceId: null })).toEqual({ kind: 'none' })
  })

  it('pans when a pin selects a new Space', () => {
    expect(planMapMove(base)).toEqual({ kind: 'pan' })
  })

  it('leaves the map alone when the selection is unchanged and nothing asked for focus', () => {
    expect(planMapMove({ ...base, prevActiveSpaceId: A })).toEqual({ kind: 'none' })
  })

  it('flies to the Space and zooms in to street level on a card click', () => {
    expect(planMapMove({ ...base, focusRequest: { spaceId: A, seq: 1 } })).toEqual({
      kind: 'fly',
      zoom: CARD_FOCUS_ZOOM,
      focusSeq: 1,
    })
  })

  it('flies again when the same card is clicked twice', () => {
    expect(
      planMapMove({
        ...base,
        prevActiveSpaceId: A,
        focusRequest: { spaceId: A, seq: 2 },
        lastFocusSeq: 1,
      }),
    ).toMatchObject({ kind: 'fly', focusSeq: 2 })
  })

  it('does not fly twice for the same request', () => {
    expect(
      planMapMove({
        ...base,
        prevActiveSpaceId: A,
        focusRequest: { spaceId: A, seq: 2 },
        lastFocusSeq: 2,
      }),
    ).toEqual({ kind: 'none' })
  })

  it('never zooms out when the Seeker is already closer than street level', () => {
    expect(
      planMapMove({ ...base, focusRequest: { spaceId: A, seq: 1 }, currentZoom: 18 }),
    ).toMatchObject({ kind: 'fly', zoom: 18 })
  })

  it('ignores a focus request for a different Space than the selected one', () => {
    expect(planMapMove({ ...base, focusRequest: { spaceId: B, seq: 1 } })).toEqual({
      kind: 'pan',
    })
  })
})
