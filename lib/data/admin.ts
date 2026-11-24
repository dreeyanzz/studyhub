import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { paymentIdSchema, type PaymentRecordFilter } from '@/lib/validation/admin'

/** Maximum rows shown on `/admin/payments` (`?show=100`, STORY-14 design §2 & §3). */
const MAX_SHOWN_ITEMS = 100
const DEFAULT_SHOWN_ITEMS = 25

export type PaymentStatus = Database['public']['Enums']['payment_status']
export type ReservationStatus = Database['public']['Enums']['reservation_status']

export interface AdminPaymentRecordItem {
  paymentId: string
  paymentStatus: PaymentStatus
  feeAmount: number
  paidAt: string
  paymentIntentId: string
  refundId: string | null
  refundedAt: string | null
  refundedBy: string | null
  refundedByFullName: string | null
  refundReason: string | null
  reservationId: string
  reservationStatus: ReservationStatus
  unitLabel: string
  checkedInAt: string | null
  endedAt: string | null
  spaceId: string
  spaceName: string
  seekerFullName: string
  refundable: boolean
}

export interface AdminPaymentRecordsPage {
  items: AdminPaymentRecordItem[]
  hasMore: boolean
}

export interface GetPaymentRecordsOptions {
  filter?: PaymentRecordFilter
  paymentId?: string
  /** Number of payments to return (1..100, default 25). Requests `shown + 1` to compute `hasMore`. */
  shown?: number
  offset?: number
}

/**
 * Server-only query helper (STORY-14, TSK-14.4, FR-5.3, D-047, D-088).
 * Reads paid, forfeited, and refunded sandbox payments through `public.admin_payment_records`
 * (which records lapses first), requesting `shown + 1` rows so the page knows whether more exist.
 * Returns `null` on a malformed `paymentId` or database error.
 */
export async function getPaymentRecords(
  supabase: SupabaseClient<Database>,
  options?: GetPaymentRecordsOptions,
): Promise<AdminPaymentRecordsPage | null> {
  const filter: PaymentRecordFilter = options?.filter ?? 'all'
  const rawShown = options?.shown ?? DEFAULT_SHOWN_ITEMS
  const shown = Number.isFinite(rawShown)
    ? Math.min(Math.max(Math.trunc(rawShown), 1), MAX_SHOWN_ITEMS)
    : DEFAULT_SHOWN_ITEMS
  const rawOffset = options?.offset ?? 0
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0

  let paymentId: string | undefined
  if (options?.paymentId !== undefined) {
    const parsedId = paymentIdSchema.safeParse(options.paymentId)
    if (!parsedId.success) {
      return null
    }
    paymentId = parsedId.data
  }

  const pStatus: PaymentStatus | undefined =
    filter === 'paid' || filter === 'forfeited' || filter === 'refunded'
      ? filter
      : undefined
  const pRefundableOnly = filter === 'refundable'

  const { data, error } = await supabase.rpc('admin_payment_records', {
    p_status: pStatus,
    p_refundable_only: pRefundableOnly,
    p_payment_id: paymentId,
    p_page_size: shown + 1,
    p_page_offset: offset,
  })

  if (error || !data) {
    return null
  }

  const hasMore = data.length > shown
  const items: AdminPaymentRecordItem[] = data.slice(0, shown).map((row) => ({
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    feeAmount: row.fee_amount,
    paidAt: row.paid_at,
    paymentIntentId: row.payment_intent_id,
    refundId: row.refund_id ?? null,
    refundedAt: row.refunded_at ?? null,
    refundedBy: row.refunded_by ?? null,
    refundedByFullName:
      typeof row.refunded_by_full_name === 'string' && row.refunded_by_full_name.trim()
        ? row.refunded_by_full_name
        : null,
    refundReason: row.refund_reason ?? null,
    reservationId: row.reservation_id,
    reservationStatus: row.reservation_status,
    unitLabel: row.unit_label,
    checkedInAt: row.checked_in_at ?? null,
    endedAt: row.ended_at ?? null,
    spaceId: row.space_id,
    spaceName: row.space_name,
    seekerFullName:
      typeof row.seeker_full_name === 'string' && row.seeker_full_name.trim()
        ? row.seeker_full_name
        : 'Unknown user',
    refundable: row.refundable,
  }))

  return { items, hasMore }
}
