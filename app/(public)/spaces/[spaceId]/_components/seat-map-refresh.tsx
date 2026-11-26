'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Poll interval while the tab is visible so open seats stay current (STORY-17). */
export const AUTO_REFRESH_MS = 30_000
/** Minimum gap between focus/visibility refreshes so paired events don't double-fire. */
const MIN_FOCUS_REFRESH_GAP_MS = 5_000

/**
 * Keeps the Space profile's seat map and availability current without a DB change:
 * refreshes the Server Component on tab focus, every 30s while visible, and on tap.
 */
export function SeatMapRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    const triggerRefresh = (respectGap: boolean) => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (respectGap && now - lastRefreshRef.current < MIN_FOCUS_REFRESH_GAP_MS) {
        return
      }
      lastRefreshRef.current = now
      startTransition(() => {
        router.refresh()
      })
    }

    const onFocusOrVisible = () => triggerRefresh(true)
    window.addEventListener('focus', onFocusOrVisible)
    document.addEventListener('visibilitychange', onFocusOrVisible)

    const timer = setInterval(() => triggerRefresh(true), AUTO_REFRESH_MS)

    return () => {
      window.removeEventListener('focus', onFocusOrVisible)
      document.removeEventListener('visibilitychange', onFocusOrVisible)
      clearInterval(timer)
    }
  }, [router])

  function handleManualRefresh() {
    lastRefreshRef.current = Date.now()
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Availability refreshes automatically while this page is open.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleManualRefresh}
        aria-busy={isPending}
        className="h-auto min-h-12 max-w-full shrink gap-2 py-2 text-center whitespace-normal"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn('size-4 shrink-0', isPending && 'animate-spin')}
        />
        <span>{isPending ? 'Refreshing…' : 'Refresh availability'}</span>
      </Button>
      <span className="sr-only" aria-live="polite">
        {isPending ? 'Refreshing availability' : ''}
      </span>
    </div>
  )
}
