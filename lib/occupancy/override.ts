import type { ExpectedReservationStatus, UnitState } from '@/lib/validation/occupancy'

export interface OverrideCopy {
  title: string
  description: string
  confirmLabel: string
}

/**
 * Returns status-specific title, description, and action button copy
 * for the Host override confirmation dialog (STORY-12 design §3, R5, R9, R11).
 */
export function getOverrideCopy(
  status: ExpectedReservationStatus,
  targetState: UnitState,
): OverrideCopy {
  switch (status) {
    case 'occupied':
      return {
        title: 'End this visit?',
        description: `A Seeker is currently checked in at this unit. Setting this state to ${targetState} will end their visit. Proceed?`,
        confirmLabel: `End visit and mark ${targetState}`,
      }
    case 'reserved':
      return {
        title: 'Override active hold?',
        description: `The Seeker has already paid for this hold. Overriding it will cancel their hold and mark this unit ${targetState}, and their fee stays paid until an Administrator refunds it. Proceed?`,
        confirmLabel: `Cancel hold and mark ${targetState}`,
      }
    case 'pending_payment':
      return {
        title: 'Override active hold?',
        description: `This unit currently has an unpaid hold. Overriding it will cancel the Seeker's hold and mark this unit ${targetState}. Proceed?`,
        confirmLabel: `Cancel hold and mark ${targetState}`,
      }
  }
}

/**
 * Determines whether tapping a target state requires the Host override confirmation dialog (D-050).
 *
 * An override dialog is only shown when:
 * 1. The unit has an active Seeker hold (`reservationId` is present, D-057).
 * 2. The Host is attempting to transition to a *different* state (`targetState !== currentState`).
 *
 * Same-state tap on a held unit is a no-op (no dialog, no Server Action).
 * Same-state tap on a Host-set unit re-vouches freshness without a dialog (Move H2, D-051).
 */
export function isOverrideRequired(
  reservationId: string | null | undefined,
  currentState: string,
  targetState: UnitState,
): boolean {
  if (!reservationId) {
    return false
  }
  return currentState !== targetState
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
