import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { reservationIdSchema } from '@/lib/validation/reservation'
import { spaceIdSchema } from '@/lib/validation/space'

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

/** What a hold in one Space costs and allows, from `public.hold_terms` (design §2). */
export interface HoldTerms {
  /** Whole centavos (D-049, D-067). */
  feeAmount: number
  paymentWindowMinutes: number
  maxWaitWindowMinutes: number
  isOpen: boolean
  /** When the Space next closes, or null for a Space open around the clock. */
  nextClosingAt: string | null
  /** Every wait window up to the Space's maximum that fits before closing (D-048). */
  waitWindowMinutes: number[]
}

/**
 * Server-only query helper (STORY-09, TSK-09.6). Zero rows, a malformed id or an
 * error give null: hold_terms returns nothing for a Space the caller may not see
 * (D-055).
 */
export async function getHoldTerms(
  supabase: SupabaseClient<Database>,
  spaceId: string,
): Promise<HoldTerms | null> {
  const parsed = spaceIdSchema.safeParse(spaceId)
  if (!parsed.success) return null

  const { data, error } = await supabase
    .rpc('hold_terms', { p_space_id: parsed.data })
    .maybeSingle()
  if (error || !data) return null

  return {
    feeAmount: data.fee_amount,
    paymentWindowMinutes: data.payment_window_minutes,
    maxWaitWindowMinutes: data.max_wait_window_minutes,
    isOpen: data.is_open,
    nextClosingAt: data.next_closing_at ?? null,
    waitWindowMinutes: [...(data.wait_window_minutes ?? [])].sort((a, b) => a - b),
  }
}

export type ViewerRole = Database['public']['Enums']['user_role']

/** Who is looking at a Space profile, for the hold panel (design §3). */
export interface HoldViewer {
  /** Null for a signed-out visitor. */
  role: ViewerRole | null
  /** A Seeker's current hold, if they have one (D-008). */
  currentHold: MyReservation | null
}

/**
 * Server-only query helper (STORY-09, TSK-09.6). The role comes from the viewer's own
 * profiles row, never user_metadata (STORY-03 design §2).
 */
export async function getHoldViewer(
  supabase: SupabaseClient<Database>,
): Promise<HoldViewer> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { role: null, currentHold: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role ?? null
  const currentHold = role === 'seeker' ? await getMyReservation(supabase) : null
  return { role, currentHold }
}
