'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import {
  formatCountdown,
  passedThreshold,
  secondsRemaining,
} from '@/lib/check-in/countdown'

const LAPSE_REFRESH_MS = 5000

/** What the polite region says as each threshold passes (design §3, Accessibility). */
const ANNOUNCEMENTS = [
  { atSeconds: 600, text: '10 minutes remaining to check in.' },
  { atSeconds: 300, text: '5 minutes remaining to check in.' },
  { atSeconds: 60, text: '1 minute remaining to check in.' },
  { atSeconds: 0, text: 'Wait window has ended.' },
] as const
const THRESHOLDS = ANNOUNCEMENTS.map((item) => item.atSeconds)

/**
 * Live MM:SS check-in countdown (STORY-10 design §3, Seeker journey S34).
 * Reloads `/seeker?reservation=<id>` at zero so the server records no_show via
 * `my_reservation(id)` and shows the lapse card. Screen readers only hear a threshold
 * as the countdown passes it (10m, 5m, 1m, 0s), rather than every second.
 */
export function WaitCountdown({
  deadline,
  reservationId,
}: {
  deadline: string
  reservationId: string
}) {
  const router = useRouter()
  const [remaining, setRemaining] = useState(() => secondsRemaining(deadline))
  const [announcement, setAnnouncement] = useState('')
  const lastReload = useRef(0)

  useEffect(() => {
    // Thresholds already behind when the card opened are never announced.
    let previous = secondsRemaining(deadline)
    const tick = () => {
      const next = secondsRemaining(deadline)
      setRemaining(next)

      const passed = passedThreshold(previous, next, THRESHOLDS)
      previous = next
      const item = ANNOUNCEMENTS.find((a) => a.atSeconds === passed)
      if (item) setAnnouncement(item.text)

      if (next <= 0 && Date.now() - lastReload.current >= LAPSE_REFRESH_MS) {
        lastReload.current = Date.now()
        router.replace(`/seeker?reservation=${reservationId}`)
        router.refresh()
      }
    }

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline, reservationId, router])

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
      <Clock className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
      <span>
        Time remaining to check in:{' '}
        <span className="font-mono tabular-nums" suppressHydrationWarning>
          {formatCountdown(remaining)}
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
