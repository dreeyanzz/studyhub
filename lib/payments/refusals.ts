// What a Seeker is told when hold_unit refuses (STORY-09 design §3, N1 to N5,
// D-042). Pure: TSK-09.6's holdUnit turns the refusal into a reason for the URL, and
// the Space profile turns the reason into its message. The Host's refusals live in
// lib/seat-map/errors.ts and the Host's actions (TSK-09.7).

export interface HoldRefusalContext {
  /** The unit the Seeker tried to hold, such as "S4". */
  unitLabel: string
  /** The hold they already have, for `seeker_has_hold` (D-008). */
  currentHold?: { unitLabel: string; spaceName: string } | null
}

/** hold_unit's 42501, and the panel for a Host or an Administrator (N5, design §3). */
export const ONLY_SEEKERS = 'Only Seeker accounts can hold units.'

export const HOLD_REFUSAL_FALLBACK =
  'We could not hold the unit. Check your connection and try again.'

/** hold_unit's hints (design §2), plus a 42501 and anything else. */
export const HOLD_REFUSAL_REASONS = [
  'unit_not_available',
  'space_closed',
  'wait_window_not_allowed',
  'wait_window_past_closing',
  'seeker_has_hold',
  'unit_not_found',
  'not_seeker',
  'error',
] as const

export type HoldRefusalReason = (typeof HOLD_REFUSAL_REASONS)[number]

/** The reason for a hold_unit error, told apart by code and hint, never by message. */
export function holdRefusalReason(
  code: string | null | undefined,
  hint: string | null | undefined,
): HoldRefusalReason {
  if (code === '42501') return 'not_seeker'
  if (
    code === 'P0001' &&
    (HOLD_REFUSAL_REASONS as readonly string[]).includes(hint ?? '')
  ) {
    return hint as HoldRefusalReason
  }
  return 'error'
}

/** A reason read back from the URL, or null for anything that isn't one. */
export function parseHoldRefusalReason(value: unknown): HoldRefusalReason | null {
  return typeof value === 'string' &&
    (HOLD_REFUSAL_REASONS as readonly string[]).includes(value)
    ? (value as HoldRefusalReason)
    : null
}

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
    case 'not_seeker':
      return ONLY_SEEKERS
    default:
      return HOLD_REFUSAL_FALLBACK
  }
}
