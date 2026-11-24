import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@/lib/supabase/database.types'
import { reviewSortSchema, type ReviewSort } from '@/lib/validation/review'
import { spaceIdSchema } from '@/lib/validation/space'

/** `public.space_review_summary` refuses more than 100 Space ids per call (STORY-13 design §2, N16). */
export const REVIEW_SUMMARY_BATCH_SIZE = 100

/** Maximum reviews shown on one Space profile page (`?reviews=50`, design §2 & §3). */
const MAX_SHOWN_REVIEWS = 50
const DEFAULT_SHOWN_REVIEWS = 10

const userIdSchema = z.uuid()

export type ReviewStatus = Database['public']['Enums']['review_status']

/**
 * Visible-review count and unrounded category/overall averages for one Verified Space,
 * from `public.space_review_summary` (STORY-13 design §2, D-076, N16).
 *
 * The generated types mark the averages as non-null `number`, but Postgres returns `null`
 * when `reviewCount === 0`. Averages are left unrounded so the UI rounds once for display.
 */
export interface SpaceReviewSummary {
  spaceId: string
  reviewCount: number
  avgQuietness: number | null
  avgWifiReliability: number | null
  avgCleanliness: number | null
  avgComfort: number | null
  avgOverall: number | null
}

/**
 * Another user's visible review of a Verified Space, from `public.space_reviews`
 * (STORY-13 design §2, D-081, N10, N17). Always carries the reviewer's short name,
 * never their full name.
 */
export interface SpaceReviewItem {
  id: string
  reviewerName: string
  quietness: number
  wifiReliability: number
  cleanliness: number
  comfort: number
  overall: number
  comment: string | null
  createdAt: string
  edited: boolean
  version: number
  reportedByCaller: boolean
}

export interface SpaceReviewsPage {
  reviews: SpaceReviewItem[]
  hasMore: boolean
}

/**
 * The signed-in Seeker's own review of a Space, read directly from `public.reviews`
 * (allowed in any status by RLS, STORY-13 design §2 & §7).
 */
export interface AuthorReview {
  id: string
  reservationId: string
  spaceId: string
  quietness: number
  wifiReliability: number
  cleanliness: number
  comfort: number
  overall: number
  comment: string | null
  status: ReviewStatus
  version: number
  edited: boolean
  editedAt: string | null
  createdAt: string
}

/** The caller's newest checked-in visit to a Space with no review yet (D-081). */
export interface ReviewableVisit {
  reservationId: string
  checkedInAt: string
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

/**
 * Server-only query helper (STORY-13, TSK-13.3, N16). Reads review summaries for any
 * number of Spaces by batching `public.space_review_summary` into calls of at most 100
 * unique valid Space ids and joining the rows into one Map. Returns `null` if any batch
 * errors so the caller can show an error state.
 */
export async function getReviewSummaries(
  supabase: SupabaseClient<Database>,
  spaceIds: readonly string[],
): Promise<Map<string, SpaceReviewSummary> | null> {
  const uniqueIds: string[] = []
  const seen = new Set<string>()
  for (const rawId of spaceIds) {
    const parsed = spaceIdSchema.safeParse(rawId)
    if (parsed.success && !seen.has(parsed.data)) {
      seen.add(parsed.data)
      uniqueIds.push(parsed.data)
    }
  }

  if (uniqueIds.length === 0) {
    return new Map()
  }

  const batches: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += REVIEW_SUMMARY_BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + REVIEW_SUMMARY_BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => supabase.rpc('space_review_summary', { p_space_ids: batch })),
  )

  const summaries = new Map<string, SpaceReviewSummary>()
  for (const { data, error } of results) {
    if (error || !data) {
      return null
    }
    for (const row of data) {
      summaries.set(row.space_id, {
        spaceId: row.space_id,
        reviewCount: row.review_count,
        avgQuietness: toNullableNumber(row.avg_quietness),
        avgWifiReliability: toNullableNumber(row.avg_wifi_reliability),
        avgCleanliness: toNullableNumber(row.avg_cleanliness),
        avgComfort: toNullableNumber(row.avg_comfort),
        avgOverall: toNullableNumber(row.avg_overall),
      })
    }
  }

  return summaries
}

export interface GetSpaceReviewsOptions {
  sort?: ReviewSort
  /** How many reviews to return (1..50, default 10). Asks Postgres for `shown + 1` to set `hasMore`. */
  shown?: number
  offset?: number
}

