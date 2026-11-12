import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiscoveryShell, normalizeDiscoveryQuery } from './discovery-shell'
import { FilterDrawer } from './filter-drawer'
import { FilterPanel } from './filter-panel'
import { SearchBar } from './search-bar'
import { SpaceCardList } from './space-card-list'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'

// These tests read server-rendered markup: classes, live regions and copy. Markup can't
// show a size, an overflow or where focus goes, so e2e/discovery-a11y.spec.ts measures
// those in a browser at 360, 768 and 1024 px (TSK-08.6).

/** The opening tag of the element with this data-testid. */
function tagOf(html: string, testId: string): string {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0]
  if (!tag) throw new Error(`no element with data-testid="${testId}"`)
  return tag
}

/** The class attribute of the element with this data-testid. */
function classOf(html: string, testId: string): string {
  return /class="([^"]*)"/.exec(tagOf(html, testId))?.[1] ?? ''
}

/** Every data-testid in the markup that starts with this prefix. */
function testIdsStartingWith(html: string, prefix: string): string[] {
  return [...html.matchAll(new RegExp(`data-testid="(${prefix}[^"]*)"`, 'g'))].map(
    (m) => m[1] ?? '',
  )
}

/** The element carries both 48 px minimums (D-031). */
function expect48pxClasses(html: string, testId: string) {
  const classes = classOf(html, testId).split(/\s+/)
  expect(classes, testId).toContain('min-h-12')
  expect(classes, testId).toContain('min-w-12')
}

