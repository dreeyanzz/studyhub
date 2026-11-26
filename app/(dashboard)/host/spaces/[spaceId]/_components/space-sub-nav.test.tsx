import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceSubNav } from './space-sub-nav'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

describe('SpaceSubNav (STORY-17)', () => {
  it('renders a labelled nav with all six Host workspace links', () => {
    const html = renderToStaticMarkup(
      <SpaceSubNav spaceId={SPACE_ID} current="occupancy" />,
    )

    expect(html).toContain('<nav aria-label="Space sections"')
    for (const section of [
      'occupancy',
      'check-in',
      'seat-map',
      'photos',
      'tags',
      'edit',
    ]) {
      expect(html).toContain(`href="/host/spaces/${SPACE_ID}/${section}"`)
    }
  })

  it('marks only the active section with aria-current="page" and wraps cleanly', () => {
    const html = renderToStaticMarkup(<SpaceSubNav spaceId={SPACE_ID} current="photos" />)

    expect(html).toMatch(
      new RegExp(`<a[^>]*aria-current="page"[^>]*href="/host/spaces/${SPACE_ID}/photos"`),
    )
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('min-h-12')
    expect(html).toContain('whitespace-normal')
  })
})
