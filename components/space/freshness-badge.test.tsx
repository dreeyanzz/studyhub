import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { formatDateTime } from '@/lib/space/format'
import { FreshnessBadge, formatFreshnessLabel } from './freshness-badge'

describe('FreshnessBadge (STORY-11, TSK-11.5)', () => {
  it('renders time element with ISO dateTime attribute and Manila formatted text on SSR', () => {
    const timestamp = '2026-11-11T10:30:00Z'
    const html = renderToStaticMarkup(<FreshnessBadge date={timestamp} />)

    expect(html).toContain(`dateTime="${timestamp}"`)
    // SSR renders Manila time via formatDateTime
    expect(html).toContain(formatDateTime(timestamp))
    expect(html).toMatch(/<time[^>]*dateTime="2026-11-11T10:30:00Z"[^>]*>.*<\/time>/)
    // Never contains "real-time" or "live"
    expect(html.toLowerCase()).not.toContain('real-time')
    expect(html.toLowerCase()).not.toContain('live')
  })

  it('formats Manila time when now is 0 (SSR) and relative freshness after mount', () => {
    const timestamp = '2026-11-11T10:30:00Z'
    expect(formatFreshnessLabel(timestamp, 0)).toBe(formatDateTime(timestamp))

    const thirtyMinutesLater = new Date('2026-11-11T11:00:00Z').getTime()
    expect(formatFreshnessLabel(timestamp, thirtyMinutesLater)).toBe(
      'Host-updated · 30 min ago',
    )
    expect(formatFreshnessLabel(null, thirtyMinutesLater)).toBe('Never')
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
