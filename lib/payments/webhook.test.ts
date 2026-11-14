import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { handleStripeWebhook, type ConfirmPayment } from './webhook'

// The flow's vitest/webhooks tests (sandbox payment confirmation flow §2, W3 to W8,
// W21, W22).

const secret = 'whsec_test_secret'
const now = 1_794_629_220
const reservationId = '10000000-0000-4000-8000-000000000001'

function completedEvent(
  overrides: {
    livemode?: boolean
    type?: string
    session?: Record<string, unknown>
  } = {},
) {
  return JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type: overrides.type ?? 'checkout.session.completed',
    livemode: overrides.livemode ?? false,
    data: {
      object: {
        id: 'cs_test_a1',
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_test_a1',
        metadata: { reservation_id: reservationId },
        ...overrides.session,
      },
    },
  })
}

function sign(body: string, timestamp = now) {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${v1},v0=ignored`
}

function run(
  body: string,
  options: { header?: string | null; confirm?: ConfirmPayment; nowSeconds?: number } = {},
) {
  const confirmPayment = vi.fn<ConfirmPayment>(
    options.confirm ??
      (async () => ({
        outcome: 'confirmed',
        reservation_status: 'reserved',
        payment_status: 'paid',
      })),
  )
  const log = vi.fn()
  const result = handleStripeWebhook({
    rawBody: body,
    signatureHeader: options.header === undefined ? sign(body) : options.header,
    secret,
    nowSeconds: options.nowSeconds ?? now + 5,
    confirmPayment,
    log,
  })
  return { result, confirmPayment, log }
}

describe('handleStripeWebhook: before the database', () => {
  it('rejects payload with invalid or missing signature with 401 (W3)', async () => {
    const body = completedEvent()
    for (const header of [null, 't=1794629220,v1=deadbeef', `t=${now},v0=abc`]) {
      const { result, confirmPayment } = run(body, { header })
      expect(await result).toEqual({ status: 401, body: { error: 'invalid_signature' } })
      expect(confirmPayment).not.toHaveBeenCalled()
    }
  })

  it('rejects payload with timestamp exceeding tolerance with 400 (W4)', async () => {
    const body = completedEvent()
    const { result, confirmPayment } = run(body, { nowSeconds: now + 301 })
    expect(await result).toEqual({ status: 400, body: { error: 'stale_timestamp' } })
    expect(confirmPayment).not.toHaveBeenCalled()
  })

  it('rejects a signed body that is not JSON, or not an event, with 400 (W24)', async () => {
    expect((await run('not json').result).status).toBe(400)
    expect(await run('{"hello":"world"}').result).toEqual({
      status: 400,
      body: { error: 'invalid_event' },
    })
  })

  it('refuses a live-mode event, even one correctly signed (W24, D-005)', async () => {
    const { result, confirmPayment, log } = run(completedEvent({ livemode: true }))
    expect(await result).toEqual({ status: 400, body: { error: 'livemode_refused' } })
    expect(confirmPayment).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
  })

  it('answers other event types 200 and ignores them (W23)', async () => {
    const { result, confirmPayment } = run(
      completedEvent({ type: 'checkout.session.expired' }),
    )
    expect(await result).toEqual({
      status: 200,
      body: { received: true, ignored: 'event_type' },
    })
    expect(confirmPayment).not.toHaveBeenCalled()
  })

  it("answers a completed checkout that isn't paid 200 and ignores it (W23)", async () => {
    const { result, confirmPayment } = run(
      completedEvent({ session: { payment_status: 'unpaid', payment_intent: null } }),
    )
    expect(await result).toEqual({
      status: 200,
      body: { received: true, ignored: 'not_paid' },
    })
    expect(confirmPayment).not.toHaveBeenCalled()
  })

  it('logs a paid checkout with no reservation, from outside Worq, and answers 200 (W23)', async () => {
    for (const metadata of [{}, null, { reservation_id: 'not-a-uuid' }]) {
      const { result, confirmPayment, log } = run(
        completedEvent({ session: { metadata } }),
      )
      expect(await result).toEqual({
        status: 200,
        body: { received: true, ignored: 'no_reservation' },
      })
      expect(confirmPayment).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalled()
    }
  })

  it('rejects a paid checkout with no PaymentIntent with 400 (W24)', async () => {
    const { result, confirmPayment } = run(
      completedEvent({ session: { payment_intent: null } }),
    )
    expect(await result).toEqual({ status: 400, body: { error: 'invalid_event' } })
    expect(confirmPayment).not.toHaveBeenCalled()
  })
})

describe('handleStripeWebhook: confirm_payment', () => {
  it('passes the reservation, the checkout and the PaymentIntent (the gateway reference)', async () => {
    const { result, confirmPayment } = run(completedEvent())
    await result
    expect(confirmPayment).toHaveBeenCalledWith({
      reservationId,
      checkoutSessionId: 'cs_test_a1',
      externalPaymentId: 'pi_test_a1',
    })
  })

  it('confirms a delayed method paid later, in checkout.session.async_payment_succeeded', async () => {
    const { result, confirmPayment } = run(
      completedEvent({ type: 'checkout.session.async_payment_succeeded' }),
    )
    expect((await result).status).toBe(200)
    expect(confirmPayment).toHaveBeenCalledTimes(1)
  })

  it('answers 200 with a JSON body for every confirm_payment outcome (W5 to W8)', async () => {
    const outcomes = [
      { outcome: 'confirmed', reservation_status: 'reserved', payment_status: 'paid' },
      {
        outcome: 'already_processed',
        reservation_status: 'reserved',
        payment_status: 'paid',
      },
      { outcome: 'late_payment', reservation_status: 'expired', payment_status: 'paid' },
      {
        outcome: 'late_payment',
        reservation_status: 'cancelled',
        payment_status: 'paid',
      },
    ]
    for (const answer of outcomes) {
      const { result } = run(completedEvent(), { confirm: async () => answer })
      expect(await result).toEqual({ status: 200, body: { received: true, ...answer } })
    }
  })

  it('logs an unknown reservation and answers 200 (W21)', async () => {
    const { result, log } = run(completedEvent(), {
      confirm: async () => ({ outcome: 'not_found' }),
    })
    expect(await result).toEqual({
      status: 200,
      body: { received: true, outcome: 'not_found' },
    })
    expect(log).toHaveBeenCalledWith(
      'Paid checkout names an unknown reservation',
      expect.objectContaining({ reservationId }),
    )
  })

  it('answers 500 when confirm_payment fails, so Stripe delivers it again (W22)', async () => {
    const { result, log } = run(completedEvent(), {
      confirm: async () => {
        throw new Error('XX000: connection reset')
      },
    })
    expect(await result).toEqual({ status: 500, body: { error: 'confirm_failed' } })
    expect(log).toHaveBeenCalled()
  })

  it('answers 500 when confirm_payment answers something unexpected', async () => {
    const { result } = run(completedEvent(), {
      confirm: async () => ({ outcome: 'maybe' }),
    })
    expect(await result).toEqual({ status: 500, body: { error: 'confirm_failed' } })
  })

  it('never logs the secret or the whole body', async () => {
    const { result, log } = run(completedEvent(), {
      confirm: async () => {
        throw new Error('boom')
      },
    })
    await result
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain('"object":"checkout.session"')
  })
})
