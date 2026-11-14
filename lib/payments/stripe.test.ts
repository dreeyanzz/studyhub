import { describe, expect, it, vi } from 'vitest'

import {
  checkoutSessionForm,
  createCheckoutSession,
  expireCheckoutSession,
  sandboxSecretKey,
  StripeApiError,
  stripeApiUrl,
  type CheckoutSessionInput,
} from './stripe'

const input: CheckoutSessionInput = {
  reservationId: '10000000-0000-4000-8000-000000000001',
  feeAmount: 5000,
  description: 'Reservation fee: S4, Kapihan Study Hall',
  successUrl: 'http://localhost:3000/seeker/reservations/r1/confirmation',
  cancelUrl: 'http://localhost:3000/seeker/reservations/r1/confirmation?status=cancelled',
  expiresAt: 1_794_631_080,
}
const env = {
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_API_URL: 'http://stripe.stub/',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sandboxSecretKey (D-005)', () => {
  it('takes a sandbox secret or restricted key', () => {
    expect(sandboxSecretKey({ STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('sk_test_abc')
    expect(sandboxSecretKey({ STRIPE_SECRET_KEY: ' rk_test_abc ' })).toBe('rk_test_abc')
  })

  it('refuses a live key, a publishable key, or none', () => {
    for (const key of [
      'sk_live_abc',
      'rk_live_abc',
      'pk_test_abc',
      'whsec_abc',
      '',
      undefined,
    ]) {
      expect(() => sandboxSecretKey({ STRIPE_SECRET_KEY: key })).toThrow()
    }
  })
})

describe('stripeApiUrl', () => {
  it("defaults to Stripe's API, and takes a stub without its trailing slash", () => {
    expect(stripeApiUrl({})).toBe('https://api.stripe.com')
    expect(stripeApiUrl({ STRIPE_API_URL: 'http://stripe.stub/' })).toBe(
      'http://stripe.stub',
    )
  })
})

describe('checkoutSessionForm (D-070)', () => {
  it('asks for one peso line item for the fee, Adaptive Pricing off, and the reservation id', () => {
    const form = Object.fromEntries(checkoutSessionForm(input))
    expect(form).toEqual({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'php',
      'line_items[0][price_data][unit_amount]': '5000',
      'line_items[0][price_data][product_data][name]':
        'Reservation fee: S4, Kapihan Study Hall',
      'adaptive_pricing[enabled]': 'false',
      expires_at: '1794631080',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      'metadata[reservation_id]': input.reservationId,
      client_reference_id: input.reservationId,
      'payment_intent_data[metadata][reservation_id]': input.reservationId,
    })
  })

  it('refuses a fee that is not a positive whole number of centavos', () => {
    for (const feeAmount of [0, -5000, 50.5, Number.NaN]) {
      expect(() => checkoutSessionForm({ ...input, feeAmount })).toThrow()
    }
  })
})

describe('createCheckoutSession', () => {
  it('posts the form with the secret key, and returns the id and URL', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, {
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      }),
    )
    const session = await createCheckoutSession(input, { env, fetch: fetchStub })

    expect(session).toEqual({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    })
    const [url, init] = fetchStub.mock.calls[0]!
    expect(url).toBe('http://stripe.stub/v1/checkout/sessions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer sk_test_example',
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(new URLSearchParams(String(init?.body)).get('metadata[reservation_id]')).toBe(
      input.reservationId,
    )
  })

  it("throws Stripe's error message and status", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(400, {
        error: {
          type: 'invalid_request_error',
          message: 'The `expires_at` timestamp must be at least 30 minutes',
        },
      }),
    )
    const failure = createCheckoutSession(input, { env, fetch: fetchStub })
    await expect(failure).rejects.toBeInstanceOf(StripeApiError)
    await expect(failure).rejects.toMatchObject({
      status: 400,
      type: 'invalid_request_error',
    })
  })

  it('throws when Stripe answers without an id and URL', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { object: 'checkout.session' }),
    )
    await expect(
      createCheckoutSession(input, { env, fetch: fetchStub }),
    ).rejects.toBeInstanceOf(StripeApiError)
  })

  it('never sends a request with a live key', async () => {
    const fetchStub = vi.fn<typeof fetch>()
    await expect(
      createCheckoutSession(input, {
        env: { STRIPE_SECRET_KEY: 'sk_live_abc' },
        fetch: fetchStub,
      }),
    ).rejects.toThrow(/sandbox key/)
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('expireCheckoutSession', () => {
  it('posts to the expire endpoint of that checkout', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { id: 'cs_test_1', status: 'expired' }),
    )
    await expireCheckoutSession('cs_test_1', { env, fetch: fetchStub })
    expect(fetchStub.mock.calls[0]![0]).toBe(
      'http://stripe.stub/v1/checkout/sessions/cs_test_1/expire',
    )
  })

  it('refuses an id that is not a Checkout Session, before any request', async () => {
    const fetchStub = vi.fn<typeof fetch>()
    await expect(
      expireCheckoutSession('../v1/refunds', { env, fetch: fetchStub }),
    ).rejects.toThrow()
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
