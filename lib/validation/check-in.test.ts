import { describe, expect, it } from 'vitest'
import { bookingTokenSchema, checkInSchema, checkOutSchema } from './check-in'

const VALID_UUID = '00000000-0000-4000-8000-000000000001'
// A valid 12-char Crockford token (no I, L, O, U)
const VALID_TOKEN_RAW = 'ABCD-EFGH-JKMN'
const VALID_TOKEN_NORMALIZED = 'ABCDEFGHJKMN'

describe('bookingTokenSchema (STORY-10, D-059)', () => {
  it('accepts a grouped token and returns the normalized form', () => {
    const result = bookingTokenSchema.safeParse(VALID_TOKEN_RAW)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_TOKEN_NORMALIZED)
  })

  it('accepts an already-normalized token', () => {
    const result = bookingTokenSchema.safeParse(VALID_TOKEN_NORMALIZED)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_TOKEN_NORMALIZED)
  })

  it('normalizes ambiguous characters: O→0, I→1, L→1', () => {
    // 'OILABCDEFGHJ' after normalization → '011ABCDEFGHJ' (12 chars, all Crockford)
    const result = bookingTokenSchema.safeParse('OILA BCDE FGHJ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('011ABCDEFGHJ')
  })

  it('normalizes lowercase input', () => {
    const result = bookingTokenSchema.safeParse('abcd-efgh-jkmn')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_TOKEN_NORMALIZED)
  })

  it('rejects an empty string', () => {
    const result = bookingTokenSchema.safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Please enter a booking token'))).toBe(true)
    }
  })

  it('rejects a token that is too short after normalization', () => {
    const result = bookingTokenSchema.safeParse('ABCD')
    expect(result.success).toBe(false)
  })

  it('rejects a token that is too long after normalization', () => {
    const result = bookingTokenSchema.safeParse('ABCDEFGHJKMN99')
    expect(result.success).toBe(false)
  })

  it('rejects tokens containing invalid Crockford characters (U)', () => {
    // U is not in the Crockford alphabet; replace a valid char with U
    const result = bookingTokenSchema.safeParse('ABCDEFGHJKMU')
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(
        messages.some((m) =>
          m.includes(
            'Booking token must be 12 characters from the Crockford base32 alphabet',
          ),
        ),
      ).toBe(true)
    }
  })

  it('rejects a string of only non-alphanumeric characters', () => {
    const result = bookingTokenSchema.safeParse('----====----')
    expect(result.success).toBe(false)
  })
})

describe('checkInSchema (STORY-10)', () => {
  it('accepts a valid spaceId UUID and grouped token', () => {
    const result = checkInSchema.safeParse({
      spaceId: VALID_UUID,
      token: VALID_TOKEN_RAW,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.spaceId).toBe(VALID_UUID)
      expect(result.data.token).toBe(VALID_TOKEN_NORMALIZED)
    }
  })

  it('rejects a non-UUID spaceId', () => {
    const result = checkInSchema.safeParse({
      spaceId: 'not-a-uuid',
      token: VALID_TOKEN_RAW,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid Space ID'))).toBe(true)
    }
  })

  it('rejects an invalid token alongside a valid spaceId', () => {
    const result = checkInSchema.safeParse({
      spaceId: VALID_UUID,
      token: 'tooshort',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(checkInSchema.safeParse({}).success).toBe(false)
    expect(checkInSchema.safeParse({ spaceId: VALID_UUID }).success).toBe(false)
    expect(checkInSchema.safeParse({ token: VALID_TOKEN_RAW }).success).toBe(false)
  })
})

describe('checkOutSchema (STORY-10)', () => {
  it('accepts a valid reservationId UUID', () => {
    const result = checkOutSchema.safeParse({ reservationId: VALID_UUID })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reservationId).toBe(VALID_UUID)
  })

  it('rejects a non-UUID reservationId', () => {
    const result = checkOutSchema.safeParse({ reservationId: 'bad-id' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Invalid reservation ID'))).toBe(true)
    }
  })

  it('rejects missing reservationId', () => {
    expect(checkOutSchema.safeParse({}).success).toBe(false)
  })
})
