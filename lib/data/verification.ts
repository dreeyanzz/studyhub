import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import type { VerificationQueueTab } from '@/lib/validation/verification'

export type SpaceStatus = Database['public']['Enums']['space_status']

/** How a Pending Space got back to Pending (STORY-20 design §2): none after V1. */
export type PendingOrigin = 'edited' | 'resubmitted' | null

/** One row of a Space's list of changes (`space_events`, D-086). */
export interface SpaceEventItem {
  id: string
  fromStatus: SpaceStatus | null
  toStatus: SpaceStatus | null
  reason: string | null
  oldName: string | null
  newName: string | null
  oldAddress: string | null
  newAddress: string | null
  oldLatitude: number | null
  newLatitude: number | null
  oldLongitude: number | null
  newLongitude: number | null
  /** Null when the account that made the change was deleted ("Deleted account"). */
  actorName: string | null
  actorDeleted: boolean
  createdAt: string
  /** Newer than the Space's most recent move to Verified, or every entry if never Verified. */
  sinceLastVerified: boolean
}

/** A Space as `/admin` shows it, in any of the four lists. */
export interface VerificationSpace {
  id: string
  name: string
  description: string | null
  address: string
  opens_at: string
  closes_at: string
  status: SpaceStatus
  status_reason: string | null
  status_changed_at: string
  created_at: string
  updated_at: string
  host_name: string | null
  photos?: string[] | null
  origin: PendingOrigin
  /** Newest first. */
  events: SpaceEventItem[]
}

export type VerificationSpacesResult =
  { ok: true; spaces: VerificationSpace[] } | { ok: false }

type EventRow = Database['public']['Tables']['space_events']['Row'] & {
  profiles: { full_name: string | null } | null
}

/** Newest first, with the id breaking ties as `space_events_space_created_idx` does. */
function byNewest(a: EventRow, b: EventRow): number {
  const at = Date.parse(b.created_at) - Date.parse(a.created_at)
  if (at !== 0) return at
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/** "Edited" after V6, "Resubmitted" after V8, nothing for a new Space (design §2). */
export function pendingOrigin(
  status: SpaceStatus,
  newestFirst: Pick<EventRow, 'from_status' | 'to_status'>[],
): PendingOrigin {
  if (status !== 'pending') return null
  const arrival = newestFirst.find((event) => event.to_status === 'pending')
  if (!arrival) return null
  if (arrival.from_status === 'verified') return 'edited'
  if (arrival.from_status === 'rejected' || arrival.from_status === 'taken_down') {
    return 'resubmitted'
  }
  return null
}

/** Maps `space_events` rows, newest first, and marks those since the last Verified. */
export function toSpaceEvents(rows: EventRow[]): SpaceEventItem[] {
  const sorted = [...rows].sort(byNewest)
  const lastVerified = sorted.findIndex((event) => event.to_status === 'verified')

  return sorted.map((event, index) => ({
    id: event.id,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    reason: event.reason,
    oldName: event.old_name,
    newName: event.new_name,
    oldAddress: event.old_address,
    newAddress: event.new_address,
    oldLatitude: event.old_latitude,
    newLatitude: event.new_latitude,
    oldLongitude: event.old_longitude,
    newLongitude: event.new_longitude,
    actorName: event.actor_id ? (event.profiles?.full_name ?? null) : null,
    actorDeleted: event.actor_id === null,
    createdAt: event.created_at,
    sinceLastVerified: lastVerified === -1 || index < lastVerified,
  }))
}

const SPACE_COLUMNS =
  'id, name, description, address, opens_at, closes_at, status, status_reason, status_changed_at, created_at, updated_at, profiles!spaces_host_id_fkey(full_name), space_events(*, profiles!space_events_actor_id_fkey(full_name))'

/** The uploaded photos' public URLs, or null when the bucket could not be read (D-063). */
async function loadPhotos(
  supabase: SupabaseClient<Database>,
  spaceId: string,
): Promise<string[] | null> {
  const bucket = supabase.storage.from('space-photos')
  const { data, error } = await bucket.list(spaceId, {
    sortBy: { column: 'created_at', order: 'asc' },
  })
  if (error) return null
  return (data ?? [])
    .filter((file) => file.name && !file.name.startsWith('.'))
    .map((file) => bucket.getPublicUrl(`${spaceId}/${file.name}`).data.publicUrl)
}

/**
 * One of `/admin`'s four lists (STORY-20 design §3, screen 1): Pending oldest
 * `status_changed_at` first (D-084), the others newest first, each Space with its Host's
 * name, its reason, its list of changes and, when Pending, how it got there. Runs as the
 * signed-in Administrator, so RLS decides what it reads (N13, N14).
 */
export async function getVerificationSpaces(
  supabase: SupabaseClient<Database>,
  tab: VerificationQueueTab,
): Promise<VerificationSpacesResult> {
  const { data, error } = await supabase
    .from('spaces')
    .select(SPACE_COLUMNS)
    .eq('status', tab)
    .order('status_changed_at', { ascending: tab === 'pending' })
    .order('id', { ascending: true })

  if (error || !data) return { ok: false }

  const spaces = await Promise.all(
    data.map(async (space): Promise<VerificationSpace> => {
      const rows = (space.space_events ?? []) as EventRow[]
      const events = toSpaceEvents(rows)
      return {
        id: space.id,
        name: space.name,
        description: space.description,
        address: space.address,
        opens_at: space.opens_at,
        closes_at: space.closes_at,
        status: space.status,
        status_reason: space.status_reason,
        status_changed_at: space.status_changed_at,
        created_at: space.created_at,
        updated_at: space.updated_at,
        host_name: space.profiles?.full_name ?? null,
        photos: await loadPhotos(supabase, space.id),
        origin: pendingOrigin(
          space.status,
          events.map((event) => ({
            from_status: event.fromStatus,
            to_status: event.toStatus,
          })),
        ),
        events,
      }
    }),
  )

  return { ok: true, spaces }
}
