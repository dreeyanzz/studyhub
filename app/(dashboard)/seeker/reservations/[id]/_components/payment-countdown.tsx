'use client'

// Minutes left in the payment window, counting down on the hold page, and a reload
// when the window passes, so the page shows the lapse (STORY-09 design §3, D-011).
// It speaks only at 5 minutes, at 1 minute and at the lapse (design §3, Accessibility).
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { countdownAnnouncement, minutesLeft } from '@/lib/reservations/format'

/** At the lapse, ask the server again at most this often, in case the clocks differ. */
const LAPSE_REFRESH_MS = 5000

export function PaymentCountdown({ deadline }: { deadline: string }) {
  const router = useRouter()
  const [minutes, setMinutes] = useState(() => minutesLeft(deadline))
  const [announcement, setAnnouncement] = useState('')
  const lastMinutes = useRef(minutes)
  const lastRefresh = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = minutesLeft(deadline)
      if (now !== lastMinutes.current) {
        lastMinutes.current = now
        setMinutes(now)
        const said = countdownAnnouncement(now)
        if (said) setAnnouncement(said)
      }
      if (now <= 0 && Date.now() - lastRefresh.current >= LAPSE_REFRESH_MS) {
        // The page reads the hold through my_reservation, which records the lapse
        // first (D-047), so this reload shows how the hold ended.
        lastRefresh.current = Date.now()
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline, router])

  return (
    <>
      {/* The server and the browser can round to different minutes at a boundary. */}
      <span aria-hidden="true" suppressHydrationWarning>
        ({minutes} min left)
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
