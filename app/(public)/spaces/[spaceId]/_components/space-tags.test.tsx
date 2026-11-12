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

  it('renders curated amenity tags with solid primary styling and category icons', () => {
    const html = renderToStaticMarkup(
      <SpaceTags curatedTags={curatedTags} customTags={[]} />,
    )

    expect(html).toContain('data-testid="curated-tags"')
    expect(html).toContain('Curated Amenities')

    // Solid primary styling per D-006 and issue #270
    expect(html).toContain('text-primary')
    expect(html).toContain('bg-primary/10')
    expect(html).toContain('border-primary/20')

    // Labels
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Outlets: Every Seat')
    expect(html).toContain('Noise: Silent Study')
    expect(html).toContain('Air Conditioning')

    // No custom tags section
    expect(html).not.toContain('data-testid="custom-tags"')
    expect(html).not.toContain('Host custom tags')
  })

  it('renders host custom tags with distinct outline styling under a separate "Host custom tags" label (D-006)', () => {
    const html = renderToStaticMarkup(
      <SpaceTags curatedTags={[]} customTags={customTags} />,
    )

    expect(html).toContain('data-testid="custom-tags"')
    expect(html).toContain('Host custom tags')

    // Distinct outline styling per D-006
    expect(html).toContain('text-muted-foreground')
    expect(html).toContain('bg-muted/40')
    expect(html).toContain('border-muted-foreground/30')

    // Tags with hash prefix
    expect(html).toContain('#espresso-bar')
    expect(html).toContain('#ergonomic-chairs')
    expect(html).toContain('#quiet-corner')

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
