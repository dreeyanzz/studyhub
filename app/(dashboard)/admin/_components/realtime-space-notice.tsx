'use client'

import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

export interface WatchedSpace {
  id: string
  updated_at: string
}

/**
 * Whether a Realtime row is a newer version of a Space on screen (D-086): the same
 * instant written two ways (`+00:00` and `Z`, or more digits) is not a change, and a
 * timestamp that cannot be read is treated as one, so N9 never has to be the only guard.
 */
export function isNewerVersion(rendered: string, incoming: unknown): boolean {
  if (typeof incoming !== 'string') return true
  const a = Date.parse(rendered)
  const b = Date.parse(incoming)
  if (Number.isNaN(a) || Number.isNaN(b)) return incoming !== rendered
  if (a !== b) return true
  // Date.parse keeps milliseconds only; compare the microseconds too.
  const micros = (value: string) =>
    value.match(/\.(\d+)/)?.[1]?.padEnd(6, '0') ?? '000000'
  return micros(rendered) !== micros(incoming)
}

interface RealtimeSpaceNoticeProps {
  spaces: WatchedSpace[]
  /** Spaces this Administrator is deciding right now: their own update is not news. */
  deciding: ReadonlySet<string>
  onStale: (spaceId: string) => void
}

interface RealtimeSpaceClient {
  realtime: { setAuth: () => Promise<void> }
  channel: (name: string) => {
    on: (
      type: 'postgres_changes',
      filter: { event: 'UPDATE'; schema: 'public'; table: 'spaces' },
      callback: (payload: { new: unknown }) => void,
    ) => { subscribe: () => unknown }
  }
  removeChannel: (channel: never) => Promise<unknown>
}

/**
 * Authenticates the Realtime socket with the signed-in Administrator's JWT before
 * joining the `public.spaces` listener, returning a cleanup function. Subscribing
 * synchronously sends `phx_join` without `access_token`, and if the async auth fetch
 * finishes before `phx_reply`, Realtime keeps the listener as `anon` and RLS silently
 * drops updates on non-Verified Spaces (D-086).
 */
export function startSpaceUpdateListener(
  supabase: RealtimeSpaceClient,
  onUpdate: (row: { id?: unknown; updated_at?: unknown }) => void,
): () => void {
  let active = true
  let channel: unknown = null

  async function subscribe() {
    try {
      await supabase.realtime.setAuth()
    } catch {
      // N9 still refuses stale decisions if Realtime cannot authenticate.
      return
    }
    if (!active) return
    channel = supabase
      .channel('admin-verification-spaces')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spaces' },
        (payload) => {
          onUpdate((payload.new ?? {}) as { id?: unknown; updated_at?: unknown })
        },
      )
      .subscribe()
  }

  void subscribe()

  return () => {
    active = false
    if (channel) {
      void supabase.removeChannel(channel as never)
    }
  }
}

/**
 * Listens for Host edits to the Spaces on screen (STORY-20 design §3, D-086). It
 * subscribes to every `UPDATE` on `public.spaces` (an `in` filter is capped at 100 ids)
 * and keeps those for the Spaces shown; Realtime applies RLS, so it only sees what this
 * Administrator may read. It renders nothing: the card shows "Updated by Host". If
 * Realtime misses an event, `set_space_status` still refuses the old version (N9).
 */
export function RealtimeSpaceNotice({
  spaces,
  deciding,
  onStale,
}: RealtimeSpaceNoticeProps) {
  // The channel lives for the whole page; these refs give it the latest props.
  const spacesRef = useRef(spaces)
  const decidingRef = useRef(deciding)
  const onStaleRef = useRef(onStale)
  useEffect(() => {
    spacesRef.current = spaces
    decidingRef.current = deciding
    onStaleRef.current = onStale
  })

  useEffect(() => {
    const supabase = createClient()
    return startSpaceUpdateListener(supabase, (row) => {
      if (typeof row.id !== 'string') return
      if (decidingRef.current.has(row.id)) return
      const shown = spacesRef.current.find((space) => space.id === row.id)
      if (shown && isNewerVersion(shown.updated_at, row.updated_at)) {
        onStaleRef.current(row.id)
      }
    })
  }, [])

  return null
}
