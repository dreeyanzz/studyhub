import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { canShowStartupLamp, StartupLamp, StartupLampOverlay } from './startup-lamp'

describe('StartupLamp (STORY-17 TSK-17.2)', () => {
  it('renders the overlay on SSR so the viewport is covered from first paint', () => {
    const html = renderToStaticMarkup(<StartupLamp />)
    expect(html).toContain('class="startup-lamp-overlay"')
    expect(html).toContain('aria-hidden="true"')
  })

  it('skips the overlay when prefers-reduced-motion is enabled', () => {
    expect(canShowStartupLamp({ reducedMotion: true })).toBe(false)
  })

  it('allows the overlay on every load when reduced motion is disabled', () => {
    expect(canShowStartupLamp({ reducedMotion: false })).toBe(true)
    expect(canShowStartupLamp({ reducedMotion: false })).toBe(true)
  })

  it('renders decorative aria-hidden markup with no focusable controls and spaced classes', () => {
    const showingHtml = renderToStaticMarkup(<StartupLampOverlay fading={false} />)
    expect(showingHtml).toContain('aria-hidden="true"')
    expect(showingHtml).toContain('class="startup-lamp-overlay"')
    expect(showingHtml).not.toContain('tabindex')
    expect(showingHtml).not.toContain('role="button"')
    expect(showingHtml).not.toContain('<button')
    expect(showingHtml).not.toContain('<a ')

    const fadingHtml = renderToStaticMarkup(<StartupLampOverlay fading />)
    expect(fadingHtml).toContain('class="startup-lamp-overlay is-lit"')
  })
})
