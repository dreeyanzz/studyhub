import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import { StripeApiError } from './stripe'
import {
  cleanupTakeDownHolds,
  parseCancelledHolds,
  REFUND_REASON_MAX_LENGTH,
  takeDownRefundReason,
  type CancelledHold,
} from './take-down'

const unpaid: CancelledHold = {
  reservationId: '20000000-0000-4000-8000-000000000001',
  previousStatus: 'pending_payment',
  paymentId: '21000000-0000-4000-8000-000000000001',
  paymentStatus: 'pending',
  checkoutSessionId: 'cs_test_20_01',
  paymentIntentId: null,
}
const paid: CancelledHold = {
  reservationId: '20000000-0000-4000-8000-000000000002',
  previousStatus: 'reserved',
  paymentId: '21000000-0000-4000-8000-000000000002',
  paymentStatus: 'paid',
  checkoutSessionId: 'cs_test_20_02',
  paymentIntentId: 'pi_test_20_02',
}

const rpc = vi.fn()
const supabase = { rpc } as unknown as SupabaseClient<Database>
const createRefund = vi.fn()
const findRefund = vi.fn()
const expireCheckoutSession = vi.fn()
const log = vi.fn()
const deps = { createRefund, findRefund, expireCheckoutSession, log }

beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockResolvedValue({ data: { payment_status: 'refunded' }, error: null })
  createRefund.mockResolvedValue({ id: 're_test_1', status: 'succeeded' })
  findRefund.mockResolvedValue(null)
  expireCheckoutSession.mockResolvedValue(undefined)
})

