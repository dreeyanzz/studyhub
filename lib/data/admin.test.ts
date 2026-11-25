import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'
import { getModerationHistory, getReviewQueue } from './admin'

const REVIEW_1 = '11111111-1111-4111-8111-111111111111'
const REVIEW_2 = '22222222-2222-4222-8222-222222222222'
const SPACE_1 = '33333333-3333-4333-8333-333333333333'
const AUTHOR_1 = '44444444-4444-4444-8444-444444444444'
const REPORTER_1 = '55555555-5555-4555-8555-555555555555'
const ADMIN_1 = '66666666-6666-4666-8666-666666666666'

function makeQueueRow(reviewId: string) {
  return {
    review_id: reviewId,
    status: 'visible' as const,
    space_id: SPACE_1,
    space_name: 'Kapihan Study Hall',
    space_status: 'verified' as const,
    author_id: AUTHOR_1,
    author_full_name: 'Rina Bautista',
    quietness: 5,
    wifi_reliability: 4,
    cleanliness: 5,
    comfort: 4,
    overall: 4.5,
    comment: 'Quiet desks and fast Wi-Fi.',
    version: 2,
    edited_at: '2026-11-24T04:00:00Z',
    created_at: '2026-11-24T02:00:00Z',
    status_changed_by: null,
    status_changed_by_full_name: null,
    status_changed_at: null,
    open_report_count: 1,
    reports: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        reporter_id: REPORTER_1,
        reporter_full_name: 'Sam Dela Cruz',
        reason: 'spam',
        note: 'Looks promotional.',
        review_version: 1,
        created_at: '2026-11-24T03:00:00Z',
        outcome: null,
        closed_by: null,
        closed_by_full_name: null,
        closed_at: null,
      },
    ],
  }
}

describe('getReviewQueue (STORY-14, TSK-14.3)', () => {
  it('requests shown + 1 rows to compute hasMore and maps reports JSONB', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [makeQueueRow(REVIEW_1), makeQueueRow(REVIEW_2)],
      error: null,
    })
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getReviewQueue(supabase, { list: 'reported', shown: 1 })

    expect(rpc).toHaveBeenCalledWith('admin_review_queue', {
      p_list: 'reported',
      p_page_size: 2,
      p_page_offset: 0,
    })
    expect(result).not.toBeNull()
    expect(result?.hasMore).toBe(true)
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0]).toMatchObject({
      reviewId: REVIEW_1,
      spaceName: 'Kapihan Study Hall',
      authorFullName: 'Rina Bautista',
      overall: 4.5,
      version: 2,
      openReportCount: 1,
    })
    expect(result?.items[0]?.reports[0]).toMatchObject({
      reporterFullName: 'Sam Dela Cruz',
      reason: 'spam',
      note: 'Looks promotional.',
      reviewVersion: 1,
      outcome: null,
    })
  })

  it('clamps shown to 100 and returns null on RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getReviewQueue(supabase, {
      list: 'hidden',
      shown: 500,
      offset: -5,
    })

    expect(rpc).toHaveBeenCalledWith('admin_review_queue', {
      p_list: 'hidden',
      p_page_size: 101,
      p_page_offset: 0,
    })
    expect(result).toBeNull()
  })
})

describe('getModerationHistory (STORY-14, TSK-14.3)', () => {
  it('returns an empty Map without querying when no valid review ids are supplied', async () => {
    const from = vi.fn()
    const supabase = { from } as unknown as SupabaseClient<Database>

    const result = await getModerationHistory(supabase, ['not-a-uuid'])
    expect(result).toEqual(new Map())
    expect(from).not.toHaveBeenCalled()
  })

  it('groups moderation log events by review_id newest first', async () => {
    const orderId = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'ev-2',
          review_id: REVIEW_1,
          action: 'restore',
          actor_id: ADMIN_1,
          created_at: '2026-11-24T06:00:00Z',
          profiles: { full_name: 'Alma Reyes' },
        },
        {
          id: 'ev-1',
          review_id: REVIEW_1,
          action: 'hide',
          actor_id: ADMIN_1,
          created_at: '2026-11-24T05:00:00Z',
          profiles: { full_name: 'Alma Reyes' },
        },
      ],
      error: null,
    })
    const orderCreated = vi.fn().mockReturnValue({ order: orderId })
    const inFn = vi.fn().mockReturnValue({ order: orderCreated })
    const select = vi.fn().mockReturnValue({ in: inFn })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as unknown as SupabaseClient<Database>

    const result = await getModerationHistory(supabase, [REVIEW_1, REVIEW_1])

    expect(from).toHaveBeenCalledWith('review_moderation_events')
    expect(inFn).toHaveBeenCalledWith('review_id', [REVIEW_1])
    expect(result?.get(REVIEW_1)).toEqual([
      {
        id: 'ev-2',
        reviewId: REVIEW_1,
        action: 'restore',
        actorId: ADMIN_1,
        actorFullName: 'Alma Reyes',
        createdAt: '2026-11-24T06:00:00Z',
      },
      {
        id: 'ev-1',
        reviewId: REVIEW_1,
        action: 'hide',
        actorId: ADMIN_1,
        actorFullName: 'Alma Reyes',
        createdAt: '2026-11-24T05:00:00Z',
      },
    ])
  })

  it('returns null on DB error', async () => {
    const orderId = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    const orderCreated = vi.fn().mockReturnValue({ order: orderId })
    const inFn = vi.fn().mockReturnValue({ order: orderCreated })
    const select = vi.fn().mockReturnValue({ in: inFn })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as unknown as SupabaseClient<Database>

    const result = await getModerationHistory(supabase, [REVIEW_1])
    expect(result).toBeNull()
  })
})
