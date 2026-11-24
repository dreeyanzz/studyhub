'use server'

// Space profile Server Actions:
// - holdUnit (STORY-09 design §3, TSK-09.6, R1, D-068)
// - postReviewAction, editReviewAction, deleteReviewAction (STORY-13 design §1 & §3, TSK-13.4, RV1-RV3)
// - reportReviewAction (STORY-13 design §1 & §3, TSK-13.5, RP1, FR-4.2, D-080)
//
// Every action can be called directly, so each validates its own input and session.
// Postgres RLS and functions remain the security boundary (D-007).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { z } from 'zod'

import { holdRefusalReason } from '@/lib/payments/refusals'
import type { TablesInsert } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { holdUnitSchema } from '@/lib/validation/reservation'
import {
  deleteReviewSchema,
  editReviewSchema,
  postReviewSchema,
  reportReviewSchema,
  type ReportReviewActionState,
  type ReportReviewFormField,
  type ReviewActionState,
  type ReviewFormField,
} from '@/lib/validation/review'
import { spaceIdSchema } from '@/lib/validation/space'

export type {
  ReportReviewActionState,
  ReportReviewFormField,
  ReviewActionState,
  ReviewFormField,
}

const REVIEW_FORM_FIELDS = new Set<string>([
  'quietness',
  'wifiReliability',
  'cleanliness',
  'comfort',
  'comment',
])

function formatValidationError(error: z.ZodError): ReviewActionState {
  const fieldErrors: Partial<Record<ReviewFormField, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && REVIEW_FORM_FIELDS.has(key)) {
      const field = key as ReviewFormField
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
  }
  return {
    status: 'error',
    message: error.issues[0]?.message ?? 'Please check your review and try again.',
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  }
}

