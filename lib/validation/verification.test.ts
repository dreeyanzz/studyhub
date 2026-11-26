import { describe, expect, it } from 'vitest'

import {
  SPACE_STATUS_REASON_MAX_LENGTH,
  spaceStatusReasonSchema,
  spaceVerificationDecisionSchema,
  verificationQueueTabSchema,
  verifySpaceSchema,
} from './verification'

describe('spaceVerificationDecisionSchema (STORY-15, TSK-15.2)', () => {
  it('accepts verified, rejected and taken_down', () => {
    expect(spaceVerificationDecisionSchema.safeParse('taken_down').success).toBe(true)
    expect(spaceVerificationDecisionSchema.safeParse('verified').success).toBe(true)
    expect(spaceVerificationDecisionSchema.safeParse('rejected').success).toBe(true)
  })

  it('refuses pending and arbitrary strings with custom error', () => {
    for (const invalid of ['pending', 'approved', '', 'VERIFIED']) {
      const result = spaceVerificationDecisionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Decision must be verified, rejected or taken down',
        )
      }
    }
  })
})

describe('verifySpaceSchema (STORY-15, TSK-15.2)', () => {
  const validSpaceId = 'e0000000-0000-4000-8000-000000000002'
  const validIsoTimestamp = '2026-11-02T19:17:57.235481+00:00'

  it('accepts verified status with valid UUID and microsecond timestamp', () => {
    const result = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'verified',
      updatedAt: validIsoTimestamp,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.spaceId).toBe(validSpaceId)
      expect(result.data.status).toBe('verified')
      expect(result.data.updatedAt).toBe(validIsoTimestamp)
    }
  })

  it('accepts rejected status with valid UUID, timestamp and reason', () => {
    const result = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'rejected',
      updatedAt: validIsoTimestamp,
      reason: 'The photos show a different building.',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('rejected')
      expect(result.data.reason).toBe('The photos show a different building.')
    }
  })

  it('refuses pending as target status', () => {
    const result = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'pending',
      updatedAt: validIsoTimestamp,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Decision must be verified, rejected or taken down',
      )
    }
  })

  it('refuses invalid spaceId (non-UUID)', () => {
    const result = verifySpaceSchema.safeParse({
      spaceId: 'not-a-uuid',
      status: 'verified',
      updatedAt: validIsoTimestamp,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('We could not find that Space.')
    }
  })

  it('refuses non-ISO date strings such as "yesterday" or whitespace', () => {
    for (const invalidDate of ['yesterday', '   ', 'not-a-date']) {
      const result = verifySpaceSchema.safeParse({
        spaceId: validSpaceId,
        status: 'verified',
        updatedAt: invalidDate,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Timestamp is required for verification',
        )
      }
    }
  })

  it('refuses missing or empty updatedAt', () => {
    const emptyResult = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'verified',
      updatedAt: '',
    })
    expect(emptyResult.success).toBe(false)
    if (!emptyResult.success) {
      expect(emptyResult.error.issues[0]?.message).toBe(
        'Timestamp is required for verification',
      )
    }

    const missingResult = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'verified',
    })
    expect(missingResult.success).toBe(false)
    if (!missingResult.success) {
      expect(missingResult.error.issues[0]?.message).toBe(
        'Timestamp is required for verification',
      )
    }
  })
})

describe('a rejection reason (STORY-20, TSK-20.1, N10)', () => {
  const base = {
    spaceId: 'e0000000-0000-4000-8000-000000000002',
    updatedAt: '2026-11-02T19:17:57.235481+00:00',
  }

  it('trims the reason, as the database does', () => {
    const result = verifySpaceSchema.safeParse({
      ...base,
      status: 'rejected',
      reason: '  The address is incomplete.\n ',
    })
    expect(result.success && result.data.reason).toBe('The address is incomplete.')
  })

  it('refuses a rejection with no reason, or only spaces', () => {
    for (const reason of [undefined, '', '   \n\t ']) {
      const result = verifySpaceSchema.safeParse({ ...base, status: 'rejected', reason })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toEqual([
          expect.objectContaining({
            path: ['reason'],
            message: 'Enter a reason before continuing.',
          }),
        ])
      }
    }
  })

  it('takes 500 characters after trimming, and refuses 501', () => {
    const fits = verifySpaceSchema.safeParse({
      ...base,
      status: 'rejected',
      reason: `  ${'x'.repeat(SPACE_STATUS_REASON_MAX_LENGTH)}  `,
    })
    expect(fits.success).toBe(true)

    const tooLong = verifySpaceSchema.safeParse({
      ...base,
      status: 'rejected',
      reason: 'x'.repeat(SPACE_STATUS_REASON_MAX_LENGTH + 1),
    })
    expect(tooLong.success).toBe(false)
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]).toMatchObject({
        path: ['reason'],
        message: 'Reason must be 500 characters or fewer.',
      })
    }
  })

  it('drops a reason sent with an approval, which the database ignores', () => {
    const result = verifySpaceSchema.safeParse({
      ...base,
      status: 'verified',
      reason: 'Looks fine',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBeUndefined()
  })

  it('spaceStatusReasonSchema refuses a value that is not text', () => {
    expect(spaceStatusReasonSchema.safeParse(42).success).toBe(false)
  })
})

describe('a take-down reason (STORY-20, TSK-20.3, V7, N10)', () => {
  const base = {
    spaceId: 'e0000000-0000-4000-8000-000000000002',
    updatedAt: '2026-11-02T19:17:57.235481+00:00',
    status: 'taken_down' as const,
  }

  it('trims and keeps the reason', () => {
    const result = verifySpaceSchema.safeParse({
      ...base,
      reason: '  Closed for repairs. ',
    })
    expect(result.success && result.data.reason).toBe('Closed for repairs.')
  })

  it('refuses a take-down with no reason', () => {
    const result = verifySpaceSchema.safeParse({ ...base, reason: '  ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['reason'])
  })
})

describe('verificationQueueTabSchema (STORY-20, TSK-20.3)', () => {
  it('accepts the four lists', () => {
    for (const tab of ['pending', 'verified', 'rejected', 'taken_down']) {
      expect(verificationQueueTabSchema.parse(tab)).toBe(tab)
    }
  })

  it('falls back to pending for a missing or unknown tab', () => {
    for (const tab of [undefined, '', 'archived', 'PENDING', ['verified']]) {
      expect(verificationQueueTabSchema.parse(tab)).toBe('pending')
    }
  })
})
