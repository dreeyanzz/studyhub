import { describe, expect, it, vi } from 'vitest'

import {
  CHECKOUT_EXPIRY_SECONDS,
  expireCheckoutQuietly,
  openCheckout,
  type AttachAnswer,
  type CheckoutDeps,
  type CheckoutHold,
} from './checkout'

// The flow's vitest/payments tests (sandbox payment confirmation flow §2, W2, W14,
// W15, W17).

const now = 1_794_629_220
const urls = {
  successUrl: 'http://localhost:3000/seeker/reservations/r1/confirmation',
  cancelUrl: 'http://localhost:3000/seeker/reservations/r1/confirmation?status=cancelled',
}
const hold: CheckoutHold = {
  reservationId: '10000000-0000-4000-8000-000000000001',
  feeAmount: 5000,
  checkoutUrl: null,
  description: 'Reservation fee: S4, Kapihan Study Hall',
}
const newSession = {
  id: 'cs_test_new',
  url: 'https://checkout.stripe.com/c/pay/cs_test_new',
}

function deps(
  attach: AttachAnswer | (() => Promise<AttachAnswer>),
  overrides: Partial<CheckoutDeps> = {},
) {
  return {
    createSession: vi.fn<CheckoutDeps['createSession']>(async () => newSession),
    expireSession: vi.fn<CheckoutDeps['expireSession']>(async () => {}),
    attachSession: vi.fn<CheckoutDeps['attachSession']>(
      typeof attach === 'function' ? attach : async () => attach,
    ),
    log: vi.fn(),
    ...overrides,
  }
}

const attachedFirst: AttachAnswer = {
  data: { attached: true, checkout_url: newSession.url },
  error: null,
}

describe('openCheckout', () => {
  it('returns existing active checkout URL instead of creating second (W2)', async () => {
    const d = deps(attachedFirst)
    const result = await openCheckout(
      { ...hold, checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_old' },
      urls,
      now,
      d,
    )
    expect(result).toEqual({
      kind: 'redirect',
      url: 'https://checkout.stripe.com/c/pay/cs_test_old',
      reused: true,
    })
    expect(d.createSession).not.toHaveBeenCalled()
  })

  it('creates the checkout for the copied fee, expiring 31 minutes on, and attaches it', async () => {
    const d = deps(attachedFirst)
    const result = await openCheckout(hold, urls, now, d)
    expect(d.createSession).toHaveBeenCalledWith({
      reservationId: hold.reservationId,
      feeAmount: 5000,
      description: hold.description,
      ...urls,
      expiresAt: now + CHECKOUT_EXPIRY_SECONDS,
    })
    expect(CHECKOUT_EXPIRY_SECONDS).toBeGreaterThan(30 * 60)
    expect(d.attachSession).toHaveBeenCalledWith({
      reservationId: hold.reservationId,
      sessionId: newSession.id,
      url: newSession.url,
    })
    expect(result).toEqual({ kind: 'redirect', url: newSession.url, reused: false })
    expect(d.expireSession).not.toHaveBeenCalled()
  })

  it('a failed checkout creation keeps the hold and offers a retry (W14)', async () => {
    const d = deps(attachedFirst, {
      createSession: vi.fn(async () => {
        throw new Error('Stripe timed out')
      }),
    })
    expect(await openCheckout(hold, urls, now, d)).toEqual({ kind: 'create_failed' })
    expect(d.attachSession).not.toHaveBeenCalled()
    expect(d.log).toHaveBeenCalled()
  })

  it('expires the checkout that lost the race (W15)', async () => {
    const first = 'https://checkout.stripe.com/c/pay/cs_test_first'
    const d = deps({ data: { attached: false, checkout_url: first }, error: null })
    expect(await openCheckout(hold, urls, now, d)).toEqual({
      kind: 'redirect',
      url: first,
      reused: true,
    })
    expect(d.expireSession).toHaveBeenCalledWith(newSession.id)
  })

  it('expires the checkout when its hold has ended (W17)', async () => {
    const d = deps({
      data: null,
      error: { code: 'P0001', hint: 'hold_ended', message: 'hold ended' },
    })
    expect(await openCheckout(hold, urls, now, d)).toEqual({ kind: 'hold_ended' })
    expect(d.expireSession).toHaveBeenCalledWith(newSession.id)
  })

  it('expires the checkout when the attach call fails or throws', async () => {
    for (const attach of [
      { data: null, error: { code: '42501', message: 'permission denied' } },
      { data: { attached: 'yes' }, error: null },
      async () => {
        throw new Error('network')
      },
    ] as (AttachAnswer | (() => Promise<AttachAnswer>))[]) {
      const d = deps(attach)
      expect(await openCheckout(hold, urls, now, d)).toEqual({ kind: 'attach_failed' })
      expect(d.expireSession).toHaveBeenCalledWith(newSession.id)
    }
  })

  it('still answers when the expire call itself fails (flow §6, accepted risk)', async () => {
    const d = deps(
      { data: null, error: { code: 'P0001', hint: 'hold_ended' } },
      {
        expireSession: vi.fn(async () => {
          throw new Error('Stripe is down')
        }),
      },
    )
    expect(await openCheckout(hold, urls, now, d)).toEqual({ kind: 'hold_ended' })
    expect(d.log).toHaveBeenCalledWith(
      'Could not expire a checkout',
      expect.objectContaining({ checkoutSessionId: newSession.id }),
    )
  })
})

describe('expireCheckoutQuietly', () => {
  it('expires the checkout, and logs instead of throwing when that fails', async () => {
    const ok = { expireSession: vi.fn(async () => {}), log: vi.fn() }
    await expireCheckoutQuietly('cs_test_1', ok)
    expect(ok.expireSession).toHaveBeenCalledWith('cs_test_1')
    expect(ok.log).not.toHaveBeenCalled()

    const failing = {
      expireSession: vi.fn(async () => {
        throw new Error('already complete')
      }),
      log: vi.fn(),
    }
    await expect(expireCheckoutQuietly('cs_test_1', failing)).resolves.toBeUndefined()
    expect(failing.log).toHaveBeenCalled()
  })
})