export async function holdUnit(formData: FormData): Promise<void> {
  const space = spaceIdSchema.safeParse(formData.get('spaceId'))
  if (!space.success) redirect('/spaces')
  const profilePath = `/spaces/${space.data}`
  // A refusal comes back to the view the Seeker was in, so someone on the accessible
  // list stays on it to pick another unit (SRS §3.2.2). Only "list" is read.
  const view = formData.get('view') === 'list' ? 'view=list&' : ''

  const parsed = holdUnitSchema.safeParse({
    spaceId: space.data,
    unitId: formData.get('unitId'),
    waitWindowMinutes: formData.get('waitWindowMinutes'),
  })
  if (!parsed.success) redirect(`${profilePath}?${view}refused=error`)
  const { unitId, waitWindowMinutes } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Back to the profile, with no unit chosen: the Seeker picks again (D-058).
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(profilePath)}`)

  const { data, error } = await supabase
    .rpc('hold_unit', { p_unit_id: unitId, p_wait_window_minutes: waitWindowMinutes })
    .maybeSingle()

  if (error || !data) {
    // Back to the same unit, so the profile rereads availability and shows the unit as
    // it is now, with the refusal's message above it (seeker-hold-stale-unit-refresh).
    // The reason, never a database message, goes in the URL. A message kept in the
    // panel would go with it, because the seat map hides the panel once the unit
    // isn't Available.
    const reason = holdRefusalReason(error?.code, error?.hint)
    redirect(`${profilePath}?${view}unit=${encodeURIComponent(unitId)}&refused=${reason}`)
  }

  // A new hold, or the same hold again after a double tap (W2): its page either way.
  redirect(`/seeker/reservations/${data.reservation_id}`)
}

/**
 * Posts a review for a checked-in visit (STORY-13 design §1 & §3, RV1, FR-4.1, D-081).
 * Exported here so STORY-16's reservation history dialog can reuse the same action.
 */
export async function postReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const parsed = postReviewSchema.safeParse({
    spaceId: formData.get('spaceId'),
    reservationId: formData.get('reservationId'),
    quietness: formData.get('quietness'),
    wifiReliability: formData.get('wifiReliability'),
    cleanliness: formData.get('cleanliness'),
    comfort: formData.get('comfort'),
    comment: formData.get('comment') ?? undefined,
  })
  if (!parsed.success) {
    return formatValidationError(parsed.error)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      status: 'error',
      message: 'You can review a Space only after checking in there',
    }
  }

  const {
    spaceId,
    reservationId,
    quietness,
    wifiReliability,
    cleanliness,
    comfort,
    comment,
  } = parsed.data

  const { error } = await supabase.from('reviews').insert({
    reservation_id: reservationId,
    space_id: spaceId,
    quietness,
    wifi_reliability: wifiReliability,
    cleanliness,
    comfort,
    comment,
  })

  if (error) {
    if (error.code === '42501') {
      return {
        status: 'error',
        message: 'You can review a Space only after checking in there',
      }
    }
    if (error.code === '23505') {
      return {
        status: 'error',
        message: 'You have already reviewed this visit',
      }
    }
    return {
      status: 'error',
      message: 'Could not save your review right now. Please try again.',
    }
  }

  revalidatePath(`/spaces/${spaceId}`)
  revalidatePath('/spaces')

  return {
    status: 'success',
    message: 'Review posted.',
  }
}

/**
 * Edits the signed-in Seeker's own visible review (STORY-13 design §1 & §3, RV2, FR-4.1).
 * Exported here so STORY-16's reservation history dialog can reuse the same action.
 */
export async function editReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const parsed = editReviewSchema.safeParse({
    spaceId: formData.get('spaceId'),
    reviewId: formData.get('reviewId'),
    quietness: formData.get('quietness'),
    wifiReliability: formData.get('wifiReliability'),
    cleanliness: formData.get('cleanliness'),
    comfort: formData.get('comfort'),
    comment: formData.get('comment') ?? undefined,
  })
  if (!parsed.success) {
    return formatValidationError(parsed.error)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      status: 'error',
      message: "This review can't be changed now",
    }
  }

  const { spaceId, reviewId, quietness, wifiReliability, cleanliness, comfort, comment } =
    parsed.data

  // Select id so RLS zero-row refusals (hidden, removed, or another user's review, N4/N5)
  // are distinguished from a saved update.
  const { data, error } = await supabase
    .from('reviews')
    .update({
      quietness,
      wifi_reliability: wifiReliability,
      cleanliness,
      comfort,
      comment,
    })
    .eq('id', reviewId)
    .eq('space_id', spaceId)
    .select('id')

  if (error) {
    if (error.code === '42501') {
      return { status: 'error', message: "This review can't be changed now" }
    }
    return {
      status: 'error',
      message: 'Could not update your review right now. Please try again.',
    }
  }

  if (!data || data.length === 0) {
    return { status: 'error', message: "This review can't be changed now" }
  }

  revalidatePath(`/spaces/${spaceId}`)
  revalidatePath('/spaces')

  return {
    status: 'success',
    message: 'Review updated.',
  }
}

/**
 * Deletes the signed-in Seeker's own visible review (STORY-13 design §1 & §3, RV3).
 */
export async function deleteReviewAction(
  input: FormData | { spaceId: string; reviewId: string },
): Promise<ReviewActionState> {
  const raw =
    input instanceof FormData
      ? {
          spaceId: input.get('spaceId'),
          reviewId: input.get('reviewId'),
        }
      : input

  const parsed = deleteReviewSchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 'error', message: "This review can't be changed now" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: 'error', message: "This review can't be changed now" }
  }

  const { spaceId, reviewId } = parsed.data

  const { data, error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('space_id', spaceId)
    .select('id')

  if (error) {
    if (error.code === '42501') {
      return { status: 'error', message: "This review can't be changed now" }
    }
    return {
      status: 'error',
      message: 'Could not delete your review right now. Please try again.',
    }
  }

  if (!data || data.length === 0) {
    return { status: 'error', message: "This review can't be changed now" }
  }

  revalidatePath(`/spaces/${spaceId}`)
  revalidatePath('/spaces')

  return {
    status: 'success',
    message: 'Review deleted.',
  }
}

const REPORT_FORM_FIELDS = new Set<string>(['reason', 'note'])

function formatReportValidationError(error: z.ZodError): ReportReviewActionState {
  const fieldErrors: Partial<Record<ReportReviewFormField, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && REPORT_FORM_FIELDS.has(key)) {
      const field = key as ReportReviewFormField
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
  }
  return {
    status: 'error',
    message: error.issues[0]?.message ?? 'Please check your report and try again.',
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  }
}

/**
 * Reports another user's visible review for Administrator moderation
 * (STORY-13 design §1 & §3, TSK-13.5, RP1, FR-4.2, D-080, N11).
 */
export async function reportReviewAction(
  _prevState: ReportReviewActionState,
  formData: FormData,
): Promise<ReportReviewActionState> {
  const parsed = reportReviewSchema.safeParse({
    spaceId: formData.get('spaceId'),
    reviewId: formData.get('reviewId'),
    reason: formData.get('reason'),
    note: formData.get('note') ?? undefined,
  })
  if (!parsed.success) {
    return formatReportValidationError(parsed.error)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      status: 'error',
      message: "You can't report this review",
    }
  }

  const { spaceId, reviewId, reason, note } = parsed.data

  // Only columns granted for authenticated insert (review_id, reason, note) are sent;
  // Postgres's `set_review_report_version` BEFORE INSERT trigger populates `review_version`
  // from the review's current version (D-080, STORY-13 design §2).
  const payload = {
    review_id: reviewId,
    reason,
    note,
  } as TablesInsert<'review_reports'>

  const { error } = await supabase.from('review_reports').insert(payload)

  if (error) {
    if (error.code === '42501' || error.code === '23502' || error.code === '23503') {
      return {
        status: 'error',
        message: "You can't report this review",
      }
    }
    if (error.code === '23505') {
      return {
        status: 'error',
        message: 'You have already reported this review',
      }
    }
    return {
      status: 'error',
      message: 'Could not submit your report right now. Please try again.',
    }
  }

  revalidatePath(`/spaces/${spaceId}`)

  return {
    status: 'success',
    message: 'Report submitted.',
  }
}
