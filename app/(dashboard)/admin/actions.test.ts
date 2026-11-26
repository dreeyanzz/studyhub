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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('@/lib/payments/take-down', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments/take-down')>()),
  cleanupTakeDownHolds: vi.fn(),
}))

import { revalidatePath } from 'next/cache'

import { cleanupTakeDownHolds } from '@/lib/payments/take-down'

import { setSpaceStatusAction } from './actions'

const spaceId = 'e0000000-0000-4000-8000-000000000002'
const updatedAt = '2026-11-26T01:02:03.456789+00:00'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin' } } })
  supabase.rpc.mockResolvedValue({
    data: { status: 'rejected', cancelled_holds: [] },
    error: null,
  })
})

describe('setSpaceStatusAction (STORY-15, STORY-20 TSK-20.1)', () => {
  it('sends a rejection with its trimmed reason (N10)', async () => {
    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: '  The photos show a different building. ',
    })

    expect(result).toEqual({
      success: true,
      spaceId,
      status: 'rejected',
      holds: { cancelledCount: 0, refundedCount: 0, failedRefundCount: 0 },
    })
    expect(supabase.rpc).toHaveBeenCalledWith('set_space_status', {
      p_space_id: spaceId,
      p_status: 'rejected',
      p_updated_at: updatedAt,
      p_reason: 'The photos show a different building.',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
  })

  it('sends an approval without a reason', async () => {
    await setSpaceStatusAction({
      spaceId,
      status: 'verified',
      updatedAt,
      reason: 'Ignored',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('set_space_status', {
      p_space_id: spaceId,
      p_status: 'verified',
      p_updated_at: updatedAt,
    })
  })

  it('refuses a rejection with no reason before calling the database', async () => {
    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: '   ',
    })

    expect(result).toEqual({
      success: false,
      spaceId,
      error: 'Enter a reason before continuing.',
      fieldErrors: { reason: 'Enter a reason before continuing.' },
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it.each([
    [
      'stale_version',
      'P0001',
      /updated while you were reviewing\. Reload to inspect the latest version/,
    ],
    [
      'invalid_transition',
      'P0001',
      /status has changed and can no longer take that action/,
    ],
    ['not_found', 'P0001', /This Space no longer exists/],
    ['invalid_reason', 'P0001', /Enter a reason between 1 and 500 characters/],
    ['', '42501', /not authorized to verify spaces/],
    ['', 'XX000', /could not update the space status/],
  ])('maps the database refusal %s (%s)', async (hint, code, message) => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code, hint, message: 'refused', details: null },
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: 'A reason',
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(message)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('puts a refused reason on the reason field', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', hint: 'invalid_reason', message: 'refused', details: null },
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: 'A reason',
    })

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { reason: 'Enter a reason between 1 and 500 characters.' },
    })
  })

  it('sends a signed-out visitor to log in', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    await expect(
      setSpaceStatusAction({ spaceId, status: 'verified', updatedAt }),
    ).rejects.toMatchObject({ url: '/login?returnUrl=%2Fadmin' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('setSpaceStatusAction take-down and hold cleanup (STORY-20, TSK-20.3)', () => {
  const paidHold = {
    reservation_id: 'c0000000-0000-4000-8000-000000000001',
    previous_status: 'reserved',
    payment_id: 'd0000000-0000-4000-8000-000000000001',
    payment_status: 'paid',
    checkout_session_id: null,
    payment_intent_id: 'pi_test_1',
  }
  const unpaidHold = {
    reservation_id: 'c0000000-0000-4000-8000-000000000002',
    previous_status: 'pending_payment',
    payment_id: 'd0000000-0000-4000-8000-000000000002',
    payment_status: 'pending',
    checkout_session_id: 'cs_test_2',
    payment_intent_id: null,
  }

  it('sends a take-down with its reason and cleans up the cancelled holds (V7, D-085)', async () => {
    supabase.rpc.mockResolvedValue({
      data: { status: 'taken_down', cancelled_holds: [paidHold, unpaidHold] },
      error: null,
    })
    vi.mocked(cleanupTakeDownHolds).mockResolvedValue({
      expiredCheckouts: 1,
      refundedCount: 0,
      failedRefundPaymentIds: [paidHold.payment_id],
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'taken_down',
      updatedAt,
      reason: ' Closed for repairs. ',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('set_space_status', {
      p_space_id: spaceId,
      p_status: 'taken_down',
      p_updated_at: updatedAt,
      p_reason: 'Closed for repairs.',
    })
    expect(cleanupTakeDownHolds).toHaveBeenCalledWith(
      supabase,
      [
        expect.objectContaining({ paymentId: paidHold.payment_id }),
        expect.objectContaining({ checkoutSessionId: 'cs_test_2' }),
      ],
      'Closed for repairs.',
      'taken_down',
    )
    expect(result).toEqual({
      success: true,
      spaceId,
      status: 'taken_down',
      holds: { cancelledCount: 2, refundedCount: 0, failedRefundCount: 1 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/payments')
  })

  it('cleans up holds after rejecting an edited Space as a rejection (V3 after V6)', async () => {
    supabase.rpc.mockResolvedValue({
      data: { status: 'rejected', cancelled_holds: [paidHold] },
      error: null,
    })
    vi.mocked(cleanupTakeDownHolds).mockResolvedValue({
      expiredCheckouts: 0,
      refundedCount: 1,
      failedRefundPaymentIds: [],
    })

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'rejected',
      updatedAt,
      reason: 'Wrong address',
    })

    expect(vi.mocked(cleanupTakeDownHolds).mock.calls[0]?.[3]).toBe('rejected')
    expect(result).toMatchObject({
      holds: { cancelledCount: 1, refundedCount: 1, failedRefundCount: 0 },
    })
  })

  it('skips cleanup when no hold was cancelled', async () => {
    await setSpaceStatusAction({ spaceId, status: 'rejected', updatedAt, reason: 'No' })

    expect(cleanupTakeDownHolds).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalledWith('/admin/payments')
  })

  it('keeps the saved decision when the cleanup throws, and leaves paid holds for retry', async () => {
    supabase.rpc.mockResolvedValue({
      data: { status: 'taken_down', cancelled_holds: [paidHold, unpaidHold] },
      error: null,
    })
    vi.mocked(cleanupTakeDownHolds).mockRejectedValue(new Error('Stripe down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await setSpaceStatusAction({
      spaceId,
      status: 'taken_down',
      updatedAt,
      reason: 'Closed',
    })

    expect(result).toMatchObject({
      success: true,
      holds: { cancelledCount: 2, refundedCount: 0, failedRefundCount: 1 },
    })
  })

  it('never cleans up after Undo or Put back (V9, V10)', async () => {
    supabase.rpc.mockResolvedValue({
      data: { status: 'verified', cancelled_holds: [] },
      error: null,
    })

    const result = await setSpaceStatusAction({ spaceId, status: 'verified', updatedAt })

    expect(result).toEqual({ success: true, spaceId, status: 'verified' })
    expect(cleanupTakeDownHolds).not.toHaveBeenCalled()
  })

  it('asks for a reload on stale_version and invalid_transition (N9, N5)', async () => {
    for (const hint of ['stale_version', 'invalid_transition']) {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { code: 'P0001', hint, message: 'refused', details: null },
      })
      const result = await setSpaceStatusAction({
        spaceId,
        status: 'verified',
        updatedAt,
      })
      expect(result).toMatchObject({ success: false, reload: true })
    }
  })
})
