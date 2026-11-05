import { describe, expect, it } from 'vitest'

import { spaceVerificationDecisionSchema, verifySpaceSchema } from './verification'

describe('spaceVerificationDecisionSchema (STORY-15, TSK-15.2)', () => {
  it('accepts verified and rejected', () => {
    expect(spaceVerificationDecisionSchema.safeParse('verified').success).toBe(true)
    expect(spaceVerificationDecisionSchema.safeParse('rejected').success).toBe(true)
  })

  it('refuses pending and arbitrary strings with custom error', () => {
    for (const invalid of ['pending', 'approved', '', 'VERIFIED']) {
      const result = spaceVerificationDecisionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Decision must be either verified or rejected',
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

  it('accepts rejected status with valid UUID and timestamp', () => {
    const result = verifySpaceSchema.safeParse({
      spaceId: validSpaceId,
      status: 'rejected',
      updatedAt: validIsoTimestamp,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('rejected')
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
        'Decision must be either verified or rejected',
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
