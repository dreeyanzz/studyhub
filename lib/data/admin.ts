import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@/lib/supabase/database.types'
import {
  paymentIdSchema,
  type PaymentRecordFilter,
  type ReviewModerationAction,
  type ReviewQueueList,
} from '@/lib/validation/admin'
import {
  REVIEW_REPORT_REASONS,
  reviewIdSchema,
  type ReviewReportReason,
} from '@/lib/validation/review'

/** Maximum items shown on `/admin/moderation` and `/admin/payments` (`?show=100`, STORY-14 design §2 & §3). */
const MAX_SHOWN_ITEMS = 100
const DEFAULT_SHOWN_ITEMS = 25

export type ReviewStatus = Database['public']['Enums']['review_status']
export type SpaceStatus = Database['public']['Enums']['space_status']
export type ReviewReportOutcome = Database['public']['Enums']['review_report_outcome']

export interface AdminReviewReportItem {
  id: string
  reporterId: string
  reporterFullName: string
  reason: ReviewReportReason
  note: string | null
  reviewVersion: number
  createdAt: string
  outcome: ReviewReportOutcome | null
  closedBy: string | null
  closedByFullName: string | null
  closedAt: string | null
}

export interface AdminReviewQueueItem {
  reviewId: string
  status: ReviewStatus
  spaceId: string
  spaceName: string
  spaceStatus: SpaceStatus
  authorId: string
  authorFullName: string
  quietness: number
  wifiReliability: number
  cleanliness: number
  comfort: number
  overall: number
  comment: string | null
  version: number
  editedAt: string | null
  createdAt: string
  statusChangedBy: string | null
  statusChangedByFullName: string | null
  statusChangedAt: string | null
  openReportCount: number
  reports: AdminReviewReportItem[]
}

export interface AdminReviewQueuePage {
  items: AdminReviewQueueItem[]
  hasMore: boolean
}

export interface ModerationEventItem {
  id: string
  reviewId: string
  action: ReviewModerationAction
  actorId: string | null
  actorFullName: string | null
  createdAt: string
}

const REPORT_OUTCOMES = new Set<string>(['dismissed', 'hidden', 'removed'])
const REPORT_REASONS = new Set<string>(REVIEW_REPORT_REASONS)

function parseReportOutcome(value: unknown): ReviewReportOutcome | null {
  return typeof value === 'string' && REPORT_OUTCOMES.has(value)
    ? (value as ReviewReportOutcome)
    : null
}

function parseReportReason(value: unknown): ReviewReportReason {
  return typeof value === 'string' && REPORT_REASONS.has(value)
    ? (value as ReviewReportReason)
    : 'other'
}

function parseReportsJson(raw: Json): AdminReviewReportItem[] {
  if (!Array.isArray(raw)) return []
  const items: AdminReviewReportItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const rec = entry as Record<string, unknown>
    if (typeof rec.id !== 'string' || typeof rec.created_at !== 'string') continue
    items.push({
      id: rec.id,
      reporterId: typeof rec.reporter_id === 'string' ? rec.reporter_id : '',
      reporterFullName:
        typeof rec.reporter_full_name === 'string' && rec.reporter_full_name.trim()
          ? rec.reporter_full_name
          : 'Unknown user',
      reason: parseReportReason(rec.reason),
      note: typeof rec.note === 'string' && rec.note.length > 0 ? rec.note : null,
      reviewVersion:
        typeof rec.review_version === 'number' && Number.isFinite(rec.review_version)
          ? rec.review_version
          : 1,
      createdAt: rec.created_at,
      outcome: parseReportOutcome(rec.outcome),
      closedBy: typeof rec.closed_by === 'string' ? rec.closed_by : null,
      closedByFullName:
        typeof rec.closed_by_full_name === 'string' && rec.closed_by_full_name.trim()
          ? rec.closed_by_full_name
          : null,
      closedAt: typeof rec.closed_at === 'string' ? rec.closed_at : null,
    })
  }
  return items
}

