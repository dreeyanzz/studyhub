import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories run before this file's own code, so what they use is hoisted.
const { Redirected, supabase } = vi.hoisted(() => {
  // redirect() throws in Next. Here it throws something the tests can read.
  class Redirected extends Error {
    constructor(readonly url: string) {
      super(`NEXT_REDIRECT ${url}`)
    }
  }
  const supabase = {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  }
  return { Redirected, supabase }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirected(url)
  }),
}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ origin: 'http://localhost:3000' })),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))

const stripe = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  expireCheckoutSession: vi.fn(),
}))
vi.mock('@/lib/payments/stripe', () => stripe)

import { cancelHold, startCheckout } from './actions'

const id = '10000000-0000-4000-8000-000000000001'
const hold = `/seeker/reservations/${id}`
const newSession = {
  id: 'cs_test_new',
  url: 'https://checkout.stripe.com/c/pay/cs_test_new',
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: 'pending_payment',
    payment_status: 'pending',
    fee_amount: 5000,
    space_id: 'e0000000-0000-4000-8000-000000000002',
    space_name: 'Sulok Co-working',
    space_address: '12 Mabini St',
    unit_id: 'f0000000-0000-4000-8000-000000000017',
    unit_label: 'U1',
    zone_name: 'Open floor',
    wait_window_minutes: 60,
    payment_window_ends_at: '2026-11-14T07:42:00+00:00',
    wait_window_ends_at: null,
    booking_token: null,
    checkout_session_id: null,
    checkout_url: null,
    created_at: '2026-11-14T07:32:00+00:00',
    ended_at: null,
    ...overrides,
  }
}

// The answers each database function gives in one test.
function database(answers: {
  reservation?: Record<string, unknown> | null
  attach?: { data: unknown; error: unknown }
  cancel?: { error: unknown }
}) {
  supabase.rpc.mockImplementation((name: string) => {
    if (name === 'my_reservation') {
      return {
        maybeSingle: async () => ({ data: answers.reservation ?? null, error: null }),
      }
    }
    if (name === 'attach_checkout_session') {
      return Promise.resolve(
        answers.attach ?? {
          data: { attached: true, checkout_url: newSession.url },
          error: null,
        },
      )
    }
    if (name === 'cancel_hold')
      return Promise.resolve({ data: null, ...(answers.cancel ?? { error: null }) })
    throw new Error(`unexpected rpc ${name}`)
  })
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof Redirected) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'seeker' } } })
  stripe.createCheckoutSession.mockResolvedValue(newSession)
  stripe.expireCheckoutSession.mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('startCheckout', () => {
  it('sends a malformed id or a missing hold to /seeker', async () => {
    database({ reservation: null })
    expect(await redirectOf(startCheckout('nope'))).toBe('/seeker')
    expect(await redirectOf(startCheckout(id))).toBe('/seeker')
  })

  it('sends a signed-out visitor to log in, coming back to the hold', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await redirectOf(startCheckout(id))).toBe(
      `/login?returnUrl=${encodeURIComponent(hold)}`,
    )
  })

  it('sends a hold that ended or is paid back to the hold page, with no checkout', async () => {
    for (const reservation of [
      row({ status: 'expired' }),
      row({ status: 'reserved', payment_status: 'paid' }),
    ]) {
      database({ reservation })
      expect(await redirectOf(startCheckout(id))).toBe(hold)
    }
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("reuses the hold's own checkout (W2)", async () => {
    database({
      reservation: row({ checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_old' }),
    })
    expect(await redirectOf(startCheckout(id))).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_old',
    )
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('makes a checkout for the copied fee, with return URLs on this site, and attaches it', async () => {
    database({ reservation: row() })
    expect(await redirectOf(startCheckout(id))).toBe(newSession.url)

    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: id,
        feeAmount: 5000,
        description: 'Reservation fee: U1, Sulok Co-working',
        successUrl: `http://localhost:3000${hold}/confirmation`,
        cancelUrl: `http://localhost:3000${hold}/confirmation?status=cancelled`,
      }),
    )
    expect(supabase.rpc).toHaveBeenCalledWith('attach_checkout_session', {
      p_reservation_id: id,
      p_checkout_session_id: newSession.id,
      p_checkout_url: newSession.url,
    })
  })

  it('keeps the hold and says the payment page could not open when Stripe fails (W14)', async () => {
    database({ reservation: row() })
    stripe.createCheckoutSession.mockRejectedValue(new Error('timeout'))
    expect(await redirectOf(startCheckout(id))).toBe(`${hold}?error=checkout`)
  })

  it('expires the new checkout and shows the hold page when the hold ended meanwhile (W17)', async () => {
    database({
      reservation: row(),
      attach: {
        data: null,
        error: { code: 'P0001', hint: 'hold_ended', message: 'ended' },
      },
    })
    expect(await redirectOf(startCheckout(id))).toBe(hold)
    expect(stripe.expireCheckoutSession).toHaveBeenCalledWith(newSession.id)
  })
})

describe('cancelHold', () => {
  it("cancels as the status the Seeker saw, expires the hold's checkout, and shows the hold page (R4)", async () => {
    database({ reservation: row({ checkout_session_id: 'cs_test_open' }) })
    expect(await redirectOf(cancelHold(id, 'pending_payment'))).toBe(hold)

    expect(supabase.rpc).toHaveBeenCalledWith('cancel_hold', {
      p_reservation_id: id,
      p_expected_status: 'pending_payment',
    })
    expect(stripe.expireCheckoutSession).toHaveBeenCalledWith('cs_test_open')
  })

  it('cancels a reservation with nothing to expire (R8)', async () => {
    database({ reservation: row({ status: 'reserved', payment_status: 'paid' }) })
    expect(await redirectOf(cancelHold(id, 'reserved'))).toBe(hold)
    expect(stripe.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('says the payment won when the hold was paid before the cancel (N21)', async () => {
    database({
      reservation: row(),
      cancel: { error: { code: 'P0001', hint: 'hold_changed' } },
    })
    expect(await redirectOf(cancelHold(id, 'pending_payment'))).toBe(
      `${hold}?notice=payment-won`,
    )
    expect(stripe.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('shows the hold page for a hold that already ended (N11)', async () => {
    database({
      reservation: row(),
      cancel: { error: { code: 'P0001', hint: 'hold_ended' } },
    })
    expect(await redirectOf(cancelHold(id, 'pending_payment'))).toBe(hold)
  })

  it('sends a checked-in Seeker to /seeker', async () => {
    database({
      reservation: row({ status: 'reserved' }),
      cancel: { error: { code: 'P0001', hint: 'checked_in' } },
    })
    expect(await redirectOf(cancelHold(id, 'reserved'))).toBe('/seeker')
  })

  it('says the cancel failed for any other error', async () => {
    database({
      reservation: row(),
      cancel: { error: { code: '42501', message: 'denied' } },
    })
    expect(await redirectOf(cancelHold(id, 'pending_payment'))).toBe(
      `${hold}?error=cancel`,
    )
  })

  it('refuses a status it may not expect, before any database call', async () => {
    database({ reservation: row() })
    expect(await redirectOf(cancelHold(id, 'occupied' as 'reserved'))).toBe('/seeker')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