/**
 * Server-only query helper (STORY-13, TSK-13.3, N10, N17). Reads others' visible reviews
 * of a Verified Space through `public.space_reviews`, requesting `shown + 1` rows so the
 * page knows whether more reviews exist. Returns `null` for a malformed id or DB error.
 */
export async function getSpaceReviews(
  supabase: SupabaseClient<Database>,
  spaceId: string,
  options?: GetSpaceReviewsOptions,
): Promise<SpaceReviewsPage | null> {
  const parsedSpaceId = spaceIdSchema.safeParse(spaceId)
  if (!parsedSpaceId.success) {
    return null
  }

  const parsedSort = reviewSortSchema.safeParse(options?.sort)
  const sort: ReviewSort = parsedSort.success ? parsedSort.data : 'newest'
  const rawShown = options?.shown ?? DEFAULT_SHOWN_REVIEWS
  const shown = Number.isFinite(rawShown)
    ? Math.min(Math.max(Math.trunc(rawShown), 1), MAX_SHOWN_REVIEWS)
    : DEFAULT_SHOWN_REVIEWS
  const rawOffset = options?.offset ?? 0
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0

  const { data, error } = await supabase.rpc('space_reviews', {
    p_space_id: parsedSpaceId.data,
    p_sort: sort,
    p_page_size: shown + 1,
    p_page_offset: offset,
  })
  if (error || !data) {
    return null
  }

  const hasMore = data.length > shown
  const reviews: SpaceReviewItem[] = data.slice(0, shown).map((row) => ({
    id: row.id,
    reviewerName: row.reviewer_name,
    quietness: row.quietness,
    wifiReliability: row.wifi_reliability,
    cleanliness: row.cleanliness,
    comfort: row.comfort,
    overall: Number(row.overall),
    comment: row.comment ?? null,
    createdAt: row.created_at,
    edited: row.edited,
    version: row.version,
    reportedByCaller: row.reported_by_caller,
  }))

  return { reviews, hasMore }
}

/**
 * Server-only query helper (STORY-13, TSK-13.3). Reads the signed-in caller's own
 * reviews of a Space in any status (visible, hidden, or removed), newest first.
 * Always filters by `author_id` so RLS never mixes in other users' visible reviews;
 * returns `[]` for signed-out callers or invalid ids, and `null` on a database error.
 */
export async function getMyReviews(
  supabase: SupabaseClient<Database>,
  spaceId: string,
  authorId?: string,
): Promise<AuthorReview[] | null> {
  const parsedSpaceId = spaceIdSchema.safeParse(spaceId)
  if (!parsedSpaceId.success) {
    return []
  }

  let resolvedAuthorId: string
  if (authorId !== undefined) {
    const parsedAuthorId = userIdSchema.safeParse(authorId)
    if (!parsedAuthorId.success) {
      return []
    }
    resolvedAuthorId = parsedAuthorId.data
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return []
    }
    resolvedAuthorId = user.id
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, reservation_id, space_id, quietness, wifi_reliability, cleanliness, comfort, comment, status, version, edited_at, created_at',
    )
    .eq('space_id', parsedSpaceId.data)
    .eq('author_id', resolvedAuthorId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error || !data) {
    return null
  }

  return data.map((row) => ({
    id: row.id,
    reservationId: row.reservation_id,
    spaceId: row.space_id,
    quietness: row.quietness,
    wifiReliability: row.wifi_reliability,
    cleanliness: row.cleanliness,
    comfort: row.comfort,
    overall: (row.quietness + row.wifi_reliability + row.cleanliness + row.comfort) / 4,
    comment: row.comment ?? null,
    status: row.status,
    version: row.version,
    edited: row.edited_at !== null,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
  }))
}

/**
 * Server-only query helper (STORY-13, TSK-13.3, RV1, D-081). Reads the signed-in
 * Seeker's newest checked-in visit to a Space with no review in any status. Returns
 * `null` for signed-out visitors, non-Seekers, malformed ids, no unreviewed visit, or errors.
 */
export async function getMyReviewableVisit(
  supabase: SupabaseClient<Database>,
  spaceId: string,
): Promise<ReviewableVisit | null> {
  const parsedSpaceId = spaceIdSchema.safeParse(spaceId)
  if (!parsedSpaceId.success) {
    return null
  }

  const { data, error } = await supabase
    .rpc('my_reviewable_visit', { p_space_id: parsedSpaceId.data })
    .maybeSingle()
  if (error || !data) {
    return null
  }

  return {
    reservationId: data.reservation_id,
    checkedInAt: data.checked_in_at,
  }
}
