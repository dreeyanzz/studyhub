'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  cleanupTakeDownHolds,
  parseCancelledHolds,
  type CancelledHold,
} from '@/lib/payments/take-down'
import { createClient } from '@/lib/supabase/server'
import {
  verifySpaceSchema,
  type SpaceVerificationDecision,
  type VerifySpaceInput,
} from '@/lib/validation/verification'

/** What a rejection or take-down did to the Space's unstarted holds (R13, R14, D-085). */
export interface HoldCleanupSummary {
  cancelledCount: number
  refundedCount: number
  /** Paid holds whose refund did not finish; they wait on /admin/payments (D-088). */
  failedRefundCount: number
}

export type SetSpaceStatusResult =
  | {
      success: true
      spaceId: string
      status: SpaceVerificationDecision
      holds?: HoldCleanupSummary
    }
  | {
      success: false
      spaceId: string
      error: string
      /** A problem with the reason the Administrator typed, for the reason field. */
      fieldErrors?: { reason?: string }
      /** The Space changed or moved: the page offers "Reload latest version" (N9, N5). */
      reload?: boolean
    }

// The design's words for each refusal (STORY-20 design §3, screen 1).
const REASON_MESSAGE = 'Enter a reason between 1 and 500 characters.'
const STALE_MESSAGE =
  'Space details were updated while you were reviewing. Reload to inspect the latest version.'
const MOVED_MESSAGE =
  "This Space's status has changed and can no longer take that action. Reload to see its latest state."

/**
 * Closes the cancelled holds' checkouts and refunds their paid fees (D-085), through
 * Adrian's helper. The decision has already been saved, so nothing here undoes it: a
 * refund that fails stays `paid` on /admin/payments for a retry.
 */
async function cleanUp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: unknown,
  reason: string,
  action: 'taken_down' | 'rejected',
): Promise<HoldCleanupSummary> {
  let holds: CancelledHold[]
  try {
    holds = parseCancelledHolds(data)
  } catch (error) {
    console.error('[admin] set_space_status answered without readable holds', {
      message: error instanceof Error ? error.message : String(error),
    })
    return { cancelledCount: 0, refundedCount: 0, failedRefundCount: 0 }
  }
  if (holds.length === 0) {
    return { cancelledCount: 0, refundedCount: 0, failedRefundCount: 0 }
  }

  try {
    const result = await cleanupTakeDownHolds(supabase, holds, reason, action)
    return {
      cancelledCount: holds.length,
      refundedCount: result.refundedCount,
      failedRefundCount: result.failedRefundPaymentIds.length,
    }
  } catch (error) {
    // Every paid hold not known to be refunded is left for the Payments page.
    console.error('[admin] take-down cleanup failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    const paid = holds.filter(
      (hold) => hold.previousStatus === 'reserved' && hold.paymentStatus === 'paid',
    ).length
    return { cancelledCount: holds.length, refundedCount: 0, failedRefundCount: paid }
  }
}

/**
 * Server Action for every Administrator verification move (STORY-15, STORY-20 design
 * §1 and §3): Approve (V2), Reject (V3), Take down (V7), Undo (V9) and Put back (V10).
 * Validates the decision and its reason, then calls the 4-argument
 * public.set_space_status with the version the Administrator saw (N9). The database
 * decides whether the move is allowed (N3 to N5, N10). A rejection or take-down then
 * closes the cancelled holds' checkouts and refunds their fees (D-085).
 */
export async function setSpaceStatusAction(
  input: VerifySpaceInput,
): Promise<SetSpaceStatusResult> {
  const parsed = verifySpaceSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const message = issue?.message || 'Invalid verification request.'
    return {
      success: false,
      spaceId: input?.spaceId || '',
      error: message,
      fieldErrors: issue?.path[0] === 'reason' ? { reason: message } : undefined,
    }
  }

  const { spaceId, status, updatedAt, reason } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin')

  // Security definer function enforces (select private.has_role('admin')) (D-053).
  const { data, error } = await supabase.rpc('set_space_status', {
    p_space_id: spaceId,
    p_status: status,
    p_updated_at: updatedAt,
    ...(reason ? { p_reason: reason } : {}),
  })

  if (error) {
    const errorText = `${error.message ?? ''} ${error.hint ?? ''} ${error.details ?? ''}`

    if (errorText.includes('stale_version')) {
      return { success: false, spaceId, error: STALE_MESSAGE, reload: true }
    }
    if (errorText.includes('invalid_transition')) {
      return { success: false, spaceId, error: MOVED_MESSAGE, reload: true }
    }
    if (errorText.includes('not_found')) {
      return { success: false, spaceId, error: 'This Space no longer exists.' }
    }
    if (errorText.includes('invalid_reason')) {
      return {
        success: false,
        spaceId,
        error: REASON_MESSAGE,
        fieldErrors: { reason: REASON_MESSAGE },
      }
    }
    if (error.code === '42501' || errorText.includes('permission denied')) {
      return {
        success: false,
        spaceId,
        error: 'You are not authorized to verify spaces.',
      }
    }
    return {
      success: false,
      spaceId,
      error: 'We could not update the space status. Please try again.',
    }
  }

  revalidatePath('/admin')
  revalidatePath('/spaces')
  revalidatePath(`/spaces/${spaceId}`)

  if (status === 'verified' || !reason) return { success: true, spaceId, status }

  const holds = await cleanUp(supabase, data, reason, status)
  if (holds.cancelledCount > 0) revalidatePath('/admin/payments')
  return { success: true, spaceId, status, holds }
}
