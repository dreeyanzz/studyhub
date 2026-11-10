import { describe, expect, it } from 'vitest'
import {
  cancelHoldSchema,
  formatWaitWindow,
  holdUnitSchema,
  parseIntervalToMinutes,
  WAIT_WINDOW_MINUTES,
  waitWindowMinutesSchema,
} from './reservation'

describe('waitWindowMinutesSchema (STORY-09 design §2, D-067)', () => {
  it.each(WAIT_WINDOW_MINUTES)('passes valid wait window of %d minutes', (minutes) => {
    expect(waitWindowMinutesSchema.safeParse(minutes).success).toBe(true)
    expect(waitWindowMinutesSchema.safeParse(String(minutes)).success).toBe(true)
  })

  it.each([0, 10, 20, 50, 70, 135, 180, -15])(
    'fails invalid wait window of %d minutes',
    (minutes) => {
      const result = waitWindowMinutesSchema.safeParse(minutes)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Wait window must be between 15 and 120 minutes in 15-minute steps.',
        )
      }
    },
  )

  it('fails non-numeric strings', () => {
    expect(waitWindowMinutesSchema.safeParse('not-a-number').success).toBe(false)
    expect(waitWindowMinutesSchema.safeParse('').success).toBe(false)
  })
})

describe('formatWaitWindow', () => {
  it('formats minutes into human-readable strings', () => {
    expect(formatWaitWindow(15)).toBe('15 min')
    expect(formatWaitWindow(30)).toBe('30 min')
    expect(formatWaitWindow(45)).toBe('45 min')
    expect(formatWaitWindow(60)).toBe('1 hr')
    expect(formatWaitWindow(75)).toBe('1 hr 15 min')
    expect(formatWaitWindow(90)).toBe('1 hr 30 min')
    expect(formatWaitWindow(105)).toBe('1 hr 45 min')
    expect(formatWaitWindow(120)).toBe('2 hr')
  })
})

describe('parseIntervalToMinutes', () => {
  it('parses PostgreSQL HH:MM:SS format', () => {
    expect(parseIntervalToMinutes('00:15:00')).toBe(15)
    expect(parseIntervalToMinutes('00:30:00')).toBe(30)
    expect(parseIntervalToMinutes('00:45:00')).toBe(45)
    expect(parseIntervalToMinutes('01:00:00')).toBe(60)
    expect(parseIntervalToMinutes('01:15:00')).toBe(75)
    expect(parseIntervalToMinutes('01:30:00')).toBe(90)
    expect(parseIntervalToMinutes('01:45:00')).toBe(105)
    expect(parseIntervalToMinutes('02:00:00')).toBe(120)
  })

  it('parses text formats and numbers', () => {
    expect(parseIntervalToMinutes('60 minutes')).toBe(60)
    expect(parseIntervalToMinutes('1 hour')).toBe(60)
    expect(parseIntervalToMinutes('1 hr 15 min')).toBe(75)
    expect(parseIntervalToMinutes('2 hours')).toBe(120)
    expect(parseIntervalToMinutes('60 mins')).toBe(60)
    expect(parseIntervalToMinutes('@ 1 hour 15 mins')).toBe(75)
    expect(parseIntervalToMinutes('01:15:00.000000')).toBe(75)
    expect(parseIntervalToMinutes('00:30:00.123')).toBe(30)
    expect(parseIntervalToMinutes('PT1H')).toBe(60)
    expect(parseIntervalToMinutes('PT15M')).toBe(15)
    expect(parseIntervalToMinutes(45)).toBe(45)
  })

  it('falls back to 60 for missing or invalid values', () => {
    expect(parseIntervalToMinutes(null)).toBe(60)
    expect(parseIntervalToMinutes(undefined)).toBe(60)
    expect(parseIntervalToMinutes('')).toBe(60)
    expect(parseIntervalToMinutes('invalid')).toBe(60)
    expect(parseIntervalToMinutes(0)).toBe(60)
    expect(parseIntervalToMinutes(-15)).toBe(60)
    expect(parseIntervalToMinutes(Number.NaN)).toBe(60)
  })
})

describe('holdUnitSchema & cancelHoldSchema', () => {
  it('passes valid holdUnit input', () => {
    const valid = {
      spaceId: 'e0000000-0000-4000-8000-000000000001',
      unitId: 'f0000000-0000-4000-8000-000000000001',
      waitWindowMinutes: '60',
    }
    const result = holdUnitSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.waitWindowMinutes).toBe(60)
    }
  })

  it('passes valid cancelHold input', () => {
    const valid = {
      reservationId: 'a0000000-0000-4000-8000-000000000001',
      expectedStatus: 'pending_payment',
    }
    expect(cancelHoldSchema.safeParse(valid).success).toBe(true)

    const reserved = {
      ...valid,
      expectedStatus: 'reserved',
    }
    expect(cancelHoldSchema.safeParse(reserved).success).toBe(true)

    const invalid = {
      ...valid,
      expectedStatus: 'occupied',
    }
    expect(cancelHoldSchema.safeParse(invalid).success).toBe(false)
  })
})
