import { describe, expect, it } from 'vitest'
import { formatCountdown, formatRelative, secondsRemaining } from './countdown'

describe('secondsRemaining (STORY-10, FR-3.3)', () => {
  it('returns the correct seconds for a future deadline', () => {
    const now = new Date('2026-11-14T00:00:00.000Z')
    const deadline = new Date('2026-11-14T00:01:30.000Z') // 90s ahead
    expect(secondsRemaining(deadline, now)).toBe(90)
  })

  it('accepts an ISO string for the deadline', () => {
    const now = new Date('2026-11-14T00:00:00.000Z')
    const deadline = '2026-11-14T00:00:45.000Z'
    expect(secondsRemaining(deadline, now)).toBe(45)
  })

  it('returns 0 for a past deadline (clamps, never negative)', () => {
    const now = new Date('2026-11-14T00:00:30.000Z')
    const deadline = new Date('2026-11-14T00:00:00.000Z')
    expect(secondsRemaining(deadline, now)).toBe(0)
  })

  it('returns 0 when deadline equals now', () => {
    const now = new Date('2026-11-14T00:00:00.000Z')
    expect(secondsRemaining(now, now)).toBe(0)
  })

  it('handles a deadline far in the future correctly', () => {
    const now = new Date('2026-11-14T00:00:00.000Z')
    const deadline = new Date('2026-11-14T00:30:00.000Z') // 1800s
    expect(secondsRemaining(deadline, now)).toBe(1800)
  })

  it('rounds up, so it reaches 0 only once the deadline has passed', () => {
    const now = new Date('2026-11-14T00:00:00.000Z')
    expect(secondsRemaining(new Date('2026-11-14T00:00:00.500Z'), now)).toBe(1)
    expect(secondsRemaining(new Date('2026-11-14T00:00:00.001Z'), now)).toBe(1)
    expect(secondsRemaining(new Date('2026-11-14T00:01:29.500Z'), now)).toBe(90)
    expect(secondsRemaining(new Date('2026-11-13T23:59:59.500Z'), now)).toBe(0)
  })
})

describe('formatCountdown (STORY-10)', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00')
  })

  it('pads single-digit seconds', () => {
    expect(formatCountdown(5)).toBe('00:05')
  })

  it('formats exactly 1 minute', () => {
    expect(formatCountdown(60)).toBe('01:00')
  })

  it('formats minutes and seconds correctly', () => {
    expect(formatCountdown(125)).toBe('02:05')
  })

  it('formats large values: 15 minutes', () => {
    expect(formatCountdown(900)).toBe('15:00')
  })

  it('formats 59 minutes 59 seconds', () => {
    expect(formatCountdown(3599)).toBe('59:59')
  })

  it('handles floating point input by flooring', () => {
    expect(formatCountdown(90.9)).toBe('01:30')
  })

  it('clamps negative input to 00:00', () => {
    expect(formatCountdown(-10)).toBe('00:00')
  })
})

describe('formatRelative (STORY-10, FR-3.3)', () => {
  it('returns "< 1 min" for 0 seconds', () => {
    expect(formatRelative(0)).toBe('< 1 min')
  })

  it('returns "< 1 min" for 1 second', () => {
    expect(formatRelative(1)).toBe('< 1 min')
  })

  it('returns "< 1 min" for 59 seconds', () => {
    expect(formatRelative(59)).toBe('< 1 min')
  })

  it('returns "1 min left" for exactly 60 seconds', () => {
    expect(formatRelative(60)).toBe('1 min left')
  })

  it('rounds up to 2 min left for 61–120 seconds', () => {
    expect(formatRelative(61)).toBe('2 min left')
    expect(formatRelative(90)).toBe('2 min left')
    expect(formatRelative(120)).toBe('2 min left')
  })

  it('returns "60 min left" for 3600 seconds', () => {
    expect(formatRelative(3600)).toBe('60 min left')
  })

  it('clamps negative input to "< 1 min"', () => {
    expect(formatRelative(-5)).toBe('< 1 min')
  })
})
