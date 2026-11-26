import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

/** The ratings and comment of one of the caller's visible reviews, to prefill Edit your review. */
export interface HistoryReviewValues {
  quietness: number
  wifiReliability: number
  cleanliness: number
  comfort: number
  comment: string | null
}

const HISTORY_REVIEW_ID_SCHEMA = z.uuid()

/**
 * Server-only query helper (STORY-16 design §3 Screens 2 & 4, TSK-16.4).
 * Reads the current values of the caller's own **visible** reviews among `reviewIds`
 * (the rows the history page shows), so Edit your review opens prefilled. One query,
 * filtered by `author_id` so RLS never mixes in another Seeker's visible review.
 * Hidden and removed reviews can't be edited (D-080), so they are left out.
 * Returns an empty Map when there is nothing to read, and `null` on a database error.
 */
export async function getMyHistoryReviewValues(
  supabase: SupabaseClient<Database>,
  authorId: string,
  reviewIds: readonly string[],
): Promise<Map<string, HistoryReviewValues> | null> {
  const ids = [...new Set(reviewIds)].filter(
    (id) => HISTORY_REVIEW_ID_SCHEMA.safeParse(id).success,
  )
  if (ids.length === 0 || !HISTORY_REVIEW_ID_SCHEMA.safeParse(authorId).success) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('reviews')
    .select('id, quietness, wifi_reliability, cleanliness, comfort, comment')
    .in('id', ids)
    .eq('author_id', authorId)
    .eq('status', 'visible')

  if (error || !data) {
    return null
  }

  return new Map(
    data.map((row) => [
      row.id,
      {
        quietness: row.quietness,
        wifiReliability: row.wifi_reliability,
        cleanliness: row.cleanliness,
        comfort: row.comfort,
        comment: row.comment ?? null,
      },
    ]),
  )
}