describe('cleanupTakeDownHolds (STORY-20 design §2, TSK-20.1, R13, R14, D-085)', () => {
  it('closes an unpaid hold’s checkout and refunds a paid hold’s fee', async () => {
    const result = await cleanupTakeDownHolds(
      supabase,
      [unpaid, paid],
      'Seekers reported the space closed.',
      'taken_down',
      deps,
    )

    expect(result).toEqual({
      expiredCheckouts: 1,
      refundedCount: 1,
      failedRefundPaymentIds: [],
    })
    expect(expireCheckoutSession).toHaveBeenCalledExactlyOnceWith('cs_test_20_01')
    expect(createRefund).toHaveBeenCalledExactlyOnceWith({
      paymentIntentId: 'pi_test_20_02',
      paymentId: paid.paymentId,
    })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('record_refund', {
      p_payment_id: paid.paymentId,
      p_refund_id: 're_test_1',
      p_reason: 'Space taken down: Seekers reported the space closed.',
    })
  })

  it('names a rejection of an edited Space in the refund’s reason', async () => {
    await cleanupTakeDownHolds(supabase, [paid], 'Wrong address.', 'rejected', deps)

    expect(rpc).toHaveBeenCalledWith(
      'record_refund',
      expect.objectContaining({
        p_reason: 'Space rejected after an edit: Wrong address.',
      }),
    )
  })

  it('logs a checkout that will not close, and goes on', async () => {
    expireCheckoutSession.mockRejectedValue(new StripeApiError(400, 'already expired'))

    const result = await cleanupTakeDownHolds(
      supabase,
      [unpaid, paid],
      'r',
      'taken_down',
      deps,
    )

    expect(result).toEqual({
      expiredCheckouts: 0,
      refundedCount: 1,
      failedRefundPaymentIds: [],
    })
    expect(log).toHaveBeenCalledWith(
      'could not close the checkout of a cancelled hold',
      expect.objectContaining({ reservationId: unpaid.reservationId }),
    )
  })

  it('records an earlier refund findRefund recovers when Stripe refuses or times out', async () => {
    createRefund.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    findRefund.mockResolvedValue({ id: 're_earlier', status: 'pending' })

    const result = await cleanupTakeDownHolds(supabase, [paid], 'r', 'taken_down', deps)

    expect(findRefund).toHaveBeenCalledWith({ paymentIntentId: 'pi_test_20_02' })
    expect(rpc).toHaveBeenCalledWith(
      'record_refund',
      expect.objectContaining({ p_refund_id: 're_earlier' }),
    )
    expect(result.refundedCount).toBe(1)
  })

  it('leaves a fee Stripe would not refund paid, and returns its payment', async () => {
    createRefund.mockRejectedValue(new StripeApiError(402, 'refund failed'))

    const result = await cleanupTakeDownHolds(supabase, [paid], 'r', 'taken_down', deps)

    expect(result).toEqual({
      expiredCheckouts: 0,
      refundedCount: 0,
      failedRefundPaymentIds: [paid.paymentId],
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns the payment when findRefund fails too, without throwing', async () => {
    createRefund.mockRejectedValue(new TypeError('fetch failed'))
    findRefund.mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      cleanupTakeDownHolds(supabase, [paid], 'r', 'taken_down', deps),
    ).resolves.toMatchObject({ failedRefundPaymentIds: [paid.paymentId] })
  })

  it('returns the payment when Stripe refunded it but record_refund did not record it', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '57014', hint: null, message: 'canceling statement' },
    })

    const result = await cleanupTakeDownHolds(supabase, [paid], 'r', 'taken_down', deps)

    expect(result.failedRefundPaymentIds).toEqual([paid.paymentId])
    expect(log).toHaveBeenCalledWith(
      'Stripe refunded a fee that was not recorded',
      expect.objectContaining({ paymentId: paid.paymentId, refundId: 're_test_1' }),
    )
  })

  it('counts a refund another Administrator recorded first', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        hint: 'already_refunded',
        message: 'payment is already refunded',
      },
    })

    const result = await cleanupTakeDownHolds(supabase, [paid], 'r', 'taken_down', deps)

    expect(result).toEqual({
      expiredCheckouts: 0,
      refundedCount: 1,
      failedRefundPaymentIds: [],
    })
  })

  it('returns a paid hold with no PaymentIntent, which cannot be refunded', async () => {
    const result = await cleanupTakeDownHolds(
      supabase,
      [{ ...paid, paymentIntentId: null }],
      'r',
      'taken_down',
      deps,
    )

    expect(result.failedRefundPaymentIds).toEqual([paid.paymentId])
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('skips an unpaid hold with no checkout, and a fee that is not paid', async () => {
    const result = await cleanupTakeDownHolds(
      supabase,
      [
        { ...unpaid, checkoutSessionId: null },
        { ...paid, paymentStatus: 'refunded' },
      ],
      'r',
      'taken_down',
      deps,
    )

    expect(result).toEqual({
      expiredCheckouts: 0,
      refundedCount: 0,
      failedRefundPaymentIds: [],
    })
    expect(expireCheckoutSession).not.toHaveBeenCalled()
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('does nothing for a move that cancelled no holds', async () => {
    await expect(
      cleanupTakeDownHolds(supabase, [], 'r', 'taken_down', deps),
    ).resolves.toEqual({
      expiredCheckouts: 0,
      refundedCount: 0,
      failedRefundPaymentIds: [],
    })
  })
})

describe('takeDownRefundReason (D-088)', () => {
  it('keeps the reason within 300 characters, counting code points', () => {
    const reason = takeDownRefundReason('taken_down', '🙂'.repeat(400))

    expect(Array.from(reason)).toHaveLength(REFUND_REASON_MAX_LENGTH)
    expect(reason.endsWith('🙂…')).toBe(true)
    expect(reason.startsWith('Space taken down: 🙂')).toBe(true)
  })

  it('leaves a short reason whole, trimmed', () => {
    expect(takeDownRefundReason('rejected', '  Wrong pin.  ')).toBe(
      'Space rejected after an edit: Wrong pin.',
    )
  })

  it('still gives a reason when the Administrator’s is empty', () => {
    expect(takeDownRefundReason('taken_down', '   ')).toBe('Space taken down')
  })
})

describe('parseCancelledHolds', () => {
  it('reads set_space_status’s cancelled holds', () => {
    expect(
      parseCancelledHolds({
        status: 'taken_down',
        cancelled_holds: [
          {
            reservation_id: paid.reservationId,
            previous_status: 'reserved',
            payment_id: paid.paymentId,
            payment_status: 'paid',
            checkout_session_id: 'cs_test_20_02',
            payment_intent_id: 'pi_test_20_02',
          },
        ],
      }),
    ).toEqual([paid])
  })

  it('reads an approval, which cancels none', () => {
    expect(parseCancelledHolds({ status: 'verified', cancelled_holds: [] })).toEqual([])
  })

  it('throws on an answer it cannot read, so no paid fee is skipped silently', () => {
    for (const bad of [
      null,
      { status: 'taken_down' },
      { cancelled_holds: [null] },
      {
        cancelled_holds: [
          {
            reservation_id: 'r',
            payment_id: 'p',
            previous_status: 'occupied',
            payment_status: 'paid',
          },
        ],
      },
      {
        cancelled_holds: [
          { payment_id: 'p', previous_status: 'reserved', payment_status: 'paid' },
        ],
      },
    ]) {
      expect(() => parseCancelledHolds(bad)).toThrow()
    }
  })
})
