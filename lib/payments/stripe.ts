// The Stripe API calls: make a hosted Checkout Session, and expire one (sandbox
// payment confirmation flow §1.1, D-070), and refund a paid fee, or find its earlier
// refund (STORY-14 design §2, D-088). Plain fetch to Stripe's form-encoded REST API,
// no SDK (D-070). Server only: it reads STRIPE_SECRET_KEY, which must never reach a
// browser.
import 'server-only'

export class StripeApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly type?: string,
  ) {
    super(message)
    this.name = 'StripeApiError'
  }
}

type Env = Record<string, string | undefined>

/**
 * The sandbox's secret key, or a thrown error. Worq never takes live payments
 * (D-005), so anything but a test key, secret or restricted, is refused before it
 * can be sent anywhere.
 */
export function sandboxSecretKey(env: Env = process.env): string {
  const key = env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set. See docs/DEVELOPMENT.md.')
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error(
      'STRIPE_SECRET_KEY must be a sandbox key (sk_test_ or rk_test_), never a live one (D-005).',
    )
  }
  return key
}

/**
 * The Stripe API version every call asks for (D-070): the sandbox's default on
 * 2026-11-14, which the Dashboard endpoint and `stripe listen` events also use.
 * Changing it changes D-070 and the endpoint too.
 */
export const STRIPE_API_VERSION = '2026-10-28.endive'

/** STRIPE_API_URL lets a test point the calls at a stub. */
export function stripeApiUrl(env: Env = process.env): string {
  return (env.STRIPE_API_URL?.trim() || 'https://api.stripe.com').replace(/\/+$/, '')
}

export interface CheckoutSessionInput {
  reservationId: string
  /** Whole centavos, copied onto the hold's payment (D-049, D-067). */
  feeAmount: number
  /** The line item's name, such as "Reservation fee: S4, Kapihan Study Hall". */
  description: string
  successUrl: string
  cancelUrl: string
  /** Unix seconds. Stripe refuses anything sooner than 30 minutes after it makes the session. */
  expiresAt: number
}

/** The form body for POST /v1/checkout/sessions (D-070). */
export function checkoutSessionForm(input: CheckoutSessionInput): URLSearchParams {
  if (!Number.isInteger(input.feeAmount) || input.feeAmount <= 0) {
    throw new Error('feeAmount must be a positive whole number of centavos')
  }
  return new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'php',
    'line_items[0][price_data][unit_amount]': String(input.feeAmount),
    'line_items[0][price_data][product_data][name]': input.description,
    // The fee always in pesos: Adaptive Pricing would show a converted price to a
    // visitor from abroad (D-070). No payment_method_types: Stripe's API refuses it
    // now, and the sandbox's Dashboard settings choose the methods (card and Link).
    'adaptive_pricing[enabled]': 'false',
    expires_at: String(input.expiresAt),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // The webhook reads metadata.reservation_id (design §2). The other two only
    // help someone find the hold from the Stripe Dashboard, as STORY-14's refunds will.
    'metadata[reservation_id]': input.reservationId,
    client_reference_id: input.reservationId,
    'payment_intent_data[metadata][reservation_id]': input.reservationId,
  })
}

interface StripeDeps {
  env?: Env
  fetch?: typeof fetch
}

/** Long enough for Stripe, short enough that the Seeker sees "Try again" (W14). */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * One call to Stripe, with the sandbox key and the pinned API version (D-070). The key
 * is checked before anything is sent. A timeout rejects with a DOMException, and a
 * network failure with fetch's own error.
 */
