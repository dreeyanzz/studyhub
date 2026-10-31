import { describe, expect, it } from 'vitest'
import { setUnitStateSchema, unitStateEnum } from '@/lib/validation/occupancy'

describe('unitStateEnum', () => {
  it('accepts valid host-settable states', () => {
    expect(unitStateEnum.parse('available')).toBe('available')
    expect(unitStateEnum.parse('reserved')).toBe('reserved')
    expect(unitStateEnum.parse('occupied')).toBe('occupied')
  })

  it('rejects pending_payment with custom error (D-004, N12)', () => {
    const result = unitStateEnum.safeParse('pending_payment')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'State must be available, reserved, or occupied',
      )
    }
  })

  it('rejects unknown states and empty strings', () => {
    const emptyResult = unitStateEnum.safeParse('')
    expect(emptyResult.success).toBe(false)

    const unknownResult = unitStateEnum.safeParse('maintenance')
    expect(unknownResult.success).toBe(false)
    if (!unknownResult.success) {
      expect(unknownResult.error.issues[0]?.message).toBe(
        'State must be available, reserved, or occupied',
      )
    }
  })
})

describe('setUnitStateSchema', () => {
  const validUnitId = '11111111-1111-4111-a111-111111111111'
  const validReservationId = '22222222-2222-4222-a222-222222222222'

  it('accepts valid state update without hold context (walk-in / Host tap)', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'occupied',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitId).toBe(validUnitId)
      expect(result.data.state).toBe('occupied')
      expect(result.data.expectedReservationId).toBeUndefined()
      expect(result.data.expectedReservationStatus).toBeUndefined()
    }
  })

  it('accepts explicit null for reservation fields', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'available',
      expectedReservationId: null,
      expectedReservationStatus: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid hold override when both reservation fields are present (D-050)', () => {
    const statuses = ['pending_payment', 'reserved', 'occupied'] as const

    for (const status of statuses) {
      const result = setUnitStateSchema.safeParse({
        unitId: validUnitId,
        state: 'available',
        expectedReservationId: validReservationId,
        expectedReservationStatus: status,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.expectedReservationId).toBe(validReservationId)
        expect(result.data.expectedReservationStatus).toBe(status)
      }
    }
  })

  it('rejects invalid unit ID with descriptive error message', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: 'not-a-uuid',
      state: 'available',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid unit ID')
    }
  })

  it('rejects invalid state with custom enum error message', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'pending_payment',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'State must be available, reserved, or occupied',
      )
    }
  })

  it('rejects half-named override with reservation ID but missing status', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'available',
      expectedReservationId: validReservationId,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const pairingIssue = result.error.issues.find((issue) =>
        issue.message.includes(
          'Expected reservation ID and status must be provided together',
        ),
      )
      expect(pairingIssue).toBeDefined()
      expect(pairingIssue?.path).toContain('expectedReservationId')
    }
  })

  it('rejects half-named override with status but missing reservation ID', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'available',
      expectedReservationStatus: 'reserved',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const pairingIssue = result.error.issues.find((issue) =>
        issue.message.includes(
          'Expected reservation ID and status must be provided together',
        ),
      )
      expect(pairingIssue).toBeDefined()
      expect(pairingIssue?.path).toContain('expectedReservationId')
    }
  })

  it('rejects invalid reservation UUID', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'available',
      expectedReservationId: 'invalid-reservation-uuid',
      expectedReservationStatus: 'reserved',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid reservation ID')
    }
  })

  it('rejects invalid expected reservation status', () => {
    const result = setUnitStateSchema.safeParse({
      unitId: validUnitId,
      state: 'available',
      expectedReservationId: validReservationId,
      expectedReservationStatus: 'cancelled',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid expected reservation status')
    }
  })
})