export interface GetReviewQueueOptions {
  list?: ReviewQueueList
  /** Number of reviews to return (1..100, default 25). Requests `shown + 1` to compute `hasMore`. */
  shown?: number
  offset?: number
}

/**
 * Server-only query helper (STORY-14, TSK-14.3, FR-5.2, D-080).
 * Reads Reported, Hidden, or Removed reviews through `public.admin_review_queue`,
 * requesting `shown + 1` rows so the page knows whether more exist. Returns `null` on error.
 */
export async function getReviewQueue(
  supabase: SupabaseClient<Database>,
  options?: GetReviewQueueOptions,
): Promise<AdminReviewQueuePage | null> {
  const list: ReviewQueueList = options?.list ?? 'reported'
  const rawShown = options?.shown ?? DEFAULT_SHOWN_ITEMS
  const shown = Number.isFinite(rawShown)
    ? Math.min(Math.max(Math.trunc(rawShown), 1), MAX_SHOWN_ITEMS)
    : DEFAULT_SHOWN_ITEMS
  const rawOffset = options?.offset ?? 0
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0

  const { data, error } = await supabase.rpc('admin_review_queue', {
    p_list: list,
    p_page_size: shown + 1,
    p_page_offset: offset,
  })

  if (error || !data) {
    return null
  }

  const hasMore = data.length > shown
  const items: AdminReviewQueueItem[] = data.slice(0, shown).map((row) => ({
    reviewId: row.review_id,
    status: row.status,
    spaceId: row.space_id,
    spaceName: row.space_name,
    spaceStatus: row.space_status,
    authorId: row.author_id,
    authorFullName:
      typeof row.author_full_name === 'string' && row.author_full_name.trim()
        ? row.author_full_name
        : 'Unknown user',
    quietness: row.quietness,
    wifiReliability: row.wifi_reliability,
    cleanliness: row.cleanliness,
    comfort: row.comfort,
    overall: Number(row.overall),
    comment: row.comment ?? null,
    version: row.version,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
    statusChangedBy: row.status_changed_by ?? null,
    statusChangedByFullName:
      typeof row.status_changed_by_full_name === 'string' &&
      row.status_changed_by_full_name.trim()
        ? row.status_changed_by_full_name
        : null,
    statusChangedAt: row.status_changed_at ?? null,
    openReportCount: row.open_report_count,
    reports: parseReportsJson(row.reports),
  }))

  return { items, hasMore }
}

/**
 * Server-only query helper (STORY-14, TSK-14.3, D-080, N14).
 * Reads `public.review_moderation_events` directly (Administrators-only RLS) for the
 * shown review ids, newest first, grouped by `review_id`. Returns `null` on DB error.
 */
