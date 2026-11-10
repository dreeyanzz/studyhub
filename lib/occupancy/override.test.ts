import { describe, expect, it } from 'vitest'
import {
  formatStateLabel,
  getOverrideCopy,
  isOverrideRequired,
  mapRefusalError,
  tapOutcome,
  toSetUnitStateInput,
} from '@/lib/occupancy/override'

describe('formatStateLabel', () => {
  it('formats state enum values to display labels matching the glossary and UI pills', () => {
    expect(formatStateLabel('available')).toBe('Available')
    expect(formatStateLabel('reserved')).toBe('Reserved')
    expect(formatStateLabel('occupied')).toBe('Occupied')
  })
})

describe('getOverrideCopy', () => {
  it('returns status-specific copy with capitalized target state for occupied visit (Move R11)', () => {
    const copy = getOverrideCopy('occupied', 'available')
    expect(copy.title).toBe('End this visit?')
    expect(copy.description).toBe(
      'A Seeker is currently checked in at this unit. Setting this state to Available will end their visit. Proceed?',
    )
    expect(copy.confirmLabel).toBe('End visit and mark Available')
  })

  it('returns status-specific copy with capitalized target state for paid reservation hold (Move R9, D-050)', () => {
    const copy = getOverrideCopy('reserved', 'occupied')
    expect(copy.title).toBe('Override active hold?')
    expect(copy.description).toBe(
      'The Seeker has already paid for this hold. Overriding it will cancel their hold and mark this unit Occupied, and their fee stays paid until an Administrator refunds it. Proceed?',
    )
    expect(copy.confirmLabel).toBe('Cancel hold and mark Occupied')
  })

  it('returns status-specific copy with capitalized target state for unpaid pending hold (Move R5)', () => {
    const copy = getOverrideCopy('pending_payment', 'available')
    expect(copy.title).toBe('Override active hold?')
    expect(copy.description).toBe(
      "This unit currently has an unpaid hold. Overriding it will cancel the Seeker's hold and mark this unit Available. Proceed?",
    )
    expect(copy.confirmLabel).toBe('Cancel hold and mark Available')
  })
})

describe('tapOutcome', () => {
  const mockReservationId = '33333333-3333-4333-a333-333333333333'

  it('returns confirm_override for a Seeker-held unit tapped with a different state', () => {
    expect(tapOutcome(mockReservationId, 'reserved', 'available')).toBe(
      'confirm_override',
    )
    expect(tapOutcome(mockReservationId, 'occupied', 'available')).toBe(
      'confirm_override',
    )
    expect(tapOutcome(mockReservationId, 'pending_payment', 'occupied')).toBe(
      'confirm_override',
    )
  })

  it('returns no_op for a Seeker-held unit tapped with the same state (Maria UX requirement)', () => {
    expect(tapOutcome(mockReservationId, 'reserved', 'reserved')).toBe('no_op')
    expect(tapOutcome(mockReservationId, 'occupied', 'occupied')).toBe('no_op')
  })

  it('returns set_state for a Host-set unit tapped with the same state (re-vouch freshness, Move H2, D-051)', () => {
    expect(tapOutcome(null, 'occupied', 'occupied')).toBe('set_state')
    expect(tapOutcome(undefined, 'available', 'available')).toBe('set_state')
    expect(tapOutcome(null, 'reserved', 'reserved')).toBe('set_state')
  })

  it('returns set_state for a Host-set unit tapped with a different state (walk-in or Host transition)', () => {
    expect(tapOutcome(null, 'available', 'occupied')).toBe('set_state')
    expect(tapOutcome(undefined, 'available', 'reserved')).toBe('set_state')
    expect(tapOutcome(null, 'occupied', 'available')).toBe('set_state')
  })
})

