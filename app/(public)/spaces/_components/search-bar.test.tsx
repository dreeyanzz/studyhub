import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QUICK_CAMPUS_CHIPS, SearchBar } from './search-bar'

describe('SearchBar component (STORY-08, FR-1.1, D-031)', () => {
  it('renders search input, quick campus chips, and Use my location button with 48px touch targets', () => {
    const html = renderToStaticMarkup(
      <SearchBar query="" onSearchChange={() => {}} onLocationSelect={() => {}} />,
    )

    expect(html).toContain('discovery-search-bar')
    expect(html).toContain('placeholder="Search by campus, city, or space name..."')
    expect(html).toContain('use-my-location-button')
    expect(html).toContain('Use my location')
    expect(html).toContain('min-h-12 min-w-12')

    for (const chip of QUICK_CAMPUS_CHIPS) {
      expect(html).toContain(`campus-chip-${chip.id}`)
      expect(html).toContain(chip.label)
    }
  })

  it('highlights matching campus chip and displays campus match banner when query resolves a Cebu campus', () => {
    const html = renderToStaticMarkup(
      <SearchBar query="USC TC" onSearchChange={() => {}} onLocationSelect={() => {}} />,
    )

    expect(html).toContain('active-campus-banner')
    expect(html).toContain('University of San Carlos - Talamban Campus')
    expect(html).toContain('clear-search-button')
  })

  it('displays active user coordinates banner when lat and lng are provided', () => {
    const html = renderToStaticMarkup(
      <SearchBar
        query=""
        lat={10.354}
        lng={123.9114}
        onSearchChange={() => {}}
        onLocationSelect={() => {}}
      />,
    )

    expect(html).toContain('Using my location')
    expect(html).toContain('active-location-banner')
    expect(html).toContain('10.3540')
    expect(html).toContain('123.9114')
  })
})
