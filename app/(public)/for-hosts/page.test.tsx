import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ForHostsPage from './page'

describe('/for-hosts public Host page (STORY-17)', () => {
  it('renders a Host-centered hero with direct Host registration and sign-in paths', () => {
    const html = renderToStaticMarkup(<ForHostsPage />)

    expect(html).toMatch(/<h1[^>]*id="hosts-hero-title"/)
    expect(html).toContain('href="/register?role=host"')
    expect(html).toContain('href="/login"')
    expect(html).toContain('href="/spaces"')
  })

  it('includes the interactive Host front-desk preview and stays honest about verification and sandbox fees (D-002, D-005, D-037)', () => {
    const html = renderToStaticMarkup(<ForHostsPage />)

    expect(html).toContain('data-testid="host-desk-preview"')
    expect(html).toContain('Host-updated · 4 min ago')
    expect(html).toContain('Sample desk only · no live Space data is changed.')
    expect(html).toContain('Verify check-in')
    expect(html).toContain(
      'Reviewed by an Administrator before going public. Reservation fees run in sandbox mode, so no real money moves.',
    )
  })
})
