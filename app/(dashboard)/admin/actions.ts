'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { verifySpaceSchema, type VerifySpaceInput } from '@/lib/validation/verification'

export type SetSpaceStatusResult =
  | { success: true; spaceId: string; status: 'verified' | 'rejected' }
  | {
      success: false
      spaceId: string
      error: string
      /** A problem with the reason the Administrator typed, for the reason field. */
      fieldErrors?: { reason?: string }
    }

// The design's words for each refusal (STORY-20 design §3, screen 1).
const REASON_MESSAGE = 'Enter a reason between 1 and 500 characters.'

/**
 * Server Action for Administrator Space verification (STORY-15 design §2 & §3).
 * Validates input against verifySpaceSchema, enforces Administrator session,
 * and calls the database function public.set_space_status with optimistic concurrency.
 * A rejection carries the Administrator's reason (STORY-20, N10, D-084). TSK-20.3 adds
 * the take-down and its hold cleanup.
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

  // Execute set_space_status database function (D-053).
  // Security definer function enforces (select private.has_role('admin')).
  const { error } = await supabase.rpc('set_space_status', {
    p_space_id: spaceId,
    p_status: status,
    p_updated_at: updatedAt,
    ...(reason ? { p_reason: reason } : {}),
  })

  if (error) {
    const errorText = `${error.message ?? ''} ${error.hint ?? ''} ${error.details ?? ''}`

    if (errorText.includes('stale_version')) {
      return {
        success: false,
        spaceId,
        error:
          'Space details were updated by the host while you were reviewing. Please refresh to inspect the latest information.',
      }
    }

    // From STORY-20 the database names the move it refused (N5) instead of not_pending.
    if (errorText.includes('invalid_transition')) {
      return {
        success: false,
        spaceId,
        error:
          "This Space's status has changed and can no longer take that action. Reload to see its latest state.",
      }
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

  return {
    success: true,
    spaceId,
    status,
  }
}
