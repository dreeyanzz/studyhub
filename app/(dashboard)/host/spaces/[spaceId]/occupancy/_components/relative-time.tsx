'use client'

import { useSyncExternalStore } from 'react'

import { calculateRelativeTime } from '@/lib/occupancy/relative-time'

let currentTick = typeof window !== 'undefined' ? Date.now() : 0
const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null

function subscribe(callback: () => void) {
  listeners.add(callback)
  if (!intervalId) {
    // The clock stops while nothing shows a time, so restart it from now: coming back
    // to the page would otherwise show ages from when it was last open, for up to 30 s.
    // React reads the snapshot again after subscribing, so this new value renders.
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

/**
 * Client-computed relative time formatter (D-002).
 *
 * Uses a single shared module-level timer store with useSyncExternalStore
 * to avoid cascading renders, timer multiplication, and hydration mismatches.
 * Renders a truthful neutral placeholder ("—") on SSR rather than false "just now".
 */
export function RelativeTime({
  date,
  prefix = '',
  className,
}: {
  date: string | null | undefined
  prefix?: string
  className?: string
}) {
  const now = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  if (!date) {
    return <span className={className}>Never</span>
  }

  // During SSR or before client hydration mount, render a neutral placeholder (D-002)
  const relativeText = now === 0 ? '—' : calculateRelativeTime(date, now)

  return (
    <time dateTime={date} className={className}>
      {prefix}
      {relativeText}
    </time>
  )
}

export { calculateRelativeTime }
