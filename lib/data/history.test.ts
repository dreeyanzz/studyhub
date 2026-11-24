import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import { getReservationHistory } from './history'

describe('getReservationHistory (STORY-16 design §2 & §3)', () => {
  const fakeRow = {
    reservation_id: '10000000-0000-4000-8000-000000000001',
    reservation_status: 'completed' as const,
    created_at: '2026-11-20T10:00:00.000Z',
    checked_in_at: '2026-11-20T10:15:00.000Z',
    ended_at: '2026-11-20T12:00:00.000Z',
    space_id: 'e0000000-0000-4000-8000-000000000001',
    space_name: 'Kapihan Study Hall',
    space_listed: true,
    unit_id: 'u0000000-0000-4000-8000-000000000001',
    unit_label: 'Desk 1',
    payment_status: 'paid' as const,
    fee_amount: 5000,
    refunded_at: null,
    review_id: null,
    review_status: null,
  }

  it('calls my_reservation_history with shown + 1 and offset', async () => {
    const rpc = vi.fn(async () => ({
      data: [fakeRow],
      error: null,
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getReservationHistory(supabase, { shown: 20 })

    expect(rpc).toHaveBeenCalledWith('my_reservation_history', {
      p_page_size: 21,
      p_page_offset: 0,
    })
    expect(result).toEqual({
      items: [
        {
          reservationId: fakeRow.reservation_id,
          reservationStatus: fakeRow.reservation_status,
          createdAt: fakeRow.created_at,
          checkedInAt: fakeRow.checked_in_at,
          endedAt: fakeRow.ended_at,
          spaceId: fakeRow.space_id,
          spaceName: fakeRow.space_name,
          spaceListed: fakeRow.space_listed,
          unitId: fakeRow.unit_id,
          unitLabel: fakeRow.unit_label,
          paymentStatus: fakeRow.payment_status,
          feeAmount: fakeRow.fee_amount,
          refundedAt: null,
          reviewId: null,
          reviewStatus: null,
        },
      ],
      hasMore: false,
    })
  })

  it('detects hasMore when rows returned exceeds shown', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...fakeRow,
      reservation_id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    }))
    const rpc = vi.fn(async () => ({
      data: rows,
      error: null,
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getReservationHistory(supabase, { shown: 20 })

    expect(result).not.toBeNull()
    expect(result!.hasMore).toBe(true)
    expect(result!.items).toHaveLength(20)
  })

  it('clamps invalid shown and offset values to safe bounds', async () => {
    const rpc = vi.fn(async () => ({
      data: [],
      error: null,
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    await getReservationHistory(supabase, { shown: 500, offset: -10 })
    expect(rpc).toHaveBeenCalledWith('my_reservation_history', {
      p_page_size: 101, // MAX_HISTORY_SHOW_COUNT (100) + 1
      p_page_offset: 0,
    })
  })

  it('returns null on database error', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'db failure' },
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getReservationHistory(supabase)
    expect(result).toBeNull()
  })
})
