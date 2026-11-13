import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceProfileHeader } from './space-profile-header'

describe('SpaceProfileHeader (STORY-11, TSK-11.3)', () => {
  const baseSpace = {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Kapihan Study Hall',
    description: 'A cozy corner for deep focus and espresso.\nFree high-speed WiFi.',
    address: '123 Colon Street, Cebu City',
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    price_tier: 'budget' as const,
  }

  it('renders space title, address, hours, open status badge, and price tier badge', () => {
    const html = renderToStaticMarkup(
      <SpaceProfileHeader
        space={baseSpace}
        operatingStatus={{
          isOpen: true,
          displayText: 'Open now · Closes at 22:00',
          opensAt: '08:00',
          closesAt: '22:00',
          is24Hours: false,
        }}
      />,
    )

    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('<h1')
    expect(html).toContain('123 Colon Street, Cebu City')
    expect(html).toContain('Hours: 08:00 to 22:00')
    expect(html).toContain('Open now · Closes at 22:00')
    expect(html).toContain('data-testid="price-tier-badge-budget"')
    expect(html).toContain('Budget (₱)')
    expect(html).toContain('A cozy corner for deep focus and espresso.')
  })

  it('renders closed status badge with muted styling when closed', () => {
    const html = renderToStaticMarkup(
      <SpaceProfileHeader
        space={baseSpace}
        operatingStatus={{
          isOpen: false,
          displayText: 'Closed · Opens at 08:00',
          opensAt: '08:00',
          closesAt: '22:00',
          is24Hours: false,
        }}
      />,
    )

    expect(html).toContain('Closed · Opens at 08:00')
    expect(html).toContain('text-muted-foreground')
  })

  it('renders 24 hours badge when space is open 24 hours', () => {
    const space24 = {
      ...baseSpace,
      opens_at: '00:00:00',
      closes_at: '00:00:00',
    }

    const html = renderToStaticMarkup(
      <SpaceProfileHeader
        space={space24}
        operatingStatus={{
          isOpen: true,
          displayText: 'Open 24 hours',
          opensAt: '00:00',
          closesAt: '00:00',
          is24Hours: true,
        }}
      />,
    )

    expect(html).toContain('Hours: Open 24 hours')
    expect(html).toContain('Open 24 hours')
  })

  it('omits description paragraph when description is null', () => {
    const html = renderToStaticMarkup(
      <SpaceProfileHeader
        space={{ ...baseSpace, description: null }}
        operatingStatus={{
          isOpen: true,
          displayText: 'Open now · Closes at 22:00',
          opensAt: '08:00',
          closesAt: '22:00',
          is24Hours: false,
        }}
      />,
    )

    expect(html).not.toContain('A cozy corner')
  })
})
