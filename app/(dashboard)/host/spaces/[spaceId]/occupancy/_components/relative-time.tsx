'use client'

import { useSyncExternalStore } from 'react'

function calculateRelativeTime(dateString: string, now: number): string {
  const time = new Date(dateString).getTime()
  if (Number.isNaN(time)) return 'recently'

  const diffMs = now - time
  if (diffMs < 0 || diffMs < 60_000) {
    return 'just now'
  }

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
  }

  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 30_000)
  return () => clearInterval(interval)
}

function getClientSnapshot() {
  return Date.now()
}

function getServerSnapshot() {
  return 0
}

/**
 * Client-computed relative time formatter (D-002).
 * Uses useSyncExternalStore to subscribe to external clock ticks without cascading renders.
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

  const relativeText = now === 0 ? 'just now' : calculateRelativeTime(date, now)

  return (
    <time dateTime={date} className={className}>
      {prefix}
      {relativeText}
    </time>
  )
}