describe('isOverrideRequired', () => {
  const mockReservationId = '33333333-3333-4333-a333-333333333333'

  it('returns true only when tapOutcome is confirm_override', () => {
    expect(isOverrideRequired(mockReservationId, 'reserved', 'available')).toBe(true)
    expect(isOverrideRequired(mockReservationId, 'reserved', 'reserved')).toBe(false)
    expect(isOverrideRequired(null, 'available', 'occupied')).toBe(false)
    expect(isOverrideRequired(null, 'occupied', 'occupied')).toBe(false)
  })
})

describe('mapRefusalError', () => {
  it('maps 42501 permission refusal (Negative N13, N24)', () => {
    expect(mapRefusalError('42501', null)).toBe(
      'Space may no longer exist or you may not have access.',
    )
  })

  it('maps P0001 hold_not_named refusal (Negative N14)', () => {
    expect(mapRefusalError('P0001', 'hold_not_named')).toBe(
      'A Seeker has just held this unit. Please review the hold.',
    )
  })

  it('maps P0001 hold_changed refusal (Negative N21)', () => {
    expect(mapRefusalError('P0001', 'hold_changed')).toBe(
      'Hold status has changed. Please refresh.',
    )
  })

  it('maps unexpected database errors or network failures to generic message', () => {
    expect(mapRefusalError('P0001', 'unexpected_hint')).toBe(
      'We could not save that change. Check your connection and try again.',
    )
    expect(mapRefusalError(undefined, undefined)).toBe(
      'We could not save that change. Check your connection and try again.',
    )
    expect(mapRefusalError('500', null)).toBe(
      'We could not save that change. Check your connection and try again.',
    )
  })
})

describe('toSetUnitStateInput', () => {
  const mockUnitId = '11111111-1111-4111-a111-111111111111'
  const mockReservationId = '22222222-2222-4222-a222-222222222222'

  it('names reservation ID and hold status for confirmed override on held units', () => {
    // S2 pending_payment -> available (R5)
    expect(
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'pending_payment',
          reservationId: mockReservationId,
        },
        'available',
        { override: true },
      ),
    ).toEqual({
      unitId: mockUnitId,
      state: 'available',
      expectedReservationId: mockReservationId,
      expectedReservationStatus: 'pending_payment',
    })

    // S3 reserved -> occupied (R9)
    expect(
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'reserved',
          reservationId: mockReservationId,
        },
        'occupied',
        { override: true },
      ),
    ).toEqual({
      unitId: mockUnitId,
      state: 'occupied',
      expectedReservationId: mockReservationId,
      expectedReservationStatus: 'reserved',
    })

    // S4 occupied -> available (R11)
    expect(
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'occupied',
          reservationId: mockReservationId,
        },
        'available',
        { override: true },
      ),
    ).toEqual({
      unitId: mockUnitId,
      state: 'available',
      expectedReservationId: mockReservationId,
      expectedReservationStatus: 'occupied',
    })
  })

  it('omits expected reservation fields for direct Host-set taps', () => {
    // Direct tap without override option
    expect(
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'available',
          reservationId: null,
        },
        'occupied',
      ),
    ).toEqual({
      unitId: mockUnitId,
      state: 'occupied',
      expectedReservationId: undefined,
      expectedReservationStatus: undefined,
    })

    // Explicit override: false
    expect(
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'occupied',
          reservationId: null,
        },
        'available',
        { override: false },
      ),
    ).toEqual({
      unitId: mockUnitId,
      state: 'available',
      expectedReservationId: undefined,
      expectedReservationStatus: undefined,
    })
  })

  it('throws an error if override is requested on an available unit', () => {
    expect(() =>
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'available',
          reservationId: mockReservationId,
        },
        'occupied',
        { override: true },
      ),
    ).toThrow('Cannot override a unit with seatState "available"')
  })

  it('throws an error if override is requested without a reservationId', () => {
    expect(() =>
      toSetUnitStateInput(
        {
          id: mockUnitId,
          seatState: 'reserved',
          reservationId: null,
        },
        'available',
        { override: true },
      ),
    ).toThrow('Cannot override a hold without a reservationId')
  })
})
