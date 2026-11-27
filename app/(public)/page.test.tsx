import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SiteFooter } from './_components/site-footer'
import { SiteHeader } from './_components/site-header'
import Home from './page'

describe('public landing page (STORY-02, STORY-17)', () => {
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

  it('routes Hosts to the dedicated /for-hosts page from the header and footer while keeping / Seeker-focused', () => {
    const headerHtml = renderToStaticMarkup(<SiteHeader />)
    const footerHtml = renderToStaticMarkup(<SiteFooter />)
    const homeHtml = renderToStaticMarkup(<Home />)

    expect(headerHtml).toMatch(/<a[^>]*href="\/for-hosts"[^>]*>For Hosts<\/a>/)
    expect(footerHtml).toMatch(/<a[^>]*href="\/for-hosts"[^>]*>For Hosts<\/a>/)
    expect(headerHtml).not.toContain('/#for-hosts')
    expect(footerHtml).not.toContain('/#for-hosts')

    // `/` is strictly Seeker-centered with no competing Host promo block.
    expect(homeHtml).not.toContain('id="for-hosts"')
    expect(homeHtml).not.toContain('/register?role=host')
  })

  it('provides a plain GET hero search form to /spaces and Metro Cebu campus shortcuts (SRS §3.7.1, STORY-08, STORY-17)', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).toMatch(/<form[^>]*action="\/spaces"[^>]*method="get"/)
    expect(html).toMatch(/<input[^>]*name="q"/)
    expect(html).toContain('/spaces?q=USC%20Talamban')
    expect(html).toContain('/spaces?q=UP%20Cebu')
    expect(html).toContain('/spaces?q=CIT-U')
  })

  it('includes an illustrative seat-map preview and stays honest about sandbox payments and non-live samples (D-002, D-005, D-033)', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).toContain('data-testid="landing-seat-map-preview"')
    expect(html).toContain('Sample only · not a live Space')
    expect(html).toContain('Illustrative study environments, not live Space listings.')
    expect(html).not.toMatch(/Sprint \d/)
    expect(html).not.toContain('coming next')
    expect(html).toContain(
      'Reservation fees run in sandbox mode, so no real money moves.',
    )
  })
})
