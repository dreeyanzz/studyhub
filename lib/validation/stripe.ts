import { z } from 'zod'

// The parts of a Stripe webhook event that the route reads (STORY-09 design §2,
// sandbox payment confirmation flow §3, D-070). Unknown fields are allowed and
// dropped: Stripe adds fields without notice, and the signature already proves
// where the body came from.

/** Every event: what it is, and whether it is live. Worq takes sandbox events only (D-005). */
export const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  livemode: z.boolean(),
  data: z.object({ object: z.unknown() }),
})

/**
 * The events that can mean a checkout was paid. A card or Link payment is paid when
 * its checkout completes. A delayed method, if the sandbox's Dashboard settings ever
 * offer one, completes unpaid and is paid later, in the second event (D-070).
 */
export const PAID_CHECKOUT_EVENTS: readonly string[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]

/**
 * The Checkout Session in one of those events. `payment_status` must be `paid`;
 * anything else is answered 200 and ignored. The reservation id is the metadata
 * `startCheckout` set; a checkout without one isn't Worq's.
 */
export const paidEventSchema = z.object({
  id: z.string().startsWith('cs_'),
  payment_status: z.string(),
  // A string id in snapshot events. Null only when nothing was paid.
  payment_intent: z.string().startsWith('pi_').nullable(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

export type PaidCheckoutSession = z.infer<typeof paidEventSchema>

/** The reservation a checkout pays for, or null when it carries no valid one. */
export function reservationIdOf(session: PaidCheckoutSession): string | null {
  const parsed = z.uuid().safeParse(session.metadata?.reservation_id)
  return parsed.success ? parsed.data : null
}

/** What `public.confirm_payment` answers (flow §4.1). */
export const confirmOutcomeSchema = z.object({
  outcome: z.enum(['confirmed', 'already_processed', 'late_payment', 'not_found']),
  reservation_status: z.string().optional(),
  payment_status: z.string().optional(),
})

export type ConfirmOutcome = z.infer<typeof confirmOutcomeSchema>
