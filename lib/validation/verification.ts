import { z } from 'zod'

import { spaceIdSchema } from '@/lib/validation/space'

// STORY-15, TSK-15.2: Verification schema (D-053).
// Validates Space ID, target verification status and the raw ISO timestamp string used
// for optimistic concurrency control.
// STORY-20: a rejection or a take-down needs a reason (N10, D-084). TSK-20.1 added the
// reason, TSK-20.2 resubmitSpaceSchema; TSK-20.3 adds 'taken_down' and the `?tab` rule of the design's §2.

/** The longest reason public.set_space_status and spaces.status_reason accept (N10). */
export const SPACE_STATUS_REASON_MAX_LENGTH = 500

/**
 * The moves an Administrator asks for (STORY-20 design §2). 'verified' covers V2, V9 and
 * V10; which one it is depends on the Space's current status, which the database checks.
 */
export const spaceVerificationDecisionSchema = z.enum(
  ['verified', 'rejected', 'taken_down'],
  { error: 'Decision must be verified, rejected or taken down' },
)

export type SpaceVerificationDecision = z.infer<typeof spaceVerificationDecisionSchema>

/** The decisions that need a reason the Host can read (V3, V7, N10). */
export function decisionNeedsReason(status: SpaceVerificationDecision): boolean {
  return status === 'rejected' || status === 'taken_down'
}

/** A reason, trimmed as the database trims it: 1 to 500 characters (N10). */
export const spaceStatusReasonSchema = z
  .string({ error: 'Enter a reason before continuing.' })
  .trim()
  .min(1, { error: 'Enter a reason before continuing.' })
  .max(SPACE_STATUS_REASON_MAX_LENGTH, {
    error: `Reason must be ${SPACE_STATUS_REASON_MAX_LENGTH} characters or fewer.`,
  })

export const verifySpaceSchema = z
  .object({
    spaceId: spaceIdSchema,
    status: spaceVerificationDecisionSchema,
    // Preserves exact ISO timestamp string without client conversion (D-053, design §7).
    // Rejects invalid strings such as "yesterday" or whitespace while preserving microseconds.
    updatedAt: z.iso.datetime({
      offset: true,
      error: 'Timestamp is required for verification',
    }),
    reason: z.string().optional(),
  })
  // A move to Verified ignores a reason, so it is dropped; a rejection or a take-down
  // must have one.
  .transform((input, ctx) => {
    if (!decisionNeedsReason(input.status)) return { ...input, reason: undefined }

    const reason = spaceStatusReasonSchema.safeParse(input.reason ?? '')
    if (!reason.success) {
      for (const issue of reason.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['reason'] })
      }
      return z.NEVER
    }
    return { ...input, reason: reason.data }
  })

export type VerifySpaceInput = z.input<typeof verifySpaceSchema>

/**
 * A Host resubmitting a Rejected or Taken down Space (V8, D-084). Only the id is
 * sent: public.resubmit_space checks the caller owns the Space and that its status
 * can be resubmitted (N11), so the form carries nothing else to trust.
 */
export const resubmitSpaceSchema = z.object({ spaceId: spaceIdSchema })

export type ResubmitSpaceInput = z.input<typeof resubmitSpaceSchema>

/** The four lists on `/admin` (STORY-20 design §3, screen 1). */
export const VERIFICATION_QUEUE_TABS = [
  'pending',
  'verified',
  'rejected',
  'taken_down',
] as const

export type VerificationQueueTab = (typeof VERIFICATION_QUEUE_TABS)[number]

/** `/admin?tab=`: any missing or unknown value shows the Pending list. */
export const verificationQueueTabSchema = z.enum(VERIFICATION_QUEUE_TABS).catch('pending')
