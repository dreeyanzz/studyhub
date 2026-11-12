import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SpaceCardList } from './space-card-list'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'

describe('SpaceCardList component (STORY-08, FR-1.1, D-003)', () => {
  const mockSpaces: VerifiedSpaceSearchResult[] = [
    {
      id: 'space-1',
      name: 'Talamban Study Loft',
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
    {
      id: 'space-2',
      name: 'Downtown Cowork',
      description: 'Central study hall',
      address: 'Colon St, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00',
      latitude: 10.298,
      longitude: 123.899,
      price_tier: 'free',
      distance_km: 5.2,
      curated_tags: [],
      custom_tags: [],
    },
  ]

  it('renders list of spaces and total count header', () => {
    const html = renderToStaticMarkup(
      <SpaceCardList
        spaces={mockSpaces}
        activeSpaceId={null}
        hoveredSpaceId={null}
        onSelectSpace={() => {}}
        onHoverSpace={() => {}}
      />,
    )

    expect(html).toContain('Showing')
    expect(html).toContain('2')
    expect(html).toContain('spaces')
    expect(html).toContain('Talamban Study Loft')
    expect(html).toContain('Downtown Cowork')
  })

  it('renders accessible empty state when spaces array is empty', () => {
    const html = renderToStaticMarkup(
      <SpaceCardList
        spaces={[]}
        activeSpaceId={null}
        hoveredSpaceId={null}
        onSelectSpace={() => {}}
        onHoverSpace={() => {}}
      />,
    )

    expect(html).toContain('0 study spaces found')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('<h2')
    expect(html).toContain('No study spaces found matching your criteria.')
    expect(html).toContain('Try expanding your search area or clearing some filters.')
    expect(html).toContain('Reset all filters')
    expect(html).toContain('seeker-search-no-results')
    expect(html).toContain('space-card-list-empty')
    expect(html).toContain('reset-all-filters-button')
    expect(html).toContain('min-h-12 min-w-12')
  })
})
