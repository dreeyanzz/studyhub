import { describe, expect, it } from 'vitest'

import { computeOperatingStatus, formatDateTime, formatOpeningHours } from './format'

describe('formatOpeningHours', () => {
  it('formats standard daytime hours (D-027)', () => {
    expect(formatOpeningHours('08:00:00', '22:00:00')).toBe('08:00 to 22:00')
    expect(formatOpeningHours('09:30:00', '18:00:00')).toBe('09:30 to 18:00')
  })

  it('formats overnight hours closing after midnight (closesAt < opensAt)', () => {
    expect(formatOpeningHours('18:00:00', '02:00:00')).toBe('18:00 to 02:00 next day')
    expect(formatOpeningHours('20:00:00', '05:00:00')).toBe('20:00 to 05:00 next day')
  })

  it('formats 24-hour spaces when opening and closing times match', () => {
    expect(formatOpeningHours('00:00:00', '00:00:00')).toBe('Open 24 hours')
    expect(formatOpeningHours('08:00:00', '08:00:00')).toBe('Open 24 hours')
  })

  it('slices only the first 5 characters (HH:mm) ignoring seconds or form variants', () => {
    expect(formatOpeningHours('08:00:45', '22:00:15')).toBe('08:00 to 22:00')
    expect(formatOpeningHours('10:00', '19:00')).toBe('10:00 to 19:00')
  })
})

describe('formatDateTime', () => {
  it('formats UTC ISO timestamp into localized Philippine time (Asia/Manila)', () => {
    // 2026-11-02 10:00:00 UTC = 2026-11-02 18:00:00 in Manila (+08:00)
    const result = formatDateTime('2026-11-02T10:00:00.000Z')
    expect(result).toBe('Nov 2, 2026, 18:00')
  })

  it('accepts a Date object', () => {
    const date = new Date('2026-11-02T10:00:00.000Z')
    expect(formatDateTime(date)).toBe('Nov 2, 2026, 18:00')
  })

  it('handles microsecond ISO timestamps returned by Postgres', () => {
    // Postgres timestamptz with microseconds
    const isoString = '2026-11-02T10:00:00.123456+00:00'
    expect(formatDateTime(isoString)).toBe('Nov 2, 2026, 18:00')
  })
})

describe('computeOperatingStatus', () => {
  // 2026-11-09T06:00:00Z = 14:00 (2:00 PM) Manila time (+08:00)
  const manila1400 = '2026-11-09T06:00:00.000Z'
  // 2026-11-08T23:00:00Z = 07:00 (7:00 AM) Manila time (+08:00)
  const manila0700 = '2026-11-08T23:00:00.000Z'
  // 2026-11-09T15:00:00Z = 23:00 (11:00 PM) Manila time (+08:00)
  const manila2300 = '2026-11-09T15:00:00.000Z'
  // 2026-11-09T12:00:00Z = 20:00 (8:00 PM) Manila time (+08:00)
  const manila2000 = '2026-11-09T12:00:00.000Z'
  // 2026-11-08T17:30:00Z = 01:30 (1:30 AM) Manila time (+08:00)
  const manila0130 = '2026-11-08T17:30:00.000Z'
  // 2026-11-09T02:00:00Z = 10:00 (10:00 AM) Manila time (+08:00)
  const manila1000 = '2026-11-09T02:00:00.000Z'

  it('identifies 24-hour spaces when opens_at === closes_at (D-027, D-048)', () => {
    const status = computeOperatingStatus('00:00:00', '00:00:00', manila1400)
    expect(status).toEqual({
      isOpen: true,
      displayText: 'Open 24 hours',
      opensAt: '00:00',
      closesAt: '00:00',
      is24Hours: true,
    })

    const statusCustom = computeOperatingStatus('08:00', '08:00', manila0700)
    expect(statusCustom.isOpen).toBe(true)
    expect(statusCustom.displayText).toBe('Open 24 hours')
  })

  it('correctly reports standard daytime open status', () => {
    // 08:00 to 22:00 at 14:00 Manila
    const status = computeOperatingStatus('08:00:00', '22:00:00', manila1400)
    expect(status.isOpen).toBe(true)
    expect(status.displayText).toBe('Open now · Closes at 22:00')
    expect(status.is24Hours).toBe(false)
  })

  it('correctly reports closed status before opening for standard daytime hours', () => {
    // 08:00 to 22:00 at 07:00 Manila
    const status = computeOperatingStatus('08:00:00', '22:00:00', manila0700)
    expect(status.isOpen).toBe(false)
    expect(status.displayText).toBe('Closed · Opens at 08:00')
  })

  it('correctly reports closed status after closing for standard daytime hours (opens tomorrow)', () => {
    // 08:00 to 22:00 at 23:00 Manila
    const status = computeOperatingStatus('08:00:00', '22:00:00', manila2300)
    expect(status.isOpen).toBe(false)
    expect(status.displayText).toBe('Closed · Opens tomorrow at 08:00')
  })

  it('handles overnight hours spanning midnight when open before midnight', () => {
    // 18:00 to 02:00 at 20:00 Manila
    const status = computeOperatingStatus('18:00:00', '02:00:00', manila2000)
    expect(status.isOpen).toBe(true)
    expect(status.displayText).toBe('Open now · Closes at 02:00 next day')
  })

  it('handles overnight hours spanning midnight when open after midnight', () => {
    // 18:00 to 02:00 at 01:30 Manila
    const status = computeOperatingStatus('18:00:00', '02:00:00', manila0130)
    expect(status.isOpen).toBe(true)
    expect(status.displayText).toBe('Open now · Closes at 02:00')
  })

  it('handles overnight hours spanning midnight when closed during daytime', () => {
    // 18:00 to 02:00 at 10:00 Manila
    const status = computeOperatingStatus('18:00:00', '02:00:00', manila1000)
    expect(status.isOpen).toBe(false)
    expect(status.displayText).toBe('Closed · Opens at 18:00')
  })

  it('accepts Date objects directly', () => {
    const date = new Date(manila1400)
    const status = computeOperatingStatus('08:00', '22:00', date)
    expect(status.isOpen).toBe(true)
    expect(status.displayText).toBe('Open now · Closes at 22:00')
  })
})
