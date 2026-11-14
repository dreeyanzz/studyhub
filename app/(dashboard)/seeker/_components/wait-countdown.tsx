'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { formatCountdown, secondsRemaining } from '@/lib/check-in/countdown'

const LAPSE_REFRESH_MS = 5000

const ANNOUNCEMENT_THRESHOLDS = [
  {
    maxSeconds: 600,
    minSeconds: 301,
    key: '10m',
    text: '10 minutes remaining to check in.',
  },
  {
    maxSeconds: 300,
    minSeconds: 61,
    key: '5m',
    text: '5 minutes remaining to check in.',
  },
  { maxSeconds: 60, minSeconds: 1, key: '1m', text: '1 minute remaining to check in.' },
  { maxSeconds: 0, minSeconds: 0, key: '0s', text: 'Wait window has ended.' },
] as const

/**
 * Live MM:SS check-in countdown (STORY-10 design §3, FR-3.3).
 * Reloads `/seeker?reservation=<id>` at zero so the server records no_show via
 * `my_reservation(id)` and shows the lapse card. Screen readers only hear threshold
 * announcements (10m, 5m, 1m, 0s) rather than every second.
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
  const announced = useRef<Set<string>>(new Set())
  const lastReload = useRef(0)

  useEffect(() => {
    const tick = () => {
      const next = secondsRemaining(deadline)
      setRemaining(next)

      for (const item of ANNOUNCEMENT_THRESHOLDS) {
        if (
          next <= item.maxSeconds &&
          next >= item.minSeconds &&
          !announced.current.has(item.key)
        ) {
          announced.current.add(item.key)
          setAnnouncement(item.text)
          break
        }
      }

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