async function send(
  method: 'GET' | 'POST',
  pathAndQuery: string,
  extraHeaders: Record<string, string>,
  body: string | undefined,
  deps: StripeDeps,
): Promise<unknown> {
  const env = deps.env ?? process.env
  const response = await (deps.fetch ?? fetch)(`${stripeApiUrl(env)}${pathAndQuery}`, {
    method,
    // The caller's headers first, so none of them can replace the key or the version.
    headers: {
      ...extraHeaders,
      Authorization: `Bearer ${sandboxSecretKey(env)}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (json as { error?: { message?: string; type?: string } } | null)?.error
    throw new StripeApiError(
      response.status,
      error?.message ?? `Stripe answered ${response.status}`,
      error?.type,
    )
  }
  return json
}

/** A form-encoded POST. `headers` adds to the fixed ones, such as an Idempotency-Key. */
function post(
  path: string,
  form: URLSearchParams | null,
  deps: StripeDeps,
  headers: Record<string, string> = {},
): Promise<unknown> {
  return send(
    'POST',
    path,
    { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    form?.toString() ?? '',
    deps,
  )
}

/** The GET twin of post, for Stripe's list endpoints. */
function get(path: string, query: URLSearchParams, deps: StripeDeps): Promise<unknown> {
  return send('GET', `${path}?${query.toString()}`, {}, undefined, deps)
}

/** Makes the hosted checkout. Throws a StripeApiError, or a network or timeout error. */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
  deps: StripeDeps = {},
): Promise<{ id: string; url: string }> {
  const json = (await post(
    '/v1/checkout/sessions',
    checkoutSessionForm(input),
    deps,
  )) as {
    id?: unknown
    url?: unknown
  } | null
  if (
    typeof json?.id !== 'string' ||
    !json.id.startsWith('cs_') ||
    typeof json.url !== 'string'
  ) {
    throw new StripeApiError(502, 'Stripe answered without a checkout id and URL')
  }
  return { id: json.id, url: json.url }
}

/** Ends an open checkout, so it can't be paid (W15, W17, R4). */
export async function expireCheckoutSession(
  sessionId: string,
  deps: StripeDeps = {},
): Promise<void> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error('Not a Checkout Session id')
  await post(`/v1/checkout/sessions/${sessionId}/expire`, null, deps)
}

/** A refund Stripe accepted: it succeeded, or Stripe is still making it (D-088). */
export interface AcceptedRefund {
  id: string
  status: 'succeeded' | 'pending'
}

const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9_]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function acceptedRefund(refund: unknown): AcceptedRefund | null {
  const { id, status } = (refund ?? {}) as { id?: unknown; status?: unknown }
  if (typeof id !== 'string' || !id.startsWith('re_')) return null
  if (status !== 'succeeded' && status !== 'pending') return null
  return { id, status }
}

export interface RefundInput {
  /** The payment's gateway reference, `payments.external_payment_id` (D-070). */
  paymentIntentId: string
  /** Worq's `payments.id`: the idempotency key and the refund's metadata. */
  paymentId: string
}

/**
 * Refunds the whole fee of one payment in test mode (D-088). One Idempotency-Key per
 * payment, so a double click or a retry within Stripe's 24 hours gets the same refund
 * back. Throws a StripeApiError on an error answer, a 402 for a refund that failed or
 * was cancelled (Stripe's "valid but failed"), and a 502 for an answer with no `re_`
 * id. A timeout throws a DOMException, and a network failure fetch's own error.
 */
export async function createRefund(
  input: RefundInput,
  deps: StripeDeps = {},
): Promise<AcceptedRefund> {
  if (!PAYMENT_INTENT_ID.test(input.paymentIntentId)) {
    throw new Error('Not a PaymentIntent id')
  }
  if (!UUID.test(input.paymentId)) throw new Error('Not a payment id')

  const json = (await post(
    '/v1/refunds',
    new URLSearchParams({
      payment_intent: input.paymentIntentId,
      'metadata[payment_id]': input.paymentId,
    }),
    deps,
    { 'Idempotency-Key': `refund-${input.paymentId}` },
  )) as { id?: unknown; status?: unknown } | null

  if (typeof json?.id !== 'string' || !json.id.startsWith('re_')) {
    throw new StripeApiError(502, 'Stripe answered without a refund id')
  }
  const refund = acceptedRefund(json)
  if (!refund) {
    throw new StripeApiError(402, `Stripe's refund ${json.id} is ${String(json.status)}`)
  }
  return refund
}

/**
 * The payment intent's refund that succeeded or is pending, or null (design §1). It
 * reads up to 10, because a refund that failed can sit beside the one that succeeded.
 * Throws as createRefund does.
 */
export async function findRefund(
  input: Pick<RefundInput, 'paymentIntentId'>,
  deps: StripeDeps = {},
): Promise<AcceptedRefund | null> {
  if (!PAYMENT_INTENT_ID.test(input.paymentIntentId)) {
    throw new Error('Not a PaymentIntent id')
  }
  const json = (await get(
    '/v1/refunds',
    new URLSearchParams({ payment_intent: input.paymentIntentId, limit: '10' }),
    deps,
  )) as { data?: unknown } | null

  if (!Array.isArray(json?.data)) {
    throw new StripeApiError(502, 'Stripe answered without a list of refunds')
  }
  for (const refund of json.data) {
    const accepted = acceptedRefund(refund)
    if (accepted) return accepted
  }
  return null
}
