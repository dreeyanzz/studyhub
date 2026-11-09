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
  }

  it('renders space details, price tier badge, distance, and tags', () => {
    const html = renderToStaticMarkup(<SpaceCard space={mockSpace} />)

    expect(html).toContain('Quiet Nook Cafe')
    expect(html).toContain('123 Gorordo Ave, Cebu City')
    expect(html).toContain('0.8 km away')
    expect(html).toContain('Budget')
    expect(html).toContain('08:00 - 22:00')
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Outlets: Every Seat')
    expect(html).toContain('#Espresso')
    expect(html).toContain('#Silent Area')
    expect(html).toContain('/spaces/11111111-1111-4111-8111-111111111111')
    expect(html).toContain('View Space')
  })

  it('renders active ring style when isActive is true', () => {
    const html = renderToStaticMarkup(<SpaceCard space={mockSpace} isActive />)
    expect(html).toContain('ring-primary')
    expect(html).toContain('border-primary')
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
})
