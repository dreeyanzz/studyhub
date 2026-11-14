'use server'

// The hold page's two Server Actions (STORY-09 design §3, TSK-09.5, D-068).
// An action can be called directly, so each checks its own input and session. The
// database functions are the security boundary: attach_checkout_session and
// cancel_hold refuse anyone but the hold's Seeker (W16, N8).
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getMyReservation } from '@/lib/data/reservations'
import { expireCheckoutQuietly, openCheckout } from '@/lib/payments/checkout'
import { createCheckoutSession, expireCheckoutSession } from '@/lib/payments/stripe'
import { createClient } from '@/lib/supabase/server'
import { cancelHoldSchema, reservationIdSchema } from '@/lib/validation/reservation'

function log(message: string, details?: Record<string, unknown>) {
  console.warn(`[hold] ${message}`, details ?? {})
}

/**
 * The site's own origin, for Stripe's success and cancel URLs. Next refuses a Server
 * Action whose Origin header doesn't match its Host (the data security guide), so
 * the Origin header is this site's.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'https'
  return `${protocol}://${host}`
}

/**
 * "Continue to payment": reuses the hold's checkout, or makes one and attaches it
 * (flow §1.1, W2, W14, W15, W17), then sends the Seeker to Stripe.
 */
export async function startCheckout(reservationId: string): Promise<void> {
  const parsed = reservationIdSchema.safeParse(reservationId)
  if (!parsed.success) redirect('/seeker')
  const id = parsed.data
  const holdPath = `/seeker/reservations/${id}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(holdPath)}`)

  // my_reservation records lapses first (D-047), so a passed window reads expired.
  const hold = await getMyReservation(supabase, id)
  if (!hold) redirect('/seeker')
  if (hold.status !== 'pending_payment' || hold.paymentStatus !== 'pending') {
    // The hold page shows how it ended, or that it is already paid.
    redirect(holdPath)
  }

  const confirmationUrl = `${await siteOrigin()}${holdPath}/confirmation`
  const result = await openCheckout(
    {
      reservationId: id,
      feeAmount: hold.feeAmount,
      checkoutUrl: hold.checkoutUrl,
      description: `Reservation fee: ${hold.unitLabel}, ${hold.spaceName}`,
    },
    { successUrl: confirmationUrl, cancelUrl: `${confirmationUrl}?status=cancelled` },
    Math.floor(Date.now() / 1000),
    {
      createSession: (input) => createCheckoutSession(input),
      expireSession: (sessionId) => expireCheckoutSession(sessionId),
      attachSession: async ({ reservationId: rid, sessionId, url }) => {
        const { data, error } = await supabase.rpc('attach_checkout_session', {
          p_reservation_id: rid,
          p_checkout_session_id: sessionId,
          p_checkout_url: url,
        })
        return { data, error }
      },
      log,
    },
  )

  // redirect() throws, so every call sits outside a try (Next 16's redirect reference).
  if (result.kind === 'redirect') redirect(result.url)
  if (result.kind === 'hold_ended') redirect(holdPath)
  redirect(`${holdPath}?error=checkout`)
}

/**
 * "Cancel hold" (R4) or "Cancel reservation" (R8). `expectedStatus` is the status the
 * Seeker saw, so a payment that won the race is never cancelled (N21, D-050).
 */
export async function cancelHold(
  reservationId: string,
  expectedStatus: 'pending_payment' | 'reserved',
): Promise<void> {
  const parsed = cancelHoldSchema.safeParse({ reservationId, expectedStatus })
  if (!parsed.success) redirect('/seeker')
  const { reservationId: id, expectedStatus: expected } = parsed.data
  const holdPath = `/seeker/reservations/${id}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(holdPath)}`)

  // Read the checkout first: my_reservation stops returning it once the hold ends.
  const before = await getMyReservation(supabase, id)
  if (!before) redirect('/seeker')

  const { error } = await supabase.rpc('cancel_hold', {
    p_reservation_id: id,
    p_expected_status: expected,
  })
  if (error) {
    const hint = error.code === 'P0001' ? error.hint : undefined
    // N21: the payment was confirmed between the page and the tap.
    if (hint === 'hold_changed' && expected === 'pending_payment') {
      redirect(`${holdPath}?notice=payment-won`)
    }
    // N11: it had already ended, or changed some other way. The page shows it now.
    if (hint === 'hold_changed' || hint === 'hold_ended') redirect(holdPath)
    // Checked in: STORY-10's check-out ends it, and /seeker shows it.
    if (hint === 'checked_in') redirect('/seeker')
    log('cancel_hold failed', { reservationId: id, code: error.code })
    redirect(`${holdPath}?error=cancel`)
  }

  // R4: end the hold's checkout too, so a late payment is less likely (design §3).
  if (before.checkoutSessionId) {
    await expireCheckoutQuietly(before.checkoutSessionId, {
      expireSession: (sessionId) => expireCheckoutSession(sessionId),
      log,
    })
  }
  redirect(holdPath)
}
