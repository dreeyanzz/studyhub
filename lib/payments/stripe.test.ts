import { describe, expect, it, vi } from 'vitest'

import {
  checkoutSessionForm,
  createCheckoutSession,
  createRefund,
  expireCheckoutSession,
  findRefund,
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
  it('posts the form with the secret key and the pinned API version, and returns the id and URL', async () => {
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
      // D-070: the sandbox's default on 2026-11-14, so events and API answers keep one shape.
      'Stripe-Version': '2026-10-28.endive',
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

const refundInput = {
  paymentIntentId: 'pi_test_14_01',
  paymentId: '21000000-0000-4000-8000-000000000001',
}

// What fetch rejects with when AbortSignal.timeout fires.
const timeout = () => new DOMException('The operation timed out.', 'TimeoutError')

describe('createRefund (STORY-14 design §2, D-088)', () => {
  it('posts the payment intent and the payment id, with one idempotency key per payment', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { id: 're_test_1', object: 'refund', status: 'succeeded' }),
    )
    const refund = await createRefund(refundInput, { env, fetch: fetchStub })

    expect(refund).toEqual({ id: 're_test_1', status: 'succeeded' })
    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchStub.mock.calls[0]!
    expect(url).toBe('http://stripe.stub/v1/refunds')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'Idempotency-Key': 'refund-21000000-0000-4000-8000-000000000001',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Bearer sk_test_example',
      'Stripe-Version': '2026-10-28.endive',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    // The whole fee, always: no amount (D-088).
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      payment_intent: 'pi_test_14_01',
      'metadata[payment_id]': '21000000-0000-4000-8000-000000000001',
    })
  })

  it('returns a refund Stripe is still making as pending', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { id: 're_test_2', status: 'pending' }),
    )
    await expect(createRefund(refundInput, { env, fetch: fetchStub })).resolves.toEqual({
      id: 're_test_2',
      status: 'pending',
    })
  })

  it("throws Stripe's error status and type when it refuses the refund", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(400, {
        error: {
          type: 'invalid_request_error',
          code: 'charge_already_refunded',
          message: 'Charge ch_test_1 has already been refunded.',
        },
      }),
    )
    const failure = createRefund(refundInput, { env, fetch: fetchStub })
    await expect(failure).rejects.toBeInstanceOf(StripeApiError)
    await expect(failure).rejects.toMatchObject({
      status: 400,
      type: 'invalid_request_error',
    })
  })

  it("throws a 5xx answer with Stripe's status", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(500, {
        error: { type: 'api_error', message: 'Something went wrong' },
      }),
    )
    await expect(
      createRefund(refundInput, { env, fetch: fetchStub }),
    ).rejects.toMatchObject({ status: 500, type: 'api_error' })
  })

  it('throws a 402 for a refund that failed or was cancelled', async () => {
    for (const status of ['failed', 'canceled', 'requires_action']) {
      const fetchStub = vi.fn<typeof fetch>(async () =>
        jsonResponse(200, { id: 're_test_3', status }),
      )
      const failure = createRefund(refundInput, { env, fetch: fetchStub })
      await expect(failure).rejects.toBeInstanceOf(StripeApiError)
      await expect(failure).rejects.toMatchObject({ status: 402 })
    }
  })

  it('throws a 502 for an answer without a re_ id', async () => {
    for (const body of [
      { status: 'succeeded' },
      { id: 'pi_test_1', status: 'succeeded' },
      null,
    ]) {
      const fetchStub = vi.fn<typeof fetch>(async () => jsonResponse(200, body))
      await expect(
        createRefund(refundInput, { env, fetch: fetchStub }),
      ).rejects.toMatchObject({ name: 'StripeApiError', status: 502 })
    }
  })

  it('passes a timeout on as the DOMException fetch rejects with', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => {
      throw timeout()
    })
    await expect(
      createRefund(refundInput, { env, fetch: fetchStub }),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('refuses a bad payment intent or payment id, or a live key, before any request', async () => {
    const fetchStub = vi.fn<typeof fetch>()
    for (const bad of [
      { ...refundInput, paymentIntentId: 're_test_1' },
      { ...refundInput, paymentIntentId: 'pi_test/../x' },
      { ...refundInput, paymentId: 'not-a-uuid' },
    ]) {
      await expect(createRefund(bad, { env, fetch: fetchStub })).rejects.toThrow()
    }
    await expect(
      createRefund(refundInput, {
        env: { STRIPE_SECRET_KEY: 'sk_live_abc' },
        fetch: fetchStub,
      }),
    ).rejects.toThrow(/sandbox key/)
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('findRefund (STORY-14 design §1, D-088)', () => {
  it('reads up to 10 refunds of the payment intent', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { object: 'list', data: [], has_more: false }),
    )
    await findRefund({ paymentIntentId: 'pi_test_14_01' }, { env, fetch: fetchStub })

    const [url, init] = fetchStub.mock.calls[0]!
    expect(url).toBe(
      'http://stripe.stub/v1/refunds?payment_intent=pi_test_14_01&limit=10',
    )
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect(init?.headers).toEqual({
      Authorization: 'Bearer sk_test_example',
      'Stripe-Version': '2026-10-28.endive',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns the refund that succeeded, past one that failed', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, {
        object: 'list',
        data: [
          { id: 're_test_failed', status: 'failed' },
          { id: 're_test_ok', status: 'succeeded' },
        ],
      }),
    )
    await expect(
      findRefund({ paymentIntentId: 'pi_test_14_01' }, { env, fetch: fetchStub }),
    ).resolves.toEqual({ id: 're_test_ok', status: 'succeeded' })
  })

  it('returns a pending refund', async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { data: [{ id: 're_test_p', status: 'pending' }] }),
    )
    await expect(
      findRefund({ paymentIntentId: 'pi_test_14_01' }, { env, fetch: fetchStub }),
    ).resolves.toEqual({ id: 're_test_p', status: 'pending' })
  })

  it('returns none when every refund failed or was cancelled, or there is none', async () => {
    for (const data of [
      [],
      [
        { id: 're_test_f', status: 'failed' },
        { id: 're_test_c', status: 'canceled' },
      ],
    ]) {
      const fetchStub = vi.fn<typeof fetch>(async () => jsonResponse(200, { data }))
      await expect(
        findRefund({ paymentIntentId: 'pi_test_14_01' }, { env, fetch: fetchStub }),
      ).resolves.toBeNull()
    }
  })

  it('throws on an error answer, an answer with no list, and a timeout', async () => {
    const answers: Array<() => Promise<Response>> = [
      async () => jsonResponse(500, { error: { type: 'api_error', message: 'Oops' } }),
      async () => jsonResponse(200, { object: 'refund' }),
      async () => {
        throw timeout()
      },
    ]
    const expected = [
      { name: 'StripeApiError', status: 500 },
      { name: 'StripeApiError', status: 502 },
      { name: 'TimeoutError' },
    ]
    for (const [i, answer] of answers.entries()) {
      const fetchStub = vi.fn<typeof fetch>(answer)
      await expect(
        findRefund({ paymentIntentId: 'pi_test_14_01' }, { env, fetch: fetchStub }),
      ).rejects.toMatchObject(expected[i]!)
    }
  })

  it('refuses an id that is not a payment intent, before any request', async () => {
    const fetchStub = vi.fn<typeof fetch>()
    await expect(
      findRefund({ paymentIntentId: 'pi_x&limit=100' }, { env, fetch: fetchStub }),
    ).rejects.toThrow()
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
