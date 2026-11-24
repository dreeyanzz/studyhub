import { z } from 'zod'

import { reservationIdSchema } from '@/lib/validation/reservation'
import { spaceIdSchema } from '@/lib/validation/space'

/**
 * Zod schemas for community reviews, review reports, and the Space profile's review
 * list query parameters (STORY-13 design §2 "Form rules", FR-4.1, FR-4.2, D-080, D-087).
 */

export const REVIEW_COMMENT_MAX_LENGTH = 500
export const REVIEW_REPORT_NOTE_MAX_LENGTH = 300

export const REVIEW_REPORT_REASONS = [
  'spam',
  'offensive',
  'not_about_space',
  'other',
] as const

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number]

export const REVIEW_REPORT_REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: 'Spam',
  offensive: 'Offensive',
  not_about_space: 'Not about this Space',
  other: 'Other',
}

export const REVIEW_SORT_OPTIONS = ['newest', 'highest', 'lowest'] as const
export type ReviewSort = (typeof REVIEW_SORT_OPTIONS)[number]

export const REVIEW_SHOW_COUNTS = [10, 20, 30, 40, 50] as const
export type ReviewShowCount = (typeof REVIEW_SHOW_COUNTS)[number]

/** A review's id, from a form payload or bound Server Action argument. */
export const reviewIdSchema = z.uuid({ error: 'Invalid Review ID' })

/**
 * A single category rating: a whole number from 1 to 5, read from a form string
 * or number (FR-4.1, D-087). Empty strings, decimals, and out-of-range values fail.
 */
export const reviewRatingSchema = z.preprocess(
  (val) => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!/^\d+$/.test(trimmed)) return val
      return Number(trimmed)
    }
    return val
  },
  z
    .number({ error: 'Choose a rating from 1 to 5.' })
    .int({ error: 'Rating must be a whole number from 1 to 5.' })
    .min(1, { error: 'Choose a rating from 1 to 5.' })
    .max(5, { error: 'Choose a rating from 1 to 5.' }),
)

function optionalTrimmedTextSchema(maxLength: number, maxError: string) {
  return z
    .string()
    .nullish()
    .transform((val) => (val ?? '').trim())
    .refine((val) => val.length <= maxLength, { error: maxError })
    .transform((val) => (val.length === 0 ? null : val))
}

/** Optional review comment: trimmed, at most 500 characters, null when empty (N15). */
export const reviewCommentSchema = optionalTrimmedTextSchema(
  REVIEW_COMMENT_MAX_LENGTH,
  `Comment must be ${REVIEW_COMMENT_MAX_LENGTH} characters or fewer.`,
)

/** Optional report note: trimmed, at most 300 characters, null when empty (N15). */
export const reviewReportNoteSchema = optionalTrimmedTextSchema(
  REVIEW_REPORT_NOTE_MAX_LENGTH,
  `Note must be ${REVIEW_REPORT_NOTE_MAX_LENGTH} characters or fewer.`,
)

export const reviewReportReasonSchema = z.enum(REVIEW_REPORT_REASONS, {
  error: 'Choose a reason for reporting this review.',
})

export const reviewSortSchema = z.enum(REVIEW_SORT_OPTIONS)

/** Posting a new review for a checked-in visit (RV1, FR-4.1, D-087). */
export const postReviewSchema = z.object({
  spaceId: spaceIdSchema,
  reservationId: reservationIdSchema,
  quietness: reviewRatingSchema,
  wifiReliability: reviewRatingSchema,
  cleanliness: reviewRatingSchema,
  comfort: reviewRatingSchema,
  comment: reviewCommentSchema,
})

export type PostReviewInput = z.infer<typeof postReviewSchema>

/** Editing an existing visible review (RV2, FR-4.1). */
export const editReviewSchema = z.object({
  spaceId: spaceIdSchema,
  reviewId: reviewIdSchema,
  quietness: reviewRatingSchema,
  wifiReliability: reviewRatingSchema,
  cleanliness: reviewRatingSchema,
  comfort: reviewRatingSchema,
  comment: reviewCommentSchema,
})

export type EditReviewInput = z.infer<typeof editReviewSchema>

/** Deleting an existing visible review (RV3). */
export const deleteReviewSchema = z.object({
  spaceId: spaceIdSchema,
  reviewId: reviewIdSchema,
})

export type DeleteReviewInput = z.infer<typeof deleteReviewSchema>

/** Reporting another user's visible review (RP1, FR-4.2, D-080). */
export const reportReviewSchema = z.object({
  spaceId: spaceIdSchema,
  reviewId: reviewIdSchema,
  reason: reviewReportReasonSchema,
  note: reviewReportNoteSchema,
})

export type ReportReviewInput = z.infer<typeof reportReviewSchema>

function firstParam(val: unknown): unknown {
  return Array.isArray(val) ? val[0] : val
}

/**
 * Space profile review list search parameters (`?sort=` and `?reviews=`, design §2 & §3).
 * Anything outside the allowed values falls back to the defaults (`newest`, `10`).
 */
export const reviewListSchema = z.object({
  sort: z.preprocess(firstParam, reviewSortSchema).catch('newest'),
  reviews: z
    .preprocess(
      (val) => {
        const first = firstParam(val)
        if (typeof first === 'number') return first
        if (typeof first === 'string' && /^\d+$/.test(first.trim())) {
          return Number(first.trim())
        }
        return first
      },
      z
        .number()
        .refine((n): n is ReviewShowCount =>
          REVIEW_SHOW_COUNTS.includes(n as ReviewShowCount),
        ),
    )
    .catch(10),
})

export type ReviewListParams = z.infer<typeof reviewListSchema>

/** Field names shown in `ReviewForm` and returned in `ReviewActionState.fieldErrors`. */
export type ReviewFormField =
  'quietness' | 'wifiReliability' | 'cleanliness' | 'comfort' | 'comment'

/** Shared Server Action result shape for posting, editing, and deleting a review (TSK-13.4). */
export type ReviewActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors?: Partial<Record<ReviewFormField, string>>
}

/** Category rating fields in canonical display order (FR-4.1, D-087). */
export const REVIEW_RATING_CATEGORIES = [
  { key: 'quietness', label: 'Quietness' },
  { key: 'wifiReliability', label: 'Wi-Fi reliability' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'comfort', label: 'Comfort' },
] as const

export type ReviewRatingCategoryKey = (typeof REVIEW_RATING_CATEGORIES)[number]['key']
