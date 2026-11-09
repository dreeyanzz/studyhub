import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiscoveryShell } from './discovery-shell'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'

describe('DiscoveryShell component (STORY-08, FR-1.1, D-003, D-012)', () => {
  const mockSpaces: VerifiedSpaceSearchResult[] = [
    {
      id: 'space-1',
      name: 'Talamban Study Haven',
      description: 'Tables near USC TC',
      address: 'Talamban, Cebu City',
      opens_at: '08:00:00',
      closes_at: '22:00:00',
      latitude: 10.354,
      longitude: 123.9114,
      price_tier: 'budget',
      distance_km: 0.5,
      curated_tags: [{ id: 'wifi_fast', label: 'Wi-Fi: Fast', category: 'wifi' }],
      custom_tags: [],
    },
  ]

  it('renders split-screen sections for list and map on desktop', () => {
    const html = renderToStaticMarkup(<DiscoveryShell spaces={mockSpaces} />)

    expect(html).toContain('discovery-shell')
    expect(html).toContain('aria-label="Study spaces list"')
    expect(html).toContain('aria-label="Discovery map"')
    expect(html).toContain('Talamban Study Haven')
  })

  it('renders floating mobile view toggle button with 48px touch target (D-031)', () => {
    const html = renderToStaticMarkup(<DiscoveryShell spaces={mockSpaces} />)

    expect(html).toContain('mobile-view-toggle')
    expect(html).toContain('Map view')
    expect(html).toContain('min-h-12 min-w-12')
  })
})
