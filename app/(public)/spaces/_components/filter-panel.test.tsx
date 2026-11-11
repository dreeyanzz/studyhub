import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CURATED_TAG_GROUPS,
  FilterPanel,
  HOURS_FILTER_OPTIONS,
  PRICE_TIER_FILTER_OPTIONS,
  UNIT_TYPE_FILTER_OPTIONS,
  countActiveFilters,
  toggleFilterValue,
} from './filter-panel'

describe('FilterPanel component and helpers (STORY-08, FR-1.2, D-006, D-031)', () => {
  it('renders all 7 curated filter groups with 48px minimum touch targets', () => {
    const html = renderToStaticMarkup(
      <FilterPanel
        filters={{ tags: [], price: [], hours: [], unitType: [] }}
        onToggleTag={() => {}}
        onTogglePrice={() => {}}
        onToggleHours={() => {}}
        onToggleUnitType={() => {}}
        onClearAll={() => {}}
      />,
    )

    expect(html).toContain('filter-panel')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('0 active filters applied')
    expect(html).toContain('min-h-12 min-w-12')

    // 1-4: Wi-Fi, Power Outlets, Noise, AC
    for (const group of CURATED_TAG_GROUPS) {
      expect(html).toContain(group.title)
      for (const opt of group.options) {
        expect(html).toContain(`filter-tag-${opt.id}`)
      }
    }

    // 5: Operating Hours
    for (const opt of HOURS_FILTER_OPTIONS) {
      expect(html).toContain(`filter-hours-${opt.id}`)
    }

    // 6: Price Tier
    for (const opt of PRICE_TIER_FILTER_OPTIONS) {
      expect(html).toContain(`filter-price-${opt.id}`)
    }

    // 7: Unit Type
    for (const opt of UNIT_TYPE_FILTER_OPTIONS) {
      expect(html).toContain(`filter-unit-${opt.id}`)
    }

    // Clear all is hidden when 0 filters active
    expect(html).not.toContain('clear-all-filters')
  })

  it('shows active filter count badge and Clear all button when filters are selected', () => {
    const html = renderToStaticMarkup(
      <FilterPanel
        filters={{
          tags: ['wifi_fast', 'outlets_all'],
          price: ['budget'],
          hours: ['open_now'],
          unitType: ['seat'],
        }}
        onToggleTag={() => {}}
        onTogglePrice={() => {}}
        onToggleHours={() => {}}
        onToggleUnitType={() => {}}
        onClearAll={() => {}}
      />,
    )

    expect(html).toContain('active-filter-count')
    expect(html).toContain('5 active')
    expect(html).toContain('5 active filters applied')
    expect(html).toContain('clear-all-filters')
  })

  it('computes countActiveFilters and toggleFilterValue accurately', () => {
    expect(
      countActiveFilters({
        tags: ['wifi_fast'],
        price: ['free', 'budget'],
        hours: [],
        unitType: ['room'],
      }),
    ).toBe(4)

    expect(toggleFilterValue(['wifi_fast'], 'outlets_all')).toEqual([
      'wifi_fast',
      'outlets_all',
    ])
    expect(toggleFilterValue(['wifi_fast', 'outlets_all'], 'wifi_fast')).toEqual([
      'outlets_all',
    ])
  })
})
