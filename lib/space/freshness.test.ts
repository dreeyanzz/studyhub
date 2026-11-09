import { describe, expect, it } from 'vitest'

import { formatHostFreshness } from './freshness'

describe('formatHostFreshness', () => {
  const baseTime = new Date('2026-11-09T12:00:00.000Z')

  it('formats < 1 minute ago as "Host-updated · Just now"', () => {
    // 30 seconds ago
    const t30s = new Date(baseTime.getTime() - 30 * 1000)
    expect(formatHostFreshness(t30s, baseTime)).toBe('Host-updated · Just now')

    // 0 seconds ago
    expect(formatHostFreshness(baseTime, baseTime)).toBe('Host-updated · Just now')

    // 59 seconds ago
    const t59s = new Date(baseTime.getTime() - 59 * 1000)
    expect(formatHostFreshness(t59s, baseTime)).toBe('Host-updated · Just now')
  })

  it('formats future timestamps (clock skew) as "Host-updated · Just now"', () => {
    const future = new Date(baseTime.getTime() + 10 * 1000)
    expect(formatHostFreshness(future, baseTime)).toBe('Host-updated · Just now')
  })

  it('formats minutes ago as "Host-updated · X min ago"', () => {
    // exactly 1 minute ago (60 seconds)
    const t1m = new Date(baseTime.getTime() - 60 * 1000)
    expect(formatHostFreshness(t1m, baseTime)).toBe('Host-updated · 1 min ago')

    // 15 minutes ago (test matrix case)
    const t15m = new Date(baseTime.getTime() - 15 * 60 * 1000)
    expect(formatHostFreshness(t15m, baseTime)).toBe('Host-updated · 15 min ago')

    // 59 minutes ago
    const t59m = new Date(baseTime.getTime() - 59 * 60 * 1000)
    expect(formatHostFreshness(t59m, baseTime)).toBe('Host-updated · 59 min ago')
  })

  it('formats hours ago as "Host-updated · X hr ago"', () => {
    // 1 hour ago
    const t1h = new Date(baseTime.getTime() - 60 * 60 * 1000)
    expect(formatHostFreshness(t1h, baseTime)).toBe('Host-updated · 1 hr ago')

    // 3 hours ago (test matrix case)
    const t3h = new Date(baseTime.getTime() - 3 * 60 * 60 * 1000)
    expect(formatHostFreshness(t3h, baseTime)).toBe('Host-updated · 3 hr ago')

    // 23 hours ago
    const t23h = new Date(baseTime.getTime() - 23 * 60 * 60 * 1000)
    expect(formatHostFreshness(t23h, baseTime)).toBe('Host-updated · 23 hr ago')
  })

  it('formats >= 24 hours ago as "Host-updated · X d ago"', () => {
    // 24 hours ago (1 day)
    const t1d = new Date(baseTime.getTime() - 24 * 60 * 60 * 1000)
    expect(formatHostFreshness(t1d, baseTime)).toBe('Host-updated · 1 d ago')

    // 2 days ago (test matrix case)
    const t2d = new Date(baseTime.getTime() - 48 * 60 * 60 * 1000)
    expect(formatHostFreshness(t2d, baseTime)).toBe('Host-updated · 2 d ago')

    // 5 days ago
    const t5d = new Date(baseTime.getTime() - 5 * 24 * 60 * 60 * 1000)
    expect(formatHostFreshness(t5d, baseTime)).toBe('Host-updated · 5 d ago')
  })

  it('accepts ISO string representations', () => {
    const isoString = '2026-11-09T11:45:00.000Z' // 15 mins before 12:00
    expect(formatHostFreshness(isoString, baseTime)).toBe('Host-updated · 15 min ago')
  })

  it('strictly obeys Glossary: output never contains "real-time" or "live"', () => {
    const intervals = [0, 30 * 1000, 15 * 60 * 1000, 3 * 3600 * 1000, 48 * 3600 * 1000]

    for (const interval of intervals) {
      const output = formatHostFreshness(
        new Date(baseTime.getTime() - interval),
        baseTime,
      )
      expect(output.toLowerCase()).not.toContain('real-time')
      expect(output.toLowerCase()).not.toContain('live')
    }
  })
})
