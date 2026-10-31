import type { ExpectedReservationStatus, UnitState } from '@/lib/validation/occupancy'

export type TapOutcome = 'no_op' | 'confirm_override' | 'set_state'

export type SeatState = 'available' | 'pending_payment' | 'reserved' | 'occupied'

export interface OverrideCopy {
  title: string
  description: string
  confirmLabel: string
}

const STATE_LABELS: Record<UnitState, string> = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'Occupied',
}

/**
 * Returns the human-readable display label for a host-settable unit state.
 */
export function formatStateLabel(state: UnitState): string {
  return STATE_LABELS[state]
}

/**
 * Returns status-specific title, description, and action button copy
 * for the Host override confirmation dialog (STORY-12 design §3, R5, R9, R11).
 */
export function getOverrideCopy(
  status: ExpectedReservationStatus,
  targetState: UnitState,
): OverrideCopy {
  const label = formatStateLabel(targetState)
  switch (status) {
    case 'occupied':
      return {
        title: 'End this visit?',
        description: `A Seeker is currently checked in at this unit. Setting this state to ${label} will end their visit. Proceed?`,
        confirmLabel: `End visit and mark ${label}`,
      }
    case 'reserved':
      return {
        title: 'Override active hold?',
        description: `The Seeker has already paid for this hold. Overriding it will cancel their hold and mark this unit ${label}, and their fee stays paid until an Administrator refunds it. Proceed?`,
        confirmLabel: `Cancel hold and mark ${label}`,
      }
    case 'pending_payment':
      return {
        title: 'Override active hold?',
        description: `This unit currently has an unpaid hold. Overriding it will cancel the Seeker's hold and mark this unit ${label}. Proceed?`,
        confirmLabel: `Cancel hold and mark ${label}`,
      }
  }
}

/**
 * Determines the concrete outcome when a Host taps a state button on a unit (STORY-12 design §3, D-050, D-051).
 *
 * Outcomes:
 * - 'no_op': Same-state tap on a Seeker-held unit ignores the tap (no dialog, no Server Action).
 * - 'confirm_override': Different-state tap on a Seeker-held unit requires explicit confirmation.
 * - 'set_state': Tap on a Host-set unit saves state directly (including same-state re-vouch for freshness).
 */
export function tapOutcome(
  reservationId: string | null | undefined,
  currentState: SeatState,
  targetState: UnitState,
): TapOutcome {
  if (reservationId) {
    return currentState === targetState ? 'no_op' : 'confirm_override'
  }
  return 'set_state'
}

/**
 * Convenience helper returning whether the tap requires opening the override confirmation dialog.
 */
export function isOverrideRequired(
  reservationId: string | null | undefined,
  currentState: SeatState,
  targetState: UnitState,
): boolean {
  return tapOutcome(reservationId, currentState, targetState) === 'confirm_override'
}

/**
 * Maps Postgres refusal codes and hints from public.set_unit_state to user-facing messages
 * (STORY-12 design §2, §3, Negative tests N13, N14, N21).
 */
export function mapRefusalError(
  code: string | undefined | null,
  hint: string | undefined | null,
): string {
  if (code === '42501') {
    return 'Space may no longer exist or you may not have access.'
  }
  if (code === 'P0001' && hint === 'hold_not_named') {
    return 'A Seeker has just held this unit. Please review the hold.'
  }
  if (code === 'P0001' && hint === 'hold_changed') {
    return 'Hold status has changed. Please refresh.'
  }
  return 'We could not save that change. Check your connection and try again.'
}