export async function getModerationHistory(
  supabase: SupabaseClient<Database>,
  reviewIds: readonly string[],
): Promise<Map<string, ModerationEventItem[]> | null> {
  const uniqueIds: string[] = []
  const seen = new Set<string>()
  for (const rawId of reviewIds) {
    const parsed = reviewIdSchema.safeParse(rawId)
    if (parsed.success && !seen.has(parsed.data)) {
      seen.add(parsed.data)
      uniqueIds.push(parsed.data)
    }
  }

  if (uniqueIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('review_moderation_events')
    .select('id, review_id, action, actor_id, created_at, profiles(full_name)')
    .in('review_id', uniqueIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error || !data) {
    return null
  }

  const history = new Map<string, ModerationEventItem[]>()
  for (const row of data) {
    const actorProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const actorFullName =
      actorProfile &&
      typeof actorProfile.full_name === 'string' &&
      actorProfile.full_name.trim()
        ? actorProfile.full_name
        : null
    const list = history.get(row.review_id) ?? []
    list.push({
      id: row.id,
      reviewId: row.review_id,
      action: row.action,
      actorId: row.actor_id,
      actorFullName,
      createdAt: row.created_at,
    })
    history.set(row.review_id, list)
  }

  return history
}

export type PaymentStatus = Database['public']['Enums']['payment_status']
export type ReservationStatus = Database['public']['Enums']['reservation_status']

export interface AdminPaymentRecordItem {
  paymentId: string
  paymentStatus: PaymentStatus
  feeAmount: number
  paidAt: string
  paymentIntentId: string
  refundId: string | null
  refundedAt: string | null
  refundedBy: string | null
  refundedByFullName: string | null
  refundReason: string | null
  reservationId: string
  reservationStatus: ReservationStatus
  unitLabel: string
  checkedInAt: string | null
  endedAt: string | null
  spaceId: string
  spaceName: string
  seekerFullName: string
  refundable: boolean
}

export interface AdminPaymentRecordsPage {
  items: AdminPaymentRecordItem[]
  hasMore: boolean
}

export interface GetPaymentRecordsOptions {
  filter?: PaymentRecordFilter
  paymentId?: string
  /** Number of payments to return (1..100, default 25). Requests `shown + 1` to compute `hasMore`. */
  shown?: number
  offset?: number
}

/**
 * Server-only query helper (STORY-14, TSK-14.4, FR-5.3, D-047, D-088).
 * Reads paid, forfeited, and refunded sandbox payments through `public.admin_payment_records`
 * (which records lapses first), requesting `shown + 1` rows so the page knows whether more exist.
 * Returns `null` on a malformed `paymentId` or database error.
 */
export async function getPaymentRecords(
  supabase: SupabaseClient<Database>,
  options?: GetPaymentRecordsOptions,
): Promise<AdminPaymentRecordsPage | null> {
  const filter: PaymentRecordFilter = options?.filter ?? 'all'
  const rawShown = options?.shown ?? DEFAULT_SHOWN_ITEMS
  const shown = Number.isFinite(rawShown)
    ? Math.min(Math.max(Math.trunc(rawShown), 1), MAX_SHOWN_ITEMS)
    : DEFAULT_SHOWN_ITEMS
  const rawOffset = options?.offset ?? 0
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0

  let paymentId: string | undefined
  if (options?.paymentId !== undefined) {
    const parsedId = paymentIdSchema.safeParse(options.paymentId)
    if (!parsedId.success) {
      return null
    }
    paymentId = parsedId.data
  }

  const pStatus: PaymentStatus | undefined =
    filter === 'paid' || filter === 'forfeited' || filter === 'refunded'
      ? filter
      : undefined
  const pRefundableOnly = filter === 'refundable'

  const { data, error } = await supabase.rpc('admin_payment_records', {
    p_status: pStatus,
    p_refundable_only: pRefundableOnly,
    p_payment_id: paymentId,
    p_page_size: shown + 1,
    p_page_offset: offset,
  })

  if (error || !data) {
    return null
  }

  const hasMore = data.length > shown
  const items: AdminPaymentRecordItem[] = data.slice(0, shown).map((row) => ({
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    feeAmount: row.fee_amount,
    paidAt: row.paid_at,
    paymentIntentId: row.payment_intent_id,
    refundId: row.refund_id ?? null,
    refundedAt: row.refunded_at ?? null,
    refundedBy: row.refunded_by ?? null,
    refundedByFullName:
      typeof row.refunded_by_full_name === 'string' && row.refunded_by_full_name.trim()
        ? row.refunded_by_full_name
        : null,
    refundReason: row.refund_reason ?? null,
    reservationId: row.reservation_id,
    reservationStatus: row.reservation_status,
    unitLabel: row.unit_label,
    checkedInAt: row.checked_in_at ?? null,
    endedAt: row.ended_at ?? null,
    spaceId: row.space_id,
    spaceName: row.space_name,
    seekerFullName:
      typeof row.seeker_full_name === 'string' && row.seeker_full_name.trim()
        ? row.seeker_full_name
        : 'Unknown user',
    refundable: row.refundable,
  }))

  return { items, hasMore }
}
