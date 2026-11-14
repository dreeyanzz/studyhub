// The Stripe API calls: make a hosted Checkout Session, and expire one (sandbox
// payment confirmation flow §1.1, D-070). Plain fetch to Stripe's form-encoded REST
// API, no SDK (D-070). Server only: it reads STRIPE_SECRET_KEY, which must never
// reach a browser.
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

async function post(
  path: string,
  form: URLSearchParams | null,
  deps: StripeDeps,
): Promise<unknown> {
  const env = deps.env ?? process.env
  const response = await (deps.fetch ?? fetch)(`${stripeApiUrl(env)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sandboxSecretKey(env)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: form?.toString() ?? '',
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
