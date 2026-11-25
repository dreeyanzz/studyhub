'use client'

// The return page's wait for Stripe's webhook (sandbox payment confirmation flow §5,
// W9, STORY-09 design §3). It reloads the page on a back-off, and the server renders
// Confirmed as soon as the webhook has committed. When the reloads run out, it stops
// and offers a Refresh button, and never a second payment
// (seeker-payment-confirming-waits-for-webhook).
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

/** Reloads after 1.5, 3, 5, 8 and 13 seconds: about 30 seconds in all (design §3). */
export const POLL_DELAYS_MS = [1500, 3000, 5000, 8000, 13000] as const

export const STILL_CONFIRMING = 'Still confirming your payment.'
export const TAKING_LONGER =
  "This is taking longer than usual. Don't pay again. Refresh in a minute."

export function ConfirmationPoller() {
  const router = useRouter()
  // Reloads done so far. A router.refresh() keeps this component's state.
  const [reloads, setReloads] = useState(0)
  const exhausted = reloads >= POLL_DELAYS_MS.length

  useEffect(() => {
    if (exhausted) return
    const timer = setTimeout(() => {
      router.refresh()
      setReloads((done) => done + 1)
    }, POLL_DELAYS_MS[reloads])
    return () => clearTimeout(timer)
  }, [reloads, exhausted, router])

  // One live region: silent at first, "Still confirming" once after the first
  // reload, then the longer message when the reloads run out.
  const message = exhausted ? TAKING_LONGER : reloads > 0 ? STILL_CONFIRMING : ''

  return (
    <div className="space-y-3">
      <p aria-live="polite" className={exhausted ? 'text-sm' : 'sr-only'}>
        {message}
      </p>
      {exhausted && (
        <Button type="button" variant="outline" onClick={() => router.refresh()}>
          Refresh
        </Button>
      )}
    </div>
  )
}
