import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import { getMyHistoryReviewValues, getReservationHistory } from './history'

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

describe('getMyHistoryReviewValues (STORY-16 design §3 Screen 4, TSK-16.4)', () => {
  const AUTHOR_ID = 'c0000000-0000-4000-8000-000000000001'
  const REVIEW_ID = 'a0000000-0000-4000-8000-000000000001'

  function fakeClient(result: { data: unknown; error: unknown }) {
    const calls: Array<[string, ...unknown[]]> = []
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        calls.push(['select', ...args])
        return builder
      }),
      in: vi.fn((...args: unknown[]) => {
        calls.push(['in', ...args])
        return builder
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push(['eq', ...args])
        return builder
      }),
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    }
    const from = vi.fn(() => builder)
    return { supabase: { from } as unknown as SupabaseClient<Database>, from, calls }
  }

  it('reads only the caller’s own visible reviews among the ids, once, deduplicated', async () => {
    const { supabase, from, calls } = fakeClient({
      data: [
        {
          id: REVIEW_ID,
          quietness: 4,
          wifi_reliability: 5,
          cleanliness: 4,
          comfort: 3,
          comment: 'Quiet corner',
        },
      ],
      error: null,
    })

    const result = await getMyHistoryReviewValues(supabase, AUTHOR_ID, [
      REVIEW_ID,
      REVIEW_ID,
      'not-a-uuid',
    ])

    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('reviews')
    expect(calls).toContainEqual(['in', 'id', [REVIEW_ID]])
    expect(calls).toContainEqual(['eq', 'author_id', AUTHOR_ID])
    expect(calls).toContainEqual(['eq', 'status', 'visible'])
    expect(result?.get(REVIEW_ID)).toEqual({
      quietness: 4,
      wifiReliability: 5,
      cleanliness: 4,
      comfort: 3,
      comment: 'Quiet corner',
    })
  })

  it('returns an empty Map without a query when there are no valid ids', async () => {
    const { supabase, from } = fakeClient({ data: [], error: null })

    const result = await getMyHistoryReviewValues(supabase, AUTHOR_ID, ['nope'])

    expect(result).toEqual(new Map())
    expect(from).not.toHaveBeenCalled()
  })

  it('returns null on a database error', async () => {
    const { supabase } = fakeClient({ data: null, error: { message: 'db failure' } })

    expect(await getMyHistoryReviewValues(supabase, AUTHOR_ID, [REVIEW_ID])).toBeNull()
  })
})
