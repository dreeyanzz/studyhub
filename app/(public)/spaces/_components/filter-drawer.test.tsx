import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FilterDrawer } from './filter-drawer'

describe('FilterDrawer component (STORY-08, FR-1.2, D-031)', () => {
  it('renders mobile filter trigger button with 48px touch target', () => {
    const html = renderToStaticMarkup(
      <FilterDrawer
        filters={{ tags: [], price: [], hours: [], unitType: [] }}
        resultCount={4}
        onToggleTag={() => {}}
        onTogglePrice={() => {}}
        onToggleHours={() => {}}
        onToggleUnitType={() => {}}
        onClearAll={() => {}}
      />,
    )

    expect(html).toContain('filter-drawer-trigger')
    expect(html).toContain('Filters')
    expect(html).toContain('min-h-12 min-w-12')
    expect(html).not.toContain('filter-drawer-dialog')
  })

  it('renders active filter count pill and dialog with all 7 criteria when open', () => {
    const html = renderToStaticMarkup(
      <FilterDrawer
        filters={{
          tags: ['wifi_fast', 'ac_full'],
          price: ['budget'],
          hours: [],
          unitType: [],
        }}
        resultCount={2}
        defaultOpen
        onToggleTag={() => {}}
        onTogglePrice={() => {}}
        onToggleHours={() => {}}
        onToggleUnitType={() => {}}
        onClearAll={() => {}}
      />,
    )

    expect(html).toContain('mobile-active-filter-count')
    expect(html).toContain('mobile-clear-all-filters')
    expect(html).toContain('filter-drawer-dialog')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Show 2 spaces')
    expect(html).toContain('drawer-filter-tag-wifi_fast')
    expect(html).toContain('drawer-filter-hours-open_now')
    expect(html).toContain('drawer-filter-price-budget')
    expect(html).toContain('drawer-filter-unit-seat')
  })
})
