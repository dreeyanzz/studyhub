import { describe, expect, it } from 'vitest'

import {
  formatCreationDate,
  formatDateTime,
  formatOpeningHours,
  hoursText,
} from './format'

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

  it('hoursText alias behaves identically to formatOpeningHours', () => {
    expect(hoursText('08:00:00', '22:00:00')).toBe(
      formatOpeningHours('08:00:00', '22:00:00'),
    )
    expect(hoursText('18:00:00', '02:00:00')).toBe(
      formatOpeningHours('18:00:00', '02:00:00'),
    )
    expect(hoursText('00:00:00', '00:00:00')).toBe(
      formatOpeningHours('00:00:00', '00:00:00'),
    )
  })
})

describe('formatCreationDate and formatDateTime', () => {
  it('formats UTC ISO timestamp into localized Philippine time (Asia/Manila)', () => {
    // 2026-11-02 10:00:00 UTC = 2026-11-02 18:00:00 in Manila (+08:00)
    const result = formatCreationDate('2026-11-02T10:00:00.000Z')
    expect(result).toBe('Nov 2, 2026, 18:00')
  })

  it('accepts a Date object', () => {
    const date = new Date('2026-11-02T10:00:00.000Z')
    expect(formatCreationDate(date)).toBe('Nov 2, 2026, 18:00')
  })

  it('handles microsecond ISO timestamps returned by Postgres', () => {
    // Postgres timestamptz with microseconds
    const isoString = '2026-11-02T10:00:00.123456+00:00'
    expect(formatCreationDate(isoString)).toBe('Nov 2, 2026, 18:00')
  })

  it('formatDateTime alias produces the exact same output', () => {
    const isoString = '2026-11-02T10:00:00.000Z'
    expect(formatDateTime(isoString)).toBe(formatCreationDate(isoString))
  })
})
