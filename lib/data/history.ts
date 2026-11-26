import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import {
  DEFAULT_HISTORY_SHOW_COUNT,
  MAX_HISTORY_SHOW_COUNT,
} from '@/lib/validation/history'

export type ReservationHistoryStatus = Database['public']['Enums']['reservation_status']
export type HistoryPaymentStatus = Database['public']['Enums']['payment_status']
export type HistoryReviewStatus = Database['public']['Enums']['review_status']

export interface ReservationHistoryItem {
  reservationId: string
  reservationStatus: ReservationHistoryStatus
  createdAt: string
  checkedInAt: string | null
  endedAt: string | null
  spaceId: string
  spaceName: string
  spaceListed: boolean
  unitId: string | null
  unitLabel: string
  paymentStatus: HistoryPaymentStatus
  feeAmount: number
  refundedAt: string | null
  reviewId: string | null
  reviewStatus: HistoryReviewStatus | null
}

export interface ReservationHistoryPage {
  items: ReservationHistoryItem[]
  hasMore: boolean
}

export interface GetReservationHistoryOptions {
  /** How many items to display (1..100, default 20). Asks Postgres for `shown + 1` to set `hasMore`. */
  shown?: number
  offset?: number
}

/**
 * Server-only query helper (STORY-16, TSK-16.3).
 * Reads the signed-in caller's paid, ended reservations through `public.my_reservation_history`.
 * Asks for `shown + 1` rows to know whether more rows exist.
 * Returns `null` on a database or transport error.
 */
export async function getReservationHistory(
  supabase: SupabaseClient<Database>,
  options?: GetReservationHistoryOptions,
): Promise<ReservationHistoryPage | null> {
  const rawShown = options?.shown ?? DEFAULT_HISTORY_SHOW_COUNT
  const shown = Number.isFinite(rawShown)
    ? Math.min(Math.max(Math.trunc(rawShown), 1), MAX_HISTORY_SHOW_COUNT)
    : DEFAULT_HISTORY_SHOW_COUNT

  const rawOffset = options?.offset ?? 0
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0

  const { data, error } = await supabase.rpc('my_reservation_history', {
    p_page_size: shown + 1,
    p_page_offset: offset,
  })

  if (error || !data) {
    return null
  }

  const hasMore = data.length > shown
  const items: ReservationHistoryItem[] = data.slice(0, shown).map((row) => ({
    reservationId: row.reservation_id,
    reservationStatus: row.reservation_status,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at ?? null,
    endedAt: row.ended_at ?? null,
    spaceId: row.space_id,
    spaceName: row.space_name,
    spaceListed: row.space_listed,
    unitId: row.unit_id ?? null,
    unitLabel: row.unit_label,
    paymentStatus: row.payment_status,
    feeAmount: row.fee_amount,
    refundedAt: row.refunded_at ?? null,
    reviewId: row.review_id ?? null,
    reviewStatus: row.review_status ?? null,
  }))

  return { items, hasMore }
}
