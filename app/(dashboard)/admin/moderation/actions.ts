'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import {
  moderateReviewSchema,
  type ModerateReviewInput,
  type ReviewModerationAction,
} from '@/lib/validation/admin'

export type ModerateReviewResult =
  | {
      success: true
      reviewId: string
      action: ReviewModerationAction
      message: string
    }
  | {
      success: false
      reviewId: string
      error: string
      code?: 'stale_version' | 'not_allowed' | 'not_found' | 'unauthorized' | 'invalid'
    }

const SUCCESS_MESSAGES: Record<ReviewModerationAction, string> = {
  hide: 'Review hidden.',
  remove: 'Review removed.',
  restore: 'Review restored.',
  dismiss: 'Reports dismissed.',
}

const STALE_OR_DISALLOWED_MESSAGE =
  'This review changed since you loaded the page. Refresh to see its latest state.'
const NOT_FOUND_MESSAGE = 'This review was already deleted.'

/**
 * Server Action for Administrator review moderation (STORY-14 design §2 & §3 Screen 2,
 * TSK-14.3, FR-5.2, RV4–RV8, RP2, N7–N9, D-080).
 *
 * Parses input with `moderateReviewSchema`, checks session, calls `public.moderate_review`
 * (which enforces Administrator RLS, row locking, and optimistic version check), maps
 * Postgres hints into §3's messages, and revalidates the moderation queue and Space pages.
 */
export async function moderateReviewAction(
  input: ModerateReviewInput,
): Promise<ModerateReviewResult> {
  const parsed = moderateReviewSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid moderation request.'
    return {
      success: false,
      reviewId: typeof input?.reviewId === 'string' ? input.reviewId : '',
      error: message,
      code: 'invalid',
    }
  }

  const { reviewId, action, version, lastEventId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin%2Fmoderation')

  // The newest moderation log entry the Administrator saw (N18, #420). Left out when
  // the log was empty, which the function reads as null, so it refuses with
  // stale_version once another Administrator has acted on the review.
  const { error } = await supabase.rpc('moderate_review', {
    p_review_id: reviewId,
    p_action: action,
    p_version: version,
    p_last_event_id: lastEventId ?? undefined,
  })

  if (error) {
    const errorText = `${error.hint ?? ''} ${error.message ?? ''} ${error.details ?? ''}`

    if (errorText.includes('stale_version')) {
      return {
        success: false,
        reviewId,
        error: STALE_OR_DISALLOWED_MESSAGE,
        code: 'stale_version',
      }
    }

    if (errorText.includes('not_allowed')) {
      return {
        success: false,
        reviewId,
        error: STALE_OR_DISALLOWED_MESSAGE,
        code: 'not_allowed',
      }
    }

    if (errorText.includes('not_found')) {
      return {
        success: false,
        reviewId,
        error: NOT_FOUND_MESSAGE,
        code: 'not_found',
      }
    }

    if (error.code === '42501' || errorText.includes('permission denied')) {
      return {
        success: false,
        reviewId,
        error: 'You are not authorized to moderate reviews.',
        code: 'unauthorized',
      }
    }

    return {
      success: false,
      reviewId,
      error: "We couldn't complete this moderation action. Try again.",
    }
  }

  revalidatePath('/admin/moderation')
  revalidatePath('/spaces', 'layout')

  return {
    success: true,
    reviewId,
    action,
    message: SUCCESS_MESSAGES[action],
  }
}
