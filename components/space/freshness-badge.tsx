'use client'

import { useSyncExternalStore } from 'react'

import { formatDateTime } from '@/lib/space/format'
import { formatHostFreshness } from '@/lib/space/freshness'

let currentTick = typeof window !== 'undefined' ? Date.now() : 0
const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null

function subscribe(callback: () => void) {
  listeners.add(callback)
  if (!intervalId) {
    currentTick = Date.now()
    intervalId = setInterval(() => {
      currentTick = Date.now()
      listeners.forEach((cb) => cb())
    }, 30_000)
  }
  return () => {
    listeners.delete(callback)
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getClientSnapshot() {
  return currentTick
}

function getServerSnapshot() {
  return 0
}

export function useFreshnessNow(): number {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}

export function formatFreshnessLabel(
  date: string | null | undefined,
  now: number,
): string {
  if (!date) {
    return 'Never'
  }
  // During SSR or before client mount (now === 0), render localized Manila date/time (D-002).
  return now === 0 ? formatDateTime(date) : formatHostFreshness(date, new Date(now))
}

export interface FreshnessBadgeProps {
  date: string | null | undefined
  prefix?: string
  className?: string
}

/**
 * Hydration-safe client-computed freshness badge (D-002, D-051).
 *
 * Sourced exclusively from unit_states(space_id).
 * On SSR / before mount, renders localized Manila date & time to avoid hydration mismatches.
 * After mount, dynamically computes and updates relative "Host-updated · X min ago" text.
 * Never uses the forbidden words "real-time" or "live" (Glossary).
 */
export function FreshnessBadge({ date, prefix = '', className }: FreshnessBadgeProps) {
  const now = useFreshnessNow()

  if (!date) {
    return <span className={className}>Never</span>
  }

  const displayText = formatFreshnessLabel(date, now)

  return (
    <time dateTime={date} className={className}>
      {prefix}
      {displayText}
    </time>
  )
}
