import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  scheduled: [] as Array<() => Promise<void> | void>,
  rpc: vi.fn(),
  reservationQuery: vi.fn(),
  spaceQuery: vi.fn(),
  getUserById: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: (cb: () => Promise<void> | void) => {
    state.scheduled.push(cb)
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: state.rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            table === 'reservations' ? state.reservationQuery() : state.spaceQuery(),
        }),
      }),
    }),
    auth: {
      admin: {
        getUserById: state.getUserById,
      },
    },
  }),
}))

vi.mock('@/lib/email/transport', () => ({
  sendMail: state.sendMail,
}))

import { POST } from './route'

const webhookSecret = 'whsec_test_route_secret'
const reservationId = '10000000-0000-4000-8000-000000000001'

function signedWebhookRequest(body: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  return new Request('https://worqph.vercel.app/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': `t=${timestamp},v1=${v1}`,
    },
    body,
  })
}

const paidCheckoutBody = JSON.stringify({
  id: 'evt_route_1',
  object: 'event',
  type: 'checkout.session.completed',
  livemode: false,
  data: {
    object: {
      id: 'cs_test_route_1',
      object: 'checkout.session',
      payment_status: 'paid',
      payment_intent: 'pi_test_route_1',
      metadata: { reservation_id: reservationId },
    },
  },
})

describe('POST /api/webhooks/stripe (STORY-16 confirmation email)', () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    state.scheduled = []
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret
    state.reservationQuery.mockResolvedValue({
      data: {
        seeker_id: 'seeker-1',
        space_id: 'space-1',
        unit_label: 'Desk A1',
        wait_window_ends_at: '2026-11-18T07:42:00.000Z',
      },
      error: null,
    })
    state.spaceQuery.mockResolvedValue({
      data: { name: 'Kapihan Study Hall' },
      error: null,
    })
    state.getUserById.mockResolvedValue({
      data: { user: { email: 'seeker.real@gmail.com' } },
      error: null,
    })
    state.sendMail.mockResolvedValue({ sent: true })
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret
    }
  })

  it('schedules the confirmation email via after() when confirm_payment returns confirmed', async () => {
    state.rpc.mockResolvedValue({
      data: {
        outcome: 'confirmed',
        reservation_status: 'reserved',
        payment_status: 'paid',
      },
      error: null,
    })

    const response = await POST(signedWebhookRequest(paidCheckoutBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      received: true,
      outcome: 'confirmed',
      reservation_status: 'reserved',
      payment_status: 'paid',
    })
    expect(state.scheduled).toHaveLength(1)
    expect(state.sendMail).not.toHaveBeenCalled()

    const callback = state.scheduled[0]
    if (!callback) throw new Error('Expected after() callback to be scheduled')
    await callback()

    expect(state.sendMail).toHaveBeenCalledTimes(1)
    expect(state.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'seeker.real@gmail.com',
        subject: 'Your hold at Kapihan Study Hall is confirmed',
        text: expect.stringContaining(
          `https://worqph.vercel.app/seeker/reservations/${reservationId}`,
        ),
      }),
      { log: expect.any(Function) },
    )
    const sentText = state.sendMail.mock.calls[0]?.[0]?.text as string
    expect(sentText).toContain('Desk A1')
    expect(sentText).toContain('3:42 PM (Asia/Manila)')
  })

  it('never schedules an email for already_processed, late_payment or not_found', async () => {
    const outcomes = [
      {
        outcome: 'already_processed',
        reservation_status: 'reserved',
        payment_status: 'paid',
      },
      { outcome: 'late_payment', reservation_status: 'expired', payment_status: 'paid' },
      { outcome: 'not_found' },
    ]

    for (const answer of outcomes) {
      state.scheduled = []
      state.rpc.mockResolvedValue({ data: answer, error: null })

      const response = await POST(signedWebhookRequest(paidCheckoutBody))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ received: true, ...answer })
      expect(state.scheduled).toHaveLength(0)
    }

    expect(state.sendMail).not.toHaveBeenCalled()
  })

  it('answers Stripe 200 the same even when sending the email fails in after()', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    state.rpc.mockResolvedValue({
      data: {
        outcome: 'confirmed',
        reservation_status: 'reserved',
        payment_status: 'paid',
      },
      error: null,
    })
    state.sendMail.mockRejectedValue(new Error('SMTP 535 Authentication failed'))

    const response = await POST(signedWebhookRequest(paidCheckoutBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      received: true,
      outcome: 'confirmed',
      reservation_status: 'reserved',
      payment_status: 'paid',
    })
    expect(state.scheduled).toHaveLength(1)

    const callback = state.scheduled[0]
    if (!callback) throw new Error('Expected after() callback to be scheduled')
    await expect(callback()).resolves.toBeUndefined()
    expect(state.sendMail).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})
