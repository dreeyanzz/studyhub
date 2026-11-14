import { describe, expect, it } from 'vitest'

import {
  countdownAnnouncement,
  formatManilaTime,
  formatPeso,
  minutesLeft,
} from './format'

describe('formatPeso', () => {
  it('shows whole centavos as pesos with two decimals', () => {
    expect(formatPeso(5000)).toBe('₱50.00')
    expect(formatPeso(5050)).toBe('₱50.50')
    expect(formatPeso(150000)).toBe('₱1,500.00')
  })
})

describe('formatManilaTime (D-048)', () => {
  it('shows the time in Asia/Manila, whatever the zone of the instant given', () => {
    expect(formatManilaTime('2026-11-14T07:42:00Z')).toBe('3:42 PM')
    expect(formatManilaTime(new Date('2026-11-14T16:05:00Z'))).toBe('12:05 AM')
  })
})

describe('minutesLeft', () => {
  const deadline = '2026-11-14T07:42:00Z'

  it('rounds up, so the last minute reads 1 until the deadline', () => {
    expect(minutesLeft(deadline, new Date('2026-11-14T07:32:00Z'))).toBe(10)
    expect(minutesLeft(deadline, new Date('2026-11-14T07:32:01Z'))).toBe(10)
    expect(minutesLeft(deadline, new Date('2026-11-14T07:41:59Z'))).toBe(1)
  })

  it('is 0 at and after the deadline, never negative', () => {
    expect(minutesLeft(deadline, new Date('2026-11-14T07:42:00Z'))).toBe(0)
    expect(minutesLeft(deadline, new Date('2026-11-14T08:00:00Z'))).toBe(0)
  })
})

describe('countdownAnnouncement (design §3, Accessibility)', () => {
  it('speaks only at 5 minutes, at 1 minute and at the lapse', () => {
    expect(countdownAnnouncement(5)).toBe('5 minutes left to pay.')
    expect(countdownAnnouncement(1)).toBe('1 minute left to pay.')
    expect(countdownAnnouncement(0)).toBe('Your payment window has run out.')
    for (const minutes of [10, 9, 6, 4, 3, 2])
      expect(countdownAnnouncement(minutes)).toBeNull()
  })
})
