// Opens the hosted checkout for a hold: reuse the one it has, or make one and attach
// it, expiring any that lost (sandbox payment confirmation flow §1.1 and §4.2, W2,
// W14, W15, W17). Pure: TSK-09.5's startCheckout passes the Stripe calls and the
// attach_checkout_session call in, so each branch is tested without either.

/**
 * Stripe refuses an `expires_at` sooner than 30 minutes after it makes the session, by
 * its own clock. One more minute keeps a slow request or a clock a little behind
 * Stripe's from being refused (D-070, flow §6).
 */
export const CHECKOUT_EXPIRY_SECONDS = 31 * 60

export interface CheckoutHold {
  reservationId: string
  /** Whole centavos, copied onto the hold's payment (D-049). */
  feeAmount: number
  /** The checkout the hold already has, from my_reservation or hold_unit (W2). */
  checkoutUrl: string | null
  /** The line item's name, such as "Reservation fee: S4, Kapihan Study Hall". */
  description: string
}

export interface NewCheckout {
  reservationId: string
  feeAmount: number
  description: string
  successUrl: string
  cancelUrl: string
  expiresAt: number
}

/** What attach_checkout_session gave back through supabase-js. */
export interface AttachAnswer {
  data: unknown
  error: { code?: string; hint?: string; message?: string } | null
}

export interface CheckoutDeps {
  createSession: (input: NewCheckout) => Promise<{ id: string; url: string }>
  expireSession: (sessionId: string) => Promise<void>
  attachSession: (input: {
    reservationId: string
    sessionId: string
    url: string
  }) => Promise<AttachAnswer>
  log: (message: string, details?: Record<string, unknown>) => void
}

export type CheckoutResult =
  /** Go to Stripe. `reused` is true for the hold's own checkout (W2) or the first tab's (W15). */
  | { kind: 'redirect'; url: string; reused: boolean }
  /** Stripe failed or timed out. The hold stays; offer Try again or Cancel hold (W14). */
  | { kind: 'create_failed' }
  /** The hold ended before the checkout could be attached (W17). */
  | { kind: 'hold_ended' }
  /** The attach call failed for another reason. The new checkout was expired. */
  | { kind: 'attach_failed' }

/**
 * Expires a checkout, logging instead of throwing: if the call fails, the checkout
 * still ends on its own when its 31 minutes pass (flow §6's accepted risk).
 */
export async function expireCheckoutQuietly(
  sessionId: string,
  deps: Pick<CheckoutDeps, 'expireSession' | 'log'>,
): Promise<void> {
  try {
    await deps.expireSession(sessionId)
  } catch (error) {
    deps.log('Could not expire a checkout', {
      checkoutSessionId: sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function attachedUrl(data: unknown): { attached: boolean; url: string } | null {
  const answer = data as { attached?: unknown; checkout_url?: unknown } | null
  if (typeof answer?.attached !== 'boolean' || typeof answer.checkout_url !== 'string')
    return null
  return { attached: answer.attached, url: answer.checkout_url }
}

export async function openCheckout(
  hold: CheckoutHold,
  urls: { successUrl: string; cancelUrl: string },
  nowSeconds: number,
  deps: CheckoutDeps,
): Promise<CheckoutResult> {
  // W2: the hold has a checkout already, from another tab or an earlier tap.
  if (hold.checkoutUrl) return { kind: 'redirect', url: hold.checkoutUrl, reused: true }

  let session: { id: string; url: string }
  try {
    session = await deps.createSession({
      reservationId: hold.reservationId,
      feeAmount: hold.feeAmount,
      description: hold.description,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      expiresAt: nowSeconds + CHECKOUT_EXPIRY_SECONDS,
    })
  } catch (error) {
    deps.log('Could not create a checkout', {
      reservationId: hold.reservationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: 'create_failed' }
  }

  let answer: AttachAnswer
  try {
    answer = await deps.attachSession({
      reservationId: hold.reservationId,
      sessionId: session.id,
      url: session.url,
    })
  } catch {
    answer = { data: null, error: { message: 'attach_checkout_session threw' } }
  }

  if (answer.error) {
    // The new checkout isn't stored anywhere, so nobody may pay it.
    await expireCheckoutQuietly(session.id, deps)
    if (answer.error.code === 'P0001' && answer.error.hint === 'hold_ended')
      return { kind: 'hold_ended' }
    deps.log('attach_checkout_session failed', {
      reservationId: hold.reservationId,
      code: answer.error.code,
    })
    return { kind: 'attach_failed' }
  }

  const attached = attachedUrl(answer.data)
  if (!attached) {
    await expireCheckoutQuietly(session.id, deps)
    return { kind: 'attach_failed' }
  }
  if (!attached.attached) {
    // W15: another tab attached first. Keep its checkout, end this one.
    await expireCheckoutQuietly(session.id, deps)
    return { kind: 'redirect', url: attached.url, reused: true }
  }
  return { kind: 'redirect', url: attached.url, reused: false }
}
