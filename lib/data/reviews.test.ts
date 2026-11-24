import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'

import {
  REVIEW_SUMMARY_BATCH_SIZE,
  getMyReviewableVisit,
  getMyReviews,
  getReviewSummaries,
  getSpaceReviews,
} from './reviews'

function makeUuid(index: number): string {
  return `e0000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

const spaceId = makeUuid(1)
const authorId = 'c0000000-0000-4000-8000-000000000001'
const reservationId = '10000000-0000-4000-8000-000000000001'

describe('getReviewSummaries', () => {
  it('asks for 250 Spaces in three calls of at most 100 ids and joins the rows (STORY-13 §4)', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => makeUuid(i + 1))
    const rpc = vi.fn(async (_fn: string, args: { p_space_ids: string[] }) => ({
      data: args.p_space_ids.map((id, idx) => ({
        space_id: id,
        review_count: idx === 0 ? 0 : 2,
        avg_quietness: idx === 0 ? null : 4.5,
        avg_wifi_reliability: idx === 0 ? null : 4.25,
        avg_cleanliness: idx === 0 ? null : 4.0,
        avg_comfort: idx === 0 ? null : 4.75,
        avg_overall: idx === 0 ? null : 4.375,
      })),
      error: null,
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const summaries = await getReviewSummaries(supabase, ids)

    expect(rpc).toHaveBeenCalledTimes(3)
    const callSizes = rpc.mock.calls.map((call) => call[1].p_space_ids.length)
    expect(callSizes).toEqual([REVIEW_SUMMARY_BATCH_SIZE, REVIEW_SUMMARY_BATCH_SIZE, 50])
    for (const size of callSizes) {
      expect(size).toBeLessThanOrEqual(REVIEW_SUMMARY_BATCH_SIZE)
    }

    expect(summaries).not.toBeNull()
    expect(summaries!.size).toBe(250)
    // First item in batch 1 had 0 reviews -> nullable averages stay null.
    expect(summaries!.get(ids[0]!)).toEqual({
      spaceId: ids[0],
      reviewCount: 0,
      avgQuietness: null,
      avgWifiReliability: null,
      avgCleanliness: null,
      avgComfort: null,
      avgOverall: null,
    })
    // Averages are kept unrounded so the UI rounds once for display.
    expect(summaries!.get(ids[249]!)).toEqual({
      spaceId: ids[249],
      reviewCount: 2,
      avgQuietness: 4.5,
      avgWifiReliability: 4.25,
      avgCleanliness: 4.0,
      avgComfort: 4.75,
      avgOverall: 4.375,
    })
  })

  it('deduplicates ids, skips malformed ids, and skips RPC when none are valid', async () => {
    const rpc = vi.fn(async (_fn: string, args: { p_space_ids: string[] }) => ({
      data: args.p_space_ids.map((id) => ({
        space_id: id,
        review_count: 1,
        avg_quietness: 5,
        avg_wifi_reliability: 5,
        avg_cleanliness: 5,
        avg_comfort: 5,
        avg_overall: 5,
      })),
      error: null,
    }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const empty = await getReviewSummaries(supabase, ['not-a-uuid', ''])
    expect(empty?.size).toBe(0)
    expect(rpc).not.toHaveBeenCalled()

    const deduped = await getReviewSummaries(supabase, [spaceId, 'bad', spaceId])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('space_review_summary', { p_space_ids: [spaceId] })
    expect(deduped?.size).toBe(1)
  })

  it('returns null if any batch fails', async () => {
    let call = 0
    const rpc = vi.fn(async () => {
      call += 1
      if (call === 2) return { data: null, error: { code: 'XX000' } }
      return { data: [], error: null }
    })
    const supabase = { rpc } as unknown as SupabaseClient<Database>
    const ids = Array.from({ length: 150 }, (_, i) => makeUuid(i + 1))

    expect(await getReviewSummaries(supabase, ids)).toBeNull()
  })
})

describe('getSpaceReviews', () => {
  function makeRow(i: number, comment: string | null = `Comment ${i}`) {
    return {
      id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      reviewer_name: 'Rina B.',
      quietness: 4,
      wifi_reliability: 5,
      cleanliness: 4,
      comfort: 4,
      overall: 4.25,
      comment,
      created_at: '2026-11-20T09:00:00+00:00',
      edited: i === 1,
      version: i === 1 ? 2 : 1,
      reported_by_caller: i === 2,
    }
  }

  it('asks for shown + 1 rows, trims to shown, and sets hasMore when extra row arrives', async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      makeRow(i + 1, i === 0 ? null : `Text ${i}`),
    )
    const rpc = vi.fn(async () => ({ data: rows, error: null }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getSpaceReviews(supabase, spaceId, {
      sort: 'highest',
      shown: 10,
      offset: 0,
    })

    expect(rpc).toHaveBeenCalledWith('space_reviews', {
      p_space_id: spaceId,
      p_sort: 'highest',
      p_page_size: 11,
      p_page_offset: 0,
    })
    expect(result?.hasMore).toBe(true)
    expect(result?.reviews).toHaveLength(10)
    expect(result?.reviews[0]).toEqual({
      id: rows[0]!.id,
      reviewerName: 'Rina B.',
      quietness: 4,
      wifiReliability: 5,
      cleanliness: 4,
      comfort: 4,
      overall: 4.25,
      comment: null,
      createdAt: '2026-11-20T09:00:00+00:00',
      edited: true,
      version: 2,
      reportedByCaller: false,
    })
    expect(result?.reviews[1]?.reportedByCaller).toBe(true)
  })

  it('sets hasMore false when rows do not exceed shown, and clamps shown to 1..50 and offset >= 0', async () => {
    const rows = [makeRow(1), makeRow(2)]
    const rpc = vi.fn(async () => ({ data: rows, error: null }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    const result = await getSpaceReviews(supabase, spaceId, {
      shown: 100,
      offset: -10,
    })

    expect(rpc).toHaveBeenCalledWith('space_reviews', {
      p_space_id: spaceId,
      p_sort: 'newest',
      p_page_size: 51,
      p_page_offset: 0,
    })
    expect(result?.hasMore).toBe(false)
    expect(result?.reviews).toHaveLength(2)
  })

  it('returns null for malformed spaceId or RPC error', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'XX000' } }))
    const supabase = { rpc } as unknown as SupabaseClient<Database>

    expect(await getSpaceReviews(supabase, 'bad-id')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()

    expect(await getSpaceReviews(supabase, spaceId)).toBeNull()
  })
})

describe('getMyReviews', () => {
  function reviewsClient(
    user: { id: string } | null,
    answer: { data: unknown; error: unknown },
  ) {
    const order2 = vi.fn(async () => answer)
    const order1 = vi.fn(() => ({ order: order2 }))
    const eqAuthor = vi.fn(() => ({ order: order1 }))
    const eqSpace = vi.fn(() => ({ eq: eqAuthor }))
    const select = vi.fn(() => ({ eq: eqSpace }))
    const from = vi.fn(() => ({ select }))
    const getUser = vi.fn(async () => ({ data: { user } }))
    const supabase = {
      auth: { getUser },
      from,
    } as unknown as SupabaseClient<Database>
    return { supabase, from, eqSpace, eqAuthor, getUser }
  }

  it('returns [] without querying reviews when the visitor is signed out', async () => {
    const { supabase, from } = reviewsClient(null, { data: [], error: null })
    expect(await getMyReviews(supabase, spaceId)).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('reads only the signed-in caller reviews in any status and computes overall and edited', async () => {
    const rows = [
      {
        id: '20000000-0000-4000-8000-000000000001',
        reservation_id: reservationId,
        space_id: spaceId,
        quietness: 5,
        wifi_reliability: 4,
        cleanliness: 4,
        comfort: 3,
        comment: 'Nice place.',
        status: 'visible',
        version: 2,
        edited_at: '2026-11-21T10:00:00+00:00',
        created_at: '2026-11-20T09:00:00+00:00',
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        reservation_id: '10000000-0000-4000-8000-000000000002',
        space_id: spaceId,
        quietness: 2,
        wifi_reliability: 2,
        cleanliness: 2,
        comfort: 2,
        comment: null,
        status: 'hidden',
        version: 1,
        edited_at: null,
        created_at: '2026-11-19T09:00:00+00:00',
      },
    ]
    const { supabase, eqSpace, eqAuthor, getUser } = reviewsClient(
      { id: authorId },
      { data: rows, error: null },
    )

    const reviews = await getMyReviews(supabase, spaceId)

    expect(getUser).toHaveBeenCalledTimes(1)
    expect(eqSpace).toHaveBeenCalledWith('space_id', spaceId)
    expect(eqAuthor).toHaveBeenCalledWith('author_id', authorId)
    expect(reviews).toEqual([
      {
        id: rows[0]!.id,
        reservationId,
        spaceId,
        quietness: 5,
        wifiReliability: 4,
        cleanliness: 4,
        comfort: 3,
        overall: 4,
        comment: 'Nice place.',
        status: 'visible',
        version: 2,
        edited: true,
        editedAt: '2026-11-21T10:00:00+00:00',
        createdAt: '2026-11-20T09:00:00+00:00',
      },
      {
        id: rows[1]!.id,
        reservationId: rows[1]!.reservation_id,
        spaceId,
        quietness: 2,
        wifiReliability: 2,
        cleanliness: 2,
        comfort: 2,
        overall: 2,
        comment: null,
        status: 'hidden',
        version: 1,
        edited: false,
        editedAt: null,
        createdAt: '2026-11-19T09:00:00+00:00',
      },
    ])
  })

  it('uses an explicit authorId without calling auth.getUser and returns null on error', async () => {
    const { supabase, getUser, eqAuthor } = reviewsClient(null, {
      data: null,
      error: { code: 'XX000' },
    })

    expect(await getMyReviews(supabase, spaceId, authorId)).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
    expect(eqAuthor).toHaveBeenCalledWith('author_id', authorId)
  })

  it('returns [] for malformed spaceId or malformed authorId without querying', async () => {
    const { supabase, from } = reviewsClient({ id: authorId }, { data: [], error: null })
    expect(await getMyReviews(supabase, 'bad')).toEqual([])
    expect(await getMyReviews(supabase, spaceId, 'bad')).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })
})

describe('getMyReviewableVisit', () => {
  function visitClient(answer: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn(async () => answer)
    const rpc = vi.fn(() => ({ maybeSingle }))
    return { supabase: { rpc } as unknown as SupabaseClient<Database>, rpc }
  }

  it('returns the newest unreviewed visit from my_reviewable_visit', async () => {
    const { supabase, rpc } = visitClient({
      data: { reservation_id: reservationId, checked_in_at: '2026-11-20T08:00:00+00:00' },
      error: null,
    })

    expect(await getMyReviewableVisit(supabase, spaceId)).toEqual({
      reservationId,
      checkedInAt: '2026-11-20T08:00:00+00:00',
    })
    expect(rpc).toHaveBeenCalledWith('my_reviewable_visit', { p_space_id: spaceId })
  })

  it('returns null for malformed spaceId, zero rows, or permission/RPC error', async () => {
    const { supabase, rpc } = visitClient({ data: null, error: null })
    expect(await getMyReviewableVisit(supabase, 'nope')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()

    expect(await getMyReviewableVisit(supabase, spaceId)).toBeNull()
    expect(
      await getMyReviewableVisit(
        visitClient({ data: null, error: { code: '42501' } }).supabase,
        spaceId,
      ),
    ).toBeNull()
  })
})
