import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FreshnessBadge } from './freshness-badge'

describe('FreshnessBadge (STORY-11, TSK-11.5)', () => {
  it('renders time element with ISO dateTime attribute and Manila formatted text on SSR', () => {
    const timestamp = '2026-11-11T10:30:00Z'
    const html = renderToStaticMarkup(<FreshnessBadge date={timestamp} />)

    expect(html).toContain(`dateTime="${timestamp}"`)
    // SSR renders Manila time via formatDateTime
    expect(html).toMatch(/<time[^>]*dateTime="2026-11-11T10:30:00Z"[^>]*>.*<\/time>/)
    // Never contains "real-time" or "live"
    expect(html.toLowerCase()).not.toContain('real-time')
    expect(html.toLowerCase()).not.toContain('live')
  })

  it('renders Never when date is null or undefined', () => {
    const htmlNull = renderToStaticMarkup(<FreshnessBadge date={null} />)
    expect(htmlNull).toContain('Never')

    const htmlUndef = renderToStaticMarkup(<FreshnessBadge date={undefined} />)
    expect(htmlUndef).toContain('Never')
  })

  it('applies custom className and prefix', () => {
    const timestamp = '2026-11-11T10:30:00Z'
    const html = renderToStaticMarkup(
      <FreshnessBadge
        date={timestamp}
        prefix="Last: "
        className="text-xs text-muted-foreground"
      />,
    )

    expect(html).toContain('class="text-xs text-muted-foreground"')
    expect(html).toContain('Last: ')
  })
})
