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
      /<a[^>]*href="\/spaces"[^>]*>.*?Find a Space.*?<\/a>/,
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

  it('provides a plain GET hero search form to /spaces and quick-filter shortcuts (SRS §3.7.1, STORY-08, STORY-17)', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).toMatch(/<form[^>]*action="\/spaces"[^>]*method="get"/)
    expect(html).toMatch(/<input[^>]*name="q"/)
    expect(html).toContain('/spaces?hours=open_now')
    expect(html).toContain('/spaces?hours=open_late')
    expect(html).toContain('/spaces?unitType=room')
    expect(html).toContain('/spaces?price=budget')
  })

  it('includes the session-mode explorer and stays honest without placeholder roadmap copy (D-002, D-033)', () => {
    const html = renderToStaticMarkup(<Home />)

    expect(html).toContain('role="tablist"')
    expect(html).toContain('Solo deep work')
    expect(html).toContain('Café &amp; laptop')
    expect(html).toContain('Team &amp; private rooms')
    expect(html).not.toMatch(/Sprint \d/)
    expect(html).not.toContain('coming next')
  })
})
