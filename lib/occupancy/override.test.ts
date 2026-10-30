import { describe, expect, it } from 'vitest'
import {
  getOverrideCopy,
  isOverrideRequired,
  mapRefusalError,
} from '@/lib/occupancy/override'

describe('getOverrideCopy', () => {
  it('returns status-specific copy for occupied visit (Move R11)', () => {
    const copy = getOverrideCopy('occupied', 'available')
    expect(copy.title).toBe('End this visit?')
    expect(copy.description).toBe(
      'A Seeker is currently checked in at this unit. Setting this state to available will end their visit. Proceed?',
    )
    expect(copy.confirmLabel).toBe('End visit and mark available')
  })

  it('returns status-specific copy for paid reservation hold (Move R9, D-050)', () => {
    const copy = getOverrideCopy('reserved', 'occupied')
    expect(copy.title).toBe('Override active hold?')
    expect(copy.description).toBe(
      'The Seeker has already paid for this hold. Overriding it will cancel their hold and mark this unit occupied, and their fee stays paid until an Administrator refunds it. Proceed?',
    )
    expect(copy.confirmLabel).toBe('Cancel hold and mark occupied')
  })

  it('returns status-specific copy for unpaid pending hold (Move R5)', () => {
    const copy = getOverrideCopy('pending_payment', 'available')
    expect(copy.title).toBe('Override active hold?')
    expect(copy.description).toBe(
      "This unit currently has an unpaid hold. Overriding it will cancel the Seeker's hold and mark this unit available. Proceed?",
    )
    expect(copy.confirmLabel).toBe('Cancel hold and mark available')
  })
})

describe('isOverrideRequired', () => {
  const mockReservationId = '33333333-3333-4333-a333-333333333333'

  it('requires override when unit has active hold and target state differs', () => {
    expect(isOverrideRequired(mockReservationId, 'reserved', 'available')).toBe(true)
    expect(isOverrideRequired(mockReservationId, 'occupied', 'available')).toBe(true)
    expect(isOverrideRequired(mockReservationId, 'pending_payment', 'occupied')).toBe(
      true,
    )
  })

  it('does not require override when unit has no active reservation (Host-set / walk-in)', () => {
    expect(isOverrideRequired(null, 'available', 'occupied')).toBe(false)
    expect(isOverrideRequired(undefined, 'reserved', 'available')).toBe(false)
    expect(isOverrideRequired('', 'occupied', 'available')).toBe(false)
  })

  it('does not require override dialog when tapping same state (no-op or re-vouch)', () => {
    // Held unit same-state tap is a UI no-op (no dialog)
    expect(isOverrideRequired(mockReservationId, 'reserved', 'reserved')).toBe(false)
    // Host-set unit same-state tap directly re-vouches freshness (no dialog)
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
