import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceTags, type CuratedTagData } from './space-tags'

describe('SpaceTags (STORY-11, TSK-11.6)', () => {
  const curatedTags: CuratedTagData[] = [
    { id: 'wifi_fast', label: 'Wi-Fi: Fast (50+ Mbps)', category: 'wifi' },
    { id: 'outlets_all', label: 'Outlets: Every Seat', category: 'power' },
    { id: 'noise_silent', label: 'Noise: Silent Study', category: 'noise' },
    { id: 'ac_full', label: 'Air Conditioning', category: 'ac' },
  ]

  const customTags = ['espresso-bar', 'ergonomic-chairs', 'quiet-corner']

  it('renders curated amenity tags with h2 heading, solid primary styling, and category icons', () => {
    const html = renderToStaticMarkup(
      <SpaceTags curatedTags={curatedTags} customTags={[]} />,
    )

    expect(html).toContain('data-testid="curated-tags"')
    expect(html).toContain('<h2')
    expect(html).not.toContain('<h3')
    expect(html).toContain('Curated Amenities')

    // Solid primary styling per D-006 and issue #270
    expect(html).toContain('text-primary')
    expect(html).toContain('bg-primary/10')
    expect(html).toContain('border-primary/20')

    // Each of the 4 curated tags renders an SVG icon
    const svgMatches = [...html.matchAll(/<svg\b/g)]
    expect(svgMatches).toHaveLength(curatedTags.length)

    // Labels
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Outlets: Every Seat')
    expect(html).toContain('Noise: Silent Study')
    expect(html).toContain('Air Conditioning')

    // No custom tags section
    expect(html).not.toContain('data-testid="custom-tags"')
    expect(html).not.toContain('Host custom tags')
  })

  it('renders fallback Tag icon when category is unknown or omitted', () => {
    const html = renderToStaticMarkup(
      <SpaceTags
        curatedTags={[
          { id: 'unknown_cat', label: 'Lockers', category: 'other' },
          { id: 'no_cat', label: 'Standing Mat' },
        ]}
        customTags={[]}
      />,
    )

    const svgMatches = [...html.matchAll(/<svg\b/g)]
    expect(svgMatches).toHaveLength(2)
    expect(html).toContain('Lockers')
    expect(html).toContain('Standing Mat')
  })

  it('renders host custom tags with distinct outline styling and overflow wrapping under a separate "Host custom tags" h2 label (D-006)', () => {
    const longCustomTag = 'superlongcustomtagwithoutspace' // 30 chars
    const html = renderToStaticMarkup(
      <SpaceTags curatedTags={[]} customTags={[...customTags, longCustomTag]} />,
    )

    expect(html).toContain('data-testid="custom-tags"')
    expect(html).toContain('<h2')
    expect(html).not.toContain('<h3')
    expect(html).toContain('Host custom tags')

    // Distinct outline styling and overflow wrapping specifically on the custom tag listitem pills (D-006)
    const pillMatches = [...html.matchAll(/<span role="listitem" class="([^"]+)"/g)]
    expect(pillMatches).toHaveLength(4)
    for (const [, pillClass] of pillMatches) {
      expect(pillClass).toContain('text-muted-foreground')
      expect(pillClass).toContain('bg-muted/40')
      expect(pillClass).toContain('border-muted-foreground/30')
      expect(pillClass).toContain('max-w-full')
      expect(pillClass).toContain('min-w-0')
      expect(pillClass).toContain('wrap-anywhere')
    }

    // Tags with hash prefix
    expect(html).toContain('#espresso-bar')
    expect(html).toContain('#ergonomic-chairs')
    expect(html).toContain('#quiet-corner')
    expect(html).toContain(`#${longCustomTag}`)

    // No curated tags section
    expect(html).not.toContain('data-testid="curated-tags"')
  })

  it('custom tags are strictly presentation-only and never function as search filters', () => {
    const html = renderToStaticMarkup(
      <SpaceTags curatedTags={curatedTags} customTags={customTags} />,
    )

    // Contains no anchor links or button filters
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href=')
  })

  it('returns null when both curated and custom tag lists are empty', () => {
    const html = renderToStaticMarkup(<SpaceTags curatedTags={[]} customTags={[]} />)
    expect(html).toBe('')
  })
})