describe('Discovery accessibility markup (TSK-08.6, D-003, D-031)', () => {
  const sampleSpaces: VerifiedSpaceSearchResult[] = [
    {
      id: 'space-test-1',
      name: 'Campus Study Hub',
      description: 'Quiet desks near USC TC',
      address: 'Talamban, Cebu City',
      opens_at: '08:00:00',
      closes_at: '23:00:00',
      latitude: 10.354,
      longitude: 123.9114,
      price_tier: 'budget',
      distance_km: 0.3,
      curated_tags: [
        { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
        { id: 'outlets_all', label: 'Outlets: Every Seat', category: 'power' },
      ],
      custom_tags: ['quiet-zone'],
    },
    {
      id: 'space-test-2',
      name: 'Downtown 24/7 Co-working',
      description: 'All-night productivity space',
      address: 'Colon St, Cebu City',
      opens_at: '00:00:00',
      closes_at: '00:00:00',
      latitude: 10.298,
      longitude: 123.899,
      price_tier: 'premium',
      distance_km: 4.8,
      curated_tags: [
        {
          id: 'wifi_ultrafast',
          label: 'Wi-Fi: Ultra-Fast (100+ Mbps)',
          category: 'wifi',
        },
        { id: 'ac_full', label: 'Air Conditioning', category: 'ac' },
      ],
      custom_tags: ['coffee-bar'],
    },
  ]

  describe('1. Layout classes for one pane below 1024 px and two from 1024 px', () => {
    it('renders the stacked layout below 1024 px and the split layout from 1024 px', () => {
      const html = renderToStaticMarkup(<DiscoveryShell spaces={sampleSpaces} />)

      // Main container: a column on mobile and tablet, a row from 1024 px
      expect(html).toContain('flex flex-col lg:flex-row')
      expect(html).toContain('lg:items-start lg:gap-8')

      // List section: full width on mobile/tablet, 48% / 45% on desktop
      expect(html).toContain('w-full lg:w-[48%] xl:w-[45%]')

      // Map section: full width on mobile/tablet, sticky 52% / 55% on desktop
      expect(html).toContain('w-full lg:sticky lg:top-20 lg:w-[52%] xl:w-[55%]')

      // Desktop filter panel hidden below 1024 px, the mobile drawer from 1024 px
      expect(html).toContain('hidden lg:block')
      expect(classOf(html, 'filter-drawer-wrapper')).toContain('lg:hidden')
    })
  })

  describe('2. Mobile Map/List toggle', () => {
    it('keeps both views mounted, and gives the toggle the 48 px classes', () => {
      const html = renderToStaticMarkup(<DiscoveryShell spaces={sampleSpaces} />)

      expect48pxClasses(html, 'mobile-view-toggle')
      expect(html).toContain('Map view')

      // Both sections exist in the DOM simultaneously so state is never lost on view switch
      expect(html).toContain('aria-label="Study spaces list"')
      expect(html).toContain('aria-label="Discovery map"')

      // Mode announcement for screen readers
      expect(html).toContain('Showing list view')
    })
  })

  describe('3. 48 px classes on every control (D-031)', () => {
    it('gives each search bar control the 48 px classes', () => {
      const html = renderToStaticMarkup(
        <SearchBar
          query="USC TC"
          lat={10.354}
          lng={123.9114}
          onSearchChange={() => {}}
          onLocationSelect={() => {}}
          onClearLocation={() => {}}
        />,
      )

      expect(classOf(html, 'discovery-search-input')).toContain('min-h-12')
      expect48pxClasses(html, 'search-submit-button')
      expect48pxClasses(html, 'clear-search-button')
      expect48pxClasses(html, 'use-my-location-button')
      const chips = testIdsStartingWith(html, 'campus-chip-')
      expect(chips.length).toBeGreaterThan(0)
      for (const chip of chips) expect48pxClasses(html, chip)
    })

    it('gives each filter panel control the 48 px classes', () => {
      const html = renderToStaticMarkup(
        <FilterPanel
          filters={{ tags: ['wifi_fast'], price: ['budget'], hours: [], unitType: [] }}
          onToggleTag={() => {}}
          onTogglePrice={() => {}}
          onToggleHours={() => {}}
          onToggleUnitType={() => {}}
          onClearAll={() => {}}
        />,
      )

      expect48pxClasses(html, 'clear-all-filters')
      for (const id of testIdsStartingWith(html, 'filter-(?:tag|hours|price|unit)-')) {
        expect48pxClasses(html, id)
      }
    })

    it('gives each filter drawer control the 48 px classes', () => {
      const html = renderToStaticMarkup(
        <FilterDrawer
          filters={{ tags: ['wifi_fast'], price: [], hours: [], unitType: [] }}
          resultCount={1}
          defaultOpen
          onToggleTag={() => {}}
          onTogglePrice={() => {}}
          onToggleHours={() => {}}
          onToggleUnitType={() => {}}
          onClearAll={() => {}}
        />,
      )

      for (const id of [
        'filter-drawer-trigger',
        'mobile-clear-all-filters',
        'filter-drawer-close',
        'drawer-clear-all',
        'drawer-apply-button',
      ]) {
        expect48pxClasses(html, id)
      }
      const options = testIdsStartingWith(html, 'drawer-filter-')
      expect(options.length).toBeGreaterThan(0)
      for (const id of options) expect48pxClasses(html, id)
    })
  })

  describe('4. Screen Reader Polite Announcements (aria-live="polite")', () => {
    it('announces space result count changes via aria-live="polite"', () => {
      const html = renderToStaticMarkup(
        <SpaceCardList
          spaces={sampleSpaces}
          activeSpaceId={null}
          hoveredSpaceId={null}
          onSelectSpace={() => {}}
          onHoverSpace={() => {}}
        />,
      )

      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('2 study spaces found')
    })

    it('announces active filter count in desktop FilterPanel and mobile FilterDrawer', () => {
      const panelHtml = renderToStaticMarkup(
        <FilterPanel
          filters={{
            tags: ['wifi_fast', 'outlets_all'],
            price: [],
            hours: [],
            unitType: [],
          }}
          onToggleTag={() => {}}
          onTogglePrice={() => {}}
          onToggleHours={() => {}}
          onToggleUnitType={() => {}}
          onClearAll={() => {}}
        />,
      )
      expect(panelHtml).toContain('aria-live="polite"')
      expect(panelHtml).toContain('2 active filters applied')

      const drawerHtml = renderToStaticMarkup(
        <FilterDrawer
          filters={{
            tags: ['wifi_fast', 'outlets_all'],
            price: [],
            hours: [],
            unitType: [],
          }}
          resultCount={1}
          onToggleTag={() => {}}
          onTogglePrice={() => {}}
          onToggleHours={() => {}}
          onToggleUnitType={() => {}}
          onClearAll={() => {}}
        />,
      )
      expect(drawerHtml).toContain('aria-live="polite"')
      expect(drawerHtml).toContain('2 active filters applied')
    })
  })

  describe('5. Accessible Empty State (seeker-search-no-results) with One-Click Filter Reset', () => {
    it('renders seeker-search-no-results container with exact copy and 48px reset button', () => {
      const html = renderToStaticMarkup(
        <SpaceCardList
          spaces={[]}
          activeSpaceId={null}
          hoveredSpaceId={null}
          onSelectSpace={() => {}}
          onHoverSpace={() => {}}
          onClearFilters={() => {}}
        />,
      )

      expect(html).toContain('data-testid="seeker-search-no-results"')
      expect(html).toContain('No study spaces found matching your criteria.')
      expect(html).toContain('Try expanding your search area or clearing some filters.')
      expect(html).toContain('Reset all filters')
      expect48pxClasses(html, 'reset-all-filters-button')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('0 study spaces found')
      // The list can take focus once the reset button is gone (TSK-08.6)
      expect(tagOf(html, 'space-card-list')).toContain('tabindex="-1"')
    })

    it('renders empty state in DiscoveryShell when query filters out all spaces', () => {
      const noMatchQuery = normalizeDiscoveryQuery({
        q: 'Nonexistent University Campus XYZ',
      })
      const html = renderToStaticMarkup(
        <DiscoveryShell spaces={sampleSpaces} initialQuery={noMatchQuery} />,
      )

      expect(html).toContain('data-testid="seeker-search-no-results"')
      expect(html).toContain('No study spaces found matching your criteria.')
      expect(html).toContain('Reset all filters')
    })
  })
})
