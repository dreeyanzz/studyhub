import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  canShowStartupLamp,
  markStartupLampPlayed,
  STARTUP_LAMP_STORAGE_KEY,
  StartupLamp,
  StartupLampOverlay,
} from './startup-lamp'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

describe('StartupLamp (STORY-17 TSK-17.2)', () => {
  it('renders nothing on SSR so no-JS visitors and first paint are never blocked', () => {
    expect(renderToStaticMarkup(<StartupLamp />)).toBe('')
  })

  it('skips the overlay when prefers-reduced-motion is enabled', () => {
    const storage = createMemoryStorage()
    expect(canShowStartupLamp({ reducedMotion: true, storage })).toBe(false)
  })

  it('skips the overlay when the session flag is already set', () => {
    const storage = createMemoryStorage({ [STARTUP_LAMP_STORAGE_KEY]: '1' })
    expect(canShowStartupLamp({ reducedMotion: false, storage })).toBe(false)
  })

  it('skips the overlay when sessionStorage is unavailable or throws', () => {
    expect(canShowStartupLamp({ reducedMotion: false, storage: null })).toBe(false)

    const blockedRead = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
    }
    expect(canShowStartupLamp({ reducedMotion: false, storage: blockedRead })).toBe(false)

    const blockedWrite = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(markStartupLampPlayed(blockedWrite)).toBe(false)
    expect(markStartupLampPlayed(null)).toBe(false)
  })

  it('allows the overlay once per session and blocks subsequent views after marking', () => {
    const storage = createMemoryStorage()
    expect(canShowStartupLamp({ reducedMotion: false, storage })).toBe(true)
    expect(markStartupLampPlayed(storage)).toBe(true)
    expect(storage.getItem(STARTUP_LAMP_STORAGE_KEY)).toBe('1')
    expect(canShowStartupLamp({ reducedMotion: false, storage })).toBe(false)
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
