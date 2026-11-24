import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'
import { getPaymentRecords } from './admin'

const PAYMENT_1 = '11111111-1111-4111-8111-111111111111'
const PAYMENT_2 = '22222222-2222-4222-8222-222222222222'
const RES_1 = '33333333-3333-4333-8333-333333333333'
const SPACE_1 = '44444444-4444-4444-8444-444444444444'

function makePaymentRow(paymentId: string) {
  return {
    payment_id: paymentId,
    payment_status: 'paid' as const,
    fee_amount: 5000,
    paid_at: '2026-11-24T02:00:00Z',
    payment_intent_id: 'pi_test_14_01',
    refund_id: null,
    refunded_at: null,
    refunded_by: null,
    refunded_by_full_name: null,
    refund_reason: null,
    reservation_id: RES_1,
    reservation_status: 'cancelled' as const,
    unit_label: 'S4',
    checked_in_at: null,
    ended_at: '2026-11-24T02:15:00Z',
    space_id: SPACE_1,
    space_name: 'Kapihan Study Hall',
    seeker_full_name: 'Sam Dela Cruz',
    refundable: true,
  }
}

describe('getPaymentRecords (STORY-14, TSK-14.4)', () => {
  it('requests shown + 1 rows and maps filter="refundable" to p_refundable_only=true', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [makePaymentRow(PAYMENT_1), makePaymentRow(PAYMENT_2)],
      error: null,
    })
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getPaymentRecords(supabase, { filter: 'refundable', shown: 1 })

    expect(rpc).toHaveBeenCalledWith('admin_payment_records', {
      p_status: undefined,
      p_refundable_only: true,
      p_payment_id: undefined,
      p_page_size: 2,
      p_page_offset: 0,
    })
    expect(result).not.toBeNull()
    expect(result?.hasMore).toBe(true)
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0]).toMatchObject({
      paymentId: PAYMENT_1,
      paymentStatus: 'paid',
      feeAmount: 5000,
      paymentIntentId: 'pi_test_14_01',
      spaceName: 'Kapihan Study Hall',
      unitLabel: 'S4',
      seekerFullName: 'Sam Dela Cruz',
      refundable: true,
    })
  })

  it('passes p_status for paid/forfeited/refunded filters and clamps shown to 100', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    await getPaymentRecords(supabase, { filter: 'refunded', shown: 500, offset: -10 })

    expect(rpc).toHaveBeenCalledWith('admin_payment_records', {
      p_status: 'refunded',
      p_refundable_only: false,
      p_payment_id: undefined,
      p_page_size: 101,
      p_page_offset: 0,
    })
  })

  it('returns null on malformed paymentId or RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    expect(await getPaymentRecords(supabase, { paymentId: 'bad-id' })).toBeNull()
    expect(rpc).not.toHaveBeenCalled()

    expect(await getPaymentRecords(supabase, { filter: 'all' })).toBeNull()
  })
})
