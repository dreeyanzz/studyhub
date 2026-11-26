import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.fn()
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const getUserMock = vi.fn()
const rpcMock = vi.fn()
const createRefundMock = vi.fn()
const findRefundMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}))

vi.mock('@/lib/payments/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/stripe')>()
  return {
    ...actual,
    createRefund: (...args: unknown[]) => createRefundMock(...args),
    findRefund: (...args: unknown[]) => findRefundMock(...args),
  }
})

import { StripeApiError } from '@/lib/payments/stripe'
import type { RefundPaymentActionState } from '@/lib/validation/admin'
import { refundPaymentAction } from './actions'

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111'
const IDLE: RefundPaymentActionState = { status: 'idle', message: null }

function makeForm(paymentId = PAYMENT_ID, reason = 'Host could not honour the hold.') {
  const fd = new FormData()
  fd.set('paymentId', paymentId)
  fd.set('reason', reason)
  return fd
}

function refundableRow(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'paid',
    payment_intent_id: 'pi_test_14_01',
    refundable: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
  rpcMock.mockImplementation(async (fn: string) => {
    if (fn === 'admin_payment_records') {
      return { data: [refundableRow()], error: null }
    }
    if (fn === 'record_refund') {
      return { data: { payment_status: 'refunded' }, error: null }
    }
    return { data: null, error: null }
  })
  createRefundMock.mockResolvedValue({ id: 're_test_14_01', status: 'succeeded' })
  findRefundMock.mockResolvedValue(null)
})

