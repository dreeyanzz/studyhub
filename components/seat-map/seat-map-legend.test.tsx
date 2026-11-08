import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SeatMapLegend } from '@/components/seat-map/seat-map-legend'

describe('SeatMapLegend component (STORY-07 TSK-07.4)', () => {
  it('names every icon and state in words', () => {
    const html = renderToStaticMarkup(<SeatMapLegend />)

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Seat map legend"')

    // States in words
    expect(html).toContain('Available')
    expect(html).toContain('Pending Payment')
    expect(html).toContain('Reserved')
    expect(html).toContain('Occupied')

    // Types in words
    expect(html).toContain('Seat')
    expect(html).toContain('Standing Desk')
    expect(html).toContain('Room')

    // Check that SVGs for each of the 7 items are rendered
    const svgMatches = html.match(/<svg/g)
    expect(svgMatches).toHaveLength(7)
  })

  it('keeps the light palette whatever the OS color scheme (D-031)', () => {
    const html = renderToStaticMarkup(<SeatMapLegend />)

    // The app has no dark theme, so a dark: class would follow the OS setting.
    expect(html).not.toContain('dark:')
  })

  it('accepts and merges custom className', () => {
    const html = renderToStaticMarkup(<SeatMapLegend className="my-custom-legend" />)
    expect(html).toContain('my-custom-legend')
  })
})
