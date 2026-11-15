'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { formatRelative, secondsRemaining } from '@/lib/check-in/countdown'
import { cn } from '@/lib/utils'

const LAPSE_REFRESH_MS = 5000

/**
 * Displays remaining check-in wait time for a Seeker-held reserved unit on the Host
 * occupancy screens (STORY-10 TSK-10.5, FR-3.3). Refreshes the route automatically once
 * the wait window hits zero so server-side lapse recording updates the unit state.
 */
export function WaitWindowBadge({ waitWindowEndsAt }: { waitWindowEndsAt: string }) {
  const router = useRouter()
  const [remaining, setRemaining] = useState(() => secondsRemaining(waitWindowEndsAt))
  const lastRefresh = useRef(0)

  useEffect(() => {
    const tick = () => {
      const next = secondsRemaining(waitWindowEndsAt)
      setRemaining(next)

      if (next <= 0 && Date.now() - lastRefresh.current >= LAPSE_REFRESH_MS) {
        lastRefresh.current = Date.now()
        router.refresh()
      }
    }

    const syncId = window.setTimeout(tick, 0)
    const intervalId = window.setInterval(tick, 1000)

    return () => {
      window.clearTimeout(syncId)
      window.clearInterval(intervalId)
    }
  }, [router, waitWindowEndsAt])

  const expired = remaining <= 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        expired
          ? 'border-amber-600/40 bg-amber-50 text-amber-950'
          : 'border-blue-600/40 bg-blue-50 text-blue-950',
      )}
      suppressHydrationWarning
    >
      <Clock
        className={cn('size-3 shrink-0', expired ? 'text-amber-700' : 'text-blue-700')}
        aria-hidden="true"
      />
      {expired ? 'Wait: expired' : `Wait: ${formatRelative(remaining)}`}
    </span>
  )
}
