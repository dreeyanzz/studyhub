import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FindSpaceCard } from './find-space-card'

describe('FindSpaceCard (STORY-04)', () => {
  it('is a titled section with a link to the discovery map', () => {
    const html = renderToStaticMarkup(<FindSpaceCard />)

    expect(html).toContain('aria-labelledby="find-space-heading"')
    expect(html).toMatch(
      /<h2 id="find-space-heading"[^>]*>Ready for your next study day\?<\/h2>/,
    )
    expect(html).toMatch(/<a[^>]*href="\/spaces"[^>]*>.*Find a Space<\/a>/)
    // Wraps at 360 px / 200% text scaling instead of inheriting whitespace-nowrap from buttonVariants (SRS §3.2.2)
    expect(html).toContain('whitespace-normal')
  })
})
