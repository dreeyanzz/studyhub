// What the Stripe webhook route answers for one delivery (sandbox payment
// confirmation flow §1 to §3, W3 to W8, W21, W22, D-010, D-064, D-070). Pure: the
// route passes the raw body, the header, the secret, the time and the database call,
// so every branch is tested without Stripe or Postgres.
import {
  confirmOutcomeSchema,
  PAID_CHECKOUT_EVENTS,
  paidEventSchema,
  reservationIdOf,
  stripeEventSchema,
} from '@/lib/validation/stripe'

import { verifySignature } from './signature'

export interface ConfirmPaymentInput {
  reservationId: string
  checkoutSessionId: string
  externalPaymentId: string
}

/** Calls `public.confirm_payment` with the secret key and returns its JSON, or throws. */
export type ConfirmPayment = (input: ConfirmPaymentInput) => Promise<unknown>

/** Never handed a secret or a whole body: only ids and short reasons. */
export type WebhookLog = (message: string, details?: Record<string, unknown>) => void

export interface WebhookResult {
  status: number
  body: Record<string, unknown>
}

const ok = (body: Record<string, unknown>): WebhookResult => ({ status: 200, body })
const fail = (status: number, error: string): WebhookResult => ({
  status,
  body: { error },
})

export async function handleStripeWebhook(input: {
  rawBody: string
  signatureHeader: string | null
  secret: string
  nowSeconds: number
  confirmPayment: ConfirmPayment
  log: WebhookLog
}): Promise<WebhookResult> {
  // 1. The signature, before anything reads the body (flow §3.1). Bad or missing is
  //    401 (W3), signed too long ago is 400 (W4). Neither reaches the database.
  const signature = verifySignature({
    header: input.signatureHeader,
    rawBody: input.rawBody,
    secret: input.secret,
    nowSeconds: input.nowSeconds,
  })
  if (!signature.ok) {
    return signature.reason === 'stale'
      ? fail(400, 'stale_timestamp')
      : fail(401, 'invalid_signature')
  }

  // 2. The event. A signed body that isn't an event is Stripe's problem, not a retry's,
  //    but 400 makes it show as failed in the Dashboard.
  let json: unknown
  try {
    json = JSON.parse(input.rawBody)
  } catch {
    return fail(400, 'invalid_json')
  }
  const event = stripeEventSchema.safeParse(json)
  if (!event.success) return fail(400, 'invalid_event')

  // 3. Sandbox only (D-005, flow §3.1 step 4): a live event never reserves a unit.
  if (event.data.livemode) {
    input.log('Refused a live-mode Stripe event', { eventId: event.data.id })
    return fail(400, 'livemode_refused')
  }

  // 4. Only a paid checkout confirms a payment. Anything else is answered 200, so
  //    Stripe stops sending it.
  if (!PAID_CHECKOUT_EVENTS.includes(event.data.type)) {
    return ok({ received: true, ignored: 'event_type' })
  }
  const session = paidEventSchema.safeParse(event.data.data.object)
  if (!session.success) return fail(400, 'invalid_event')
  if (session.data.payment_status !== 'paid') {
    return ok({ received: true, ignored: 'not_paid' })
  }

  const reservationId = reservationIdOf(session.data)
  if (!reservationId) {
    // A checkout made outside Worq, in the same sandbox. A retry can't help.
    input.log('Ignored a paid checkout with no reservation', {
      eventId: event.data.id,
      checkoutSessionId: session.data.id,
    })
    return ok({ received: true, ignored: 'no_reservation' })
  }
  if (!session.data.payment_intent) return fail(400, 'invalid_event')

  // 5. The database (flow §4.1). Only a failed call is 500, so Stripe delivers it
  //    again (W22). Every outcome is 200 with JSON (flow §3.2).
  let answer: unknown
  try {
    answer = await input.confirmPayment({
      reservationId,
      checkoutSessionId: session.data.id,
      externalPaymentId: session.data.payment_intent,
    })
  } catch (error) {
    input.log('confirm_payment failed', {
      eventId: event.data.id,
      reservationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return fail(500, 'confirm_failed')
  }

  const outcome = confirmOutcomeSchema.safeParse(answer)
  if (!outcome.success) {
    input.log('confirm_payment answered something unexpected', {
      eventId: event.data.id,
      reservationId,
    })
    return fail(500, 'confirm_failed')
  }
  if (outcome.data.outcome === 'not_found') {
    // W21: a reservation id that doesn't exist. Logged, and answered 200.
    input.log('Paid checkout names an unknown reservation', {
      eventId: event.data.id,
      reservationId,
    })
  }
  return ok({ received: true, ...outcome.data })
}
