import { z } from 'zod'

import { reviewIdSchema } from '@/lib/validation/review'

/**
 * Zod schemas for the Administration console: the review moderation queue and actions
 * (TSK-14.3, FR-5.2, D-080), and the Payments page and refund dialog (TSK-14.4, FR-5.3,
 * D-088). STORY-14 design §2 "Form rules".
 */

export const REVIEW_MODERATION_ACTIONS = ['hide', 'remove', 'restore', 'dismiss'] as const
export type ReviewModerationAction = (typeof REVIEW_MODERATION_ACTIONS)[number]

export const REVIEW_MODERATION_ACTION_LABELS: Record<ReviewModerationAction, string> = {
  hide: 'Hidden',
  remove: 'Removed',
  restore: 'Restored',
  dismiss: 'Reports dismissed',
}

export const REVIEW_REPORT_OUTCOME_LABELS = {
  dismissed: 'Dismissed',
  hidden: 'Hidden',
  removed: 'Removed',
} as const

export const REVIEW_QUEUE_LISTS = ['reported', 'hidden', 'removed'] as const
export type ReviewQueueList = (typeof REVIEW_QUEUE_LISTS)[number]

export const ADMIN_SHOW_COUNTS = [25, 50, 75, 100] as const
export type AdminShowCount = (typeof ADMIN_SHOW_COUNTS)[number]

function firstParam(val: unknown): unknown {
  return Array.isArray(val) ? val[0] : val
}

function positiveIntPreprocess(val: unknown): unknown {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (/^\d+$/.test(trimmed)) return Number(trimmed)
  }
  return val
}

/**
 * Validates input to `moderateReviewAction` / `public.moderate_review`:
 * review UUID, one of the four moderation actions, the integer version the
 * Administrator saw, and the id of the newest moderation log entry they saw
 * (null or left out when the log was empty) (N8, N9, N18, D-080, #420).
 */
export const moderateReviewSchema = z.object({
  reviewId: reviewIdSchema,
  action: z.enum(REVIEW_MODERATION_ACTIONS, {
    error: 'Invalid moderation action.',
  }),
  version: z.preprocess(
    positiveIntPreprocess,
    z
      .number({ error: 'Invalid review version.' })
      .int({ error: 'Invalid review version.' })
      .min(1, { error: 'Invalid review version.' }),
  ),
  lastEventId: z
    .uuid({ error: 'Invalid moderation history entry.' })
    .nullable()
    .optional(),
})

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>

/**
 * Search parameters for `/admin/moderation` (`?list=` and `?show=`, design §2 & §3).
 * Anything outside the allowed values falls back to `reported` and `25`.
 */
export const reviewQueueSchema = z.object({
  list: z.preprocess(firstParam, z.enum(REVIEW_QUEUE_LISTS)).catch('reported'),
  show: z
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
        .refine((n): n is AdminShowCount =>
          ADMIN_SHOW_COUNTS.includes(n as AdminShowCount),
        ),
    )
    .catch(25),
})

export type ReviewQueueParams = z.infer<typeof reviewQueueSchema>

// Payments page and refunds (TSK-14.4, FR-5.3, D-088)

export const REFUND_REASON_MAX_LENGTH = 300

export const PAYMENT_RECORD_FILTERS = [
  'all',
  'paid',
  'forfeited',
  'refunded',
  'refundable',
] as const
export type PaymentRecordFilter = (typeof PAYMENT_RECORD_FILTERS)[number]

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  forfeited: 'Forfeited',
  refunded: 'Refunded',
} as const

export const RESERVATION_STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  reserved: 'Reserved',
  occupied: 'Occupied',
  expired: 'Expired',
  no_show: 'No-show',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const

/** A payment's UUID, from a form payload or Server Action argument. */
export const paymentIdSchema = z.uuid({ error: 'Invalid Payment ID' })

/**
 * Required refund reason: trimmed, 1 to 300 characters (STORY-14 design §2, D-088).
 * Matches the database check constraint in `20261124051320_refunds.sql`.
 */
export const refundReasonSchema = z
  .string({ error: 'Enter a reason for this refund.' })
  .transform((val) => val.trim())
  .refine((val) => val.length >= 1, {
    error: 'Enter a reason for this refund.',
  })
  .refine((val) => val.length <= REFUND_REASON_MAX_LENGTH, {
    error: `Reason must be ${REFUND_REASON_MAX_LENGTH} characters or fewer.`,
  })

/** Validates input to `refundPaymentAction` / `public.record_refund` (FR-5.3, D-088). */
export const refundPaymentSchema = z.object({
  paymentId: paymentIdSchema,
  reason: refundReasonSchema,
})

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>

/**
 * Search parameters for `/admin/payments` (`?status=` and `?show=`, design §2 & §3).
 * Anything outside the allowed values falls back to `all` and `25`.
 */
export const paymentRecordsSchema = z.object({
  status: z.preprocess(firstParam, z.enum(PAYMENT_RECORD_FILTERS)).catch('all'),
  show: z
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
        .refine((n): n is AdminShowCount =>
          ADMIN_SHOW_COUNTS.includes(n as AdminShowCount),
        ),
    )
    .catch(25),
})

export type PaymentRecordsParams = z.infer<typeof paymentRecordsSchema>

export type RefundPaymentActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors?: { reason?: string }
  reload?: boolean
}
