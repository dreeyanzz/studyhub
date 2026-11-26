import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { AUTO_REFRESH_MS, SeatMapRefresh } from './seat-map-refresh'

describe('SeatMapRefresh (STORY-17)', () => {
  it('renders a wrapping 48px+ Refresh availability button and auto-refresh note', () => {
    const html = renderToStaticMarkup(<SeatMapRefresh />)

    expect(html).toContain(
      'Availability refreshes automatically while this page is open.',
    )
    expect(html).toContain('Refresh availability')
    expect(html).toContain('min-h-12')
    expect(html).toContain('whitespace-normal')
    expect(html).not.toContain('whitespace-nowrap')
  })

  it('uses a 30-second auto-refresh interval', () => {
    expect(AUTO_REFRESH_MS).toBe(30_000)
  })
})