describe('refundPaymentAction (STORY-14 design §1 & §4, TSK-14.4)', () => {
  it('calls Stripe for a refundable payment, records the refund, and revalidates', async () => {
    const result = await refundPaymentAction(IDLE, makeForm())

    expect(createRefundMock).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test_14_01',
      paymentId: PAYMENT_ID,
    })
    expect(findRefundMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith('record_refund', {
      p_payment_id: PAYMENT_ID,
      p_refund_id: 're_test_14_01',
      p_reason: 'Host could not honour the hold.',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/payments')
    expect(revalidatePathMock).toHaveBeenCalledWith('/seeker', 'layout')
    expect(result).toEqual({
      status: 'success',
      message: 'Refund recorded.',
      reload: true,
    })
  })

  it('never calls Stripe or record_refund when the payment is not refundable or already refunded', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [refundableRow({ payment_status: 'refunded', refundable: false })],
      error: null,
    })
    const already = await refundPaymentAction(IDLE, makeForm())
    expect(already).toEqual({
      status: 'error',
      message: 'This payment is already refunded.',
      reload: true,
    })
    expect(createRefundMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledTimes(1)

    rpcMock.mockResolvedValueOnce({
      data: [refundableRow({ payment_status: 'forfeited', refundable: false })],
      error: null,
    })
    const ineligible = await refundPaymentAction(IDLE, makeForm())
    expect(ineligible).toEqual({
      status: 'error',
      message: 'This payment is not eligible for a refund.',
      reload: true,
    })
    expect(createRefundMock).not.toHaveBeenCalled()
  })

  it('asks findRefund after Stripe refusal, failure, or timeout and records an earlier refund it finds', async () => {
    // 1. 4xx refusal (e.g., idempotency key dropped after 24h) -> findRefund recovers re_prev_1
    createRefundMock.mockRejectedValueOnce(
      new StripeApiError(400, 'Charge already refunded'),
    )
    findRefundMock.mockResolvedValueOnce({ id: 're_prev_1', status: 'succeeded' })

    const recovered4xx = await refundPaymentAction(IDLE, makeForm())
    expect(findRefundMock).toHaveBeenCalledWith({ paymentIntentId: 'pi_test_14_01' })
    expect(rpcMock).toHaveBeenCalledWith('record_refund', {
      p_payment_id: PAYMENT_ID,
      p_refund_id: 're_prev_1',
      p_reason: 'Host could not honour the hold.',
    })
    expect(recovered4xx.status).toBe('success')

    // 2. Network failure -> findRefund recovers pending refund
    createRefundMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    findRefundMock.mockResolvedValueOnce({ id: 're_prev_2', status: 'pending' })

    const recoveredNet = await refundPaymentAction(IDLE, makeForm())
    expect(rpcMock).toHaveBeenCalledWith('record_refund', {
      p_payment_id: PAYMENT_ID,
      p_refund_id: 're_prev_2',
      p_reason: 'Host could not honour the hold.',
    })
    expect(recoveredNet.status).toBe('success')

    // 3. Timeout (DOMException) -> findRefund recovers refund
    createRefundMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    findRefundMock.mockResolvedValueOnce({ id: 're_prev_3', status: 'succeeded' })

    const recoveredTimeout = await refundPaymentAction(IDLE, makeForm())
    expect(recoveredTimeout.status).toBe('success')
  })

  it('says Stripe did not accept the refund only after a 4xx or failed refund with no earlier refund found, and "Nothing was recorded. Try again." otherwise', async () => {
    // 400 refusal + findRefund returns null -> Stripe didn't accept
    createRefundMock.mockRejectedValueOnce(new StripeApiError(400, 'Invalid request'))
    findRefundMock.mockResolvedValueOnce(null)
    const refused400 = await refundPaymentAction(IDLE, makeForm())
    expect(refused400).toEqual({
      status: 'error',
      message: "Stripe didn't accept the refund, so nothing changed.",
    })

    // 402 failed refund + findRefund returns null -> Stripe didn't accept
    createRefundMock.mockRejectedValueOnce(
      new StripeApiError(402, "Stripe's refund re_1 is failed"),
    )
    findRefundMock.mockResolvedValueOnce(null)
    const failedRefund = await refundPaymentAction(IDLE, makeForm())
    expect(failedRefund).toEqual({
      status: 'error',
      message: "Stripe didn't accept the refund, so nothing changed.",
    })

    // 409 idempotency key still in flight + findRefund returns null -> result unknown,
    // so Nothing was recorded (#432)
    createRefundMock.mockRejectedValueOnce(
      new StripeApiError(409, 'idempotency key in use'),
    )
    findRefundMock.mockResolvedValueOnce(null)
    const conflict409 = await refundPaymentAction(IDLE, makeForm())
    expect(conflict409).toEqual({
      status: 'error',
      message: 'Nothing was recorded. Try again.',
    })

    // 500 server error + findRefund returns null -> Nothing was recorded
    createRefundMock.mockRejectedValueOnce(
      new StripeApiError(500, 'Stripe internal error'),
    )
    findRefundMock.mockResolvedValueOnce(null)
    const err500 = await refundPaymentAction(IDLE, makeForm())
    expect(err500).toEqual({
      status: 'error',
      message: 'Nothing was recorded. Try again.',
    })

    // Network error + findRefund returns null -> Nothing was recorded
    createRefundMock.mockRejectedValueOnce(new TypeError('network down'))
    findRefundMock.mockResolvedValueOnce(null)
    const netErr = await refundPaymentAction(IDLE, makeForm())
    expect(netErr).toEqual({
      status: 'error',
      message: 'Nothing was recorded. Try again.',
    })

    // Timeout + findRefund returns null -> Nothing was recorded
    createRefundMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    findRefundMock.mockResolvedValueOnce(null)
    const timeoutErr = await refundPaymentAction(IDLE, makeForm())
    expect(timeoutErr).toEqual({
      status: 'error',
      message: 'Nothing was recorded. Try again.',
    })

    // None of those called record_refund
    expect(rpcMock).not.toHaveBeenCalledWith('record_refund', expect.anything())
  })

  it('records nothing and says "Nothing was recorded. Try again." when findRefund fails or times out too', async () => {
    // Even if createRefund was 4xx, a failed/timed-out findRefund cannot claim Stripe didn't accept it
    createRefundMock.mockRejectedValueOnce(
      new StripeApiError(400, 'Charge already refunded'),
    )
    findRefundMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))

    const result = await refundPaymentAction(IDLE, makeForm())
    expect(result).toEqual({
      status: 'error',
      message: 'Nothing was recorded. Try again.',
    })
    expect(rpcMock).not.toHaveBeenCalledWith('record_refund', expect.anything())
  })

  it('turns record_refund hints and 42501 into §3 messages', async () => {
    rpcMock.mockImplementationOnce(async () => ({ data: [refundableRow()], error: null }))
    rpcMock.mockImplementationOnce(async () => ({
      data: null,
      error: { code: 'P0001', hint: 'already_refunded', message: 'already refunded' },
    }))
    expect(await refundPaymentAction(IDLE, makeForm())).toEqual({
      status: 'error',
      message: 'This payment is already refunded.',
      reload: true,
    })

    rpcMock.mockImplementationOnce(async () => ({ data: [refundableRow()], error: null }))
    rpcMock.mockImplementationOnce(async () => ({
      data: null,
      error: { code: 'P0001', hint: 'not_refundable', message: 'not refundable' },
    }))
    expect(await refundPaymentAction(IDLE, makeForm())).toEqual({
      status: 'error',
      message: 'This payment is not eligible for a refund.',
      reload: true,
    })

    rpcMock.mockImplementationOnce(async () => ({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    }))
    expect(await refundPaymentAction(IDLE, makeForm())).toEqual({
      status: 'error',
      message: 'You are not authorized to issue refunds.',
    })
  })

  it('validates blank reason and redirects signed-out callers before touching Stripe', async () => {
    const invalid = await refundPaymentAction(IDLE, makeForm(PAYMENT_ID, '   '))
    expect(invalid.status).toBe('error')
    expect(invalid.fieldErrors?.reason).toBe('Enter a reason for this refund.')
    expect(rpcMock).not.toHaveBeenCalled()
    expect(createRefundMock).not.toHaveBeenCalled()

    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    await expect(refundPaymentAction(IDLE, makeForm())).rejects.toThrow(
      'NEXT_REDIRECT:/login?returnUrl=%2Fadmin%2Fpayments',
    )
    expect(createRefundMock).not.toHaveBeenCalled()
  })
})
