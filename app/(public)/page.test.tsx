import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SiteFooter } from './_components/site-footer'
import { SiteHeader } from './_components/site-header'
import Home from './page'

describe('public landing page (STORY-02)', () => {
  it('leads to the discovery map from the header, the hero and the footer (FR-1.1)', () => {
    expect(renderToStaticMarkup(<SiteHeader />)).toMatch(
      /<a[^>]*href="\/spaces"[^>]*>Find a Space<\/a>/,
    )
    expect(renderToStaticMarkup(<SiteFooter />)).toMatch(
      /<a[^>]*href="\/spaces"[^>]*>Find a Space<\/a>/,
    )
    expect(renderToStaticMarkup(<Home />)).toMatch(
      /<a[^>]*href="\/spaces"[^>]*>.*?Find a Space<\/a>/,
    )
  })

  it('provides a plain GET hero search form to /spaces (SRS §3.7.1, STORY-17)', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).toMatch(/<form[^>]*action="\/spaces"[^>]*method="get"/)
    expect(html).toMatch(/<input[^>]*name="q"/)
  })

  it('no longer promises shipped features for a future sprint', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).not.toMatch(/Sprint \d/)
    expect(html).not.toContain('coming next')
    expect(html).toContain(
      'Reservation fees run in sandbox mode, so no real money moves.',
    )
  })
})
