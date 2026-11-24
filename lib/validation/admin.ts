import { z } from 'zod'

/**
 * Zod schemas for the Administration console's Payments page and sandbox refund dialog
 * (STORY-14 design §2 "Form rules", TSK-14.4, FR-5.3, D-088).
 */

export const REFUND_REASON_MAX_LENGTH = 300

export const PAYMENT_RECORD_FILTERS = [
  'all',
  'paid',
  'forfeited',
  'refunded',
  'refundable',
] as const
export type PaymentRecordFilter = (typeof PAYMENT_RECORD_FILTERS)[number]

export const ADMIN_SHOW_COUNTS = [25, 50, 75, 100] as const
export type AdminShowCount = (typeof ADMIN_SHOW_COUNTS)[number]

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

function firstParam(val: unknown): unknown {
  return Array.isArray(val) ? val[0] : val
}

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
