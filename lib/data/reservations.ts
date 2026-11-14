import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { reservationIdSchema } from '@/lib/validation/reservation'

type ReservationStatus = Database['public']['Enums']['reservation_status']
type PaymentStatus = Database['public']['Enums']['payment_status']

/**
 * The caller's own reservation, as `public.my_reservation` returns it (STORY-09
 * design §2). The generated types call every column a string, but several are null
 * by state: the booking token only while `reserved`, the checkout only while
 * `pending_payment` with a `pending` payment, and `ended_at` until the hold ends.
 */
export interface MyReservation {
  id: string
  status: ReservationStatus
  paymentStatus: PaymentStatus
  /** Whole centavos (D-049). */
  feeAmount: number
  spaceId: string
  spaceName: string
  spaceAddress: string
  /** Null once the unit is deleted after the hold ended (D-052). */
  unitId: string | null
  unitLabel: string
  zoneName: string | null
  waitWindowMinutes: number
  paymentWindowEndsAt: string
  waitWindowEndsAt: string | null
  bookingToken: string | null
  checkoutSessionId: string | null
  checkoutUrl: string | null
  endedAt: string | null
}

/**
 * Server-only query helper (STORY-09, TSK-09.5, D-047). Reads the signed-in Seeker's
 * reservation through `my_reservation`, which records lapses first, so a payment
 * window that has passed reads `expired`. With no id, it is their current hold.
 * Another Seeker's id, a malformed id, or a signed-out caller gives null.
 */
export async function getMyReservation(
  supabase: SupabaseClient<Database>,
  reservationId?: string,
): Promise<MyReservation | null> {
  let id: string | undefined
  if (reservationId !== undefined) {
    const parsed = reservationIdSchema.safeParse(reservationId)
    if (!parsed.success) return null
    id = parsed.data
  }

  const { data, error } = await supabase
    .rpc('my_reservation', id ? { p_reservation_id: id } : {})
    .maybeSingle()
  if (error || !data) return null

  return {
    id: data.id,
    status: data.status,
    paymentStatus: data.payment_status,
    feeAmount: data.fee_amount,
    spaceId: data.space_id,
    spaceName: data.space_name,
    spaceAddress: data.space_address,
    unitId: data.unit_id ?? null,
    unitLabel: data.unit_label,
    zoneName: data.zone_name ?? null,
    waitWindowMinutes: data.wait_window_minutes,
    paymentWindowEndsAt: data.payment_window_ends_at,
    waitWindowEndsAt: data.wait_window_ends_at ?? null,
    bookingToken: data.booking_token ?? null,
    checkoutSessionId: data.checkout_session_id ?? null,
    checkoutUrl: data.checkout_url ?? null,
    endedAt: data.ended_at ?? null,
  }
}
