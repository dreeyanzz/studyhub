import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SpaceCard } from './space-card'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'

describe('SpaceCard component (STORY-08, FR-1.1, D-003)', () => {
  const mockSpace: VerifiedSpaceSearchResult = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Quiet Nook Cafe',
    description: 'Cozy study desks with dedicated power outlets.',
    address: '123 Gorordo Ave, Cebu City',
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    latitude: 10.3157,
    longitude: 123.8854,
    price_tier: 'budget',
    distance_km: 0.8,
    curated_tags: [
      { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
      { id: 'outlets_all', label: 'Outlets: Every Seat', category: 'power' },
    ],
    custom_tags: ['Espresso', 'Silent Area'],
    review_count: 2,
    avg_overall: 4.25,
  }

  it('renders space details, rating summary, price tier badge, distance, and tags', () => {
    const html = renderToStaticMarkup(<SpaceCard space={mockSpace} />)

    expect(html).toContain('<h2')
    expect(html).toContain('Quiet Nook Cafe')
    expect(html).toContain('123 Gorordo Ave, Cebu City')
    expect(html).toContain('0.8 km away')
    expect(html).toContain('Budget')
    expect(html).toContain('08:00 - 22:00')
    expect(html).toContain('4.3 · 2 reviews')
    expect(html).toContain('aria-label="Overall 4.3 out of 5, from 2 reviews"')
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Outlets: Every Seat')
    expect(html).toContain('#Espresso')
    expect(html).toContain('#Silent Area')
    expect(html).toContain('/spaces/11111111-1111-4111-8111-111111111111')
    expect(html).toContain('View Space')
  })

  it('renders "No reviews yet" when review_count is 0 (STORY-13, TSK-13.4)', () => {
    const html = renderToStaticMarkup(
      <SpaceCard space={{ ...mockSpace, review_count: 0, avg_overall: null }} />,
    )
    expect(html).toContain('No reviews yet')
    expect(html).not.toContain('Overall')
  })

  it('renders active ring style when isActive is true', () => {
    const html = renderToStaticMarkup(<SpaceCard space={mockSpace} isActive />)
    expect(html).toContain('ring-primary')
    expect(html).toContain('border-primary')
  })

  it('shortens a long description by characters and clamps no lines (#372)', () => {
    const description = `${'Quiet tables with strong wifi. '.repeat(10)}Last words.`
    const html = renderToStaticMarkup(<SpaceCard space={{ ...mockSpace, description }} />)

    expect(html).toContain('Quiet tables with strong wifi. Quiet tables')
    expect(html).toContain('…</p>')
    expect(html).not.toContain('Last words.')
    // A line clamp hides more of the text as it grows, which the 200% text check
    // in e2e/accessibility.spec.ts reports as clipping.
    expect(html).not.toContain('line-clamp')
  })

  it('handles 24 hours format properly', () => {
    const space24h: VerifiedSpaceSearchResult = {
      ...mockSpace,
      opens_at: '00:00:00',
      closes_at: '00:00:00',
      distance_km: null,
    }
    const html = renderToStaticMarkup(<SpaceCard space={space24h} />)
    expect(html).toContain('Open 24 Hours')
    expect(html).not.toContain('km away')
  })

  it('clips the decorative blurred cover-photo backdrop inside its rounded wrapper', () => {
    const html = renderToStaticMarkup(
      <SpaceCard
        space={{
          ...mockSpace,
          cover_photo_url:
            'https://example.supabase.co/storage/v1/object/public/space-photos/a/1.jpg',
        }}
      />,
    )
    expect(html).toContain(
      'pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]',
    )
  })
})
