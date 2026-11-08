import { describe, expect, it } from 'vitest'

import { calculateRelativeTime } from './relative-time'

describe('calculateRelativeTime (STORY-12 design §3, D-002)', () => {
  const baseTime = new Date('2026-11-08T12:00:00Z').getTime()

  it('returns "recently" when dateString is invalid or cannot be parsed', () => {
    expect(calculateRelativeTime('not-a-date', baseTime)).toBe('recently')
    expect(calculateRelativeTime('', baseTime)).toBe('recently')
  })

  it('returns "just now" for future timestamps or timestamps under 1 minute ago', () => {
    // 30 seconds into the future
    const futureDate = new Date(baseTime + 30_000).toISOString()
    expect(calculateRelativeTime(futureDate, baseTime)).toBe('just now')

    // Exact same time
    const sameDate = new Date(baseTime).toISOString()
    expect(calculateRelativeTime(sameDate, baseTime)).toBe('just now')

    // 45 seconds ago
    const recentDate = new Date(baseTime - 45_000).toISOString()
    expect(calculateRelativeTime(recentDate, baseTime)).toBe('just now')
  })

  it('returns formatted minutes for timestamps under 1 hour ago', () => {
    const oneMinAgo = new Date(baseTime - 60_000).toISOString()
    expect(calculateRelativeTime(oneMinAgo, baseTime)).toBe('1 min ago')

    const twentyMinAgo = new Date(baseTime - 20 * 60_000).toISOString()
    expect(calculateRelativeTime(twentyMinAgo, baseTime)).toBe('20 min ago')

    const fiftyNineMinAgo = new Date(baseTime - 59 * 60_000).toISOString()
    expect(calculateRelativeTime(fiftyNineMinAgo, baseTime)).toBe('59 min ago')
  })

  it('returns formatted hours for timestamps between 1 and 24 hours ago', () => {
    const oneHourAgo = new Date(baseTime - 60 * 60_000).toISOString()
    expect(calculateRelativeTime(oneHourAgo, baseTime)).toBe('1 hr ago')

    const twoHoursAgo = new Date(baseTime - 2 * 60 * 60_000).toISOString()
    expect(calculateRelativeTime(twoHoursAgo, baseTime)).toBe('2 hrs ago')

    const twentyThreeHoursAgo = new Date(baseTime - 23 * 60 * 60_000).toISOString()
    expect(calculateRelativeTime(twentyThreeHoursAgo, baseTime)).toBe('23 hrs ago')
  })

  it('returns formatted days for timestamps 24 hours or older', () => {
    const oneDayAgo = new Date(baseTime - 24 * 60 * 60_000).toISOString()
    expect(calculateRelativeTime(oneDayAgo, baseTime)).toBe('1 day ago')

    const threeDaysAgo = new Date(baseTime - 3 * 24 * 60 * 60_000).toISOString()
    expect(calculateRelativeTime(threeDaysAgo, baseTime)).toBe('3 days ago')
  })
})
