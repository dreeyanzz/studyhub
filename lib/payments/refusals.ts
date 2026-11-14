// What a Seeker is told when hold_unit refuses (STORY-09 design §3, N1 to N5,
// D-042). Pure: TSK-09.6's holdUnit passes the hint from the P0001 error and the
// labels it knows. The Host's refusals live in lib/seat-map/errors.ts and the
// Host's actions (TSK-09.7).

export interface HoldRefusalContext {
  /** The unit the Seeker tried to hold, such as "S4". */
  unitLabel: string
  /** The hold they already have, for `seeker_has_hold` (D-008). */
  currentHold?: { unitLabel: string; spaceName: string } | null
}

export const HOLD_REFUSAL_FALLBACK =
  'We could not hold the unit. Check your connection and try again.'

export function holdRefusalMessage(
  hint: string | null | undefined,
  context: HoldRefusalContext,
): string {
  switch (hint) {
    case 'unit_not_available':
      return `Someone else just took ${context.unitLabel}. Pick another unit.`
    case 'space_closed':
      return 'This Space has just closed.'
    case 'wait_window_not_allowed':
    case 'wait_window_past_closing':
      return 'That wait window no longer fits before closing. Pick a shorter one.'
    case 'seeker_has_hold':
      return context.currentHold
        ? `You're already holding ${context.currentHold.unitLabel} at ${context.currentHold.spaceName}. You can hold one unit at a time.`
        : "You're already holding a unit. You can hold one unit at a time."
    case 'unit_not_found':
      return 'We could not find that unit. It may have been removed.'
    default:
      return HOLD_REFUSAL_FALLBACK
  }
}
