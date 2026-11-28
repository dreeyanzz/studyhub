import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

/**
 * Loading state for the Seeker reservation history page (STORY-16 design §3).
 * Renders accessible card placeholder skeletons with subtle pulsing backgrounds
 * while past reservations load from Supabase.
 */
export default function ReservationHistoryLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading reservation history…</span>
      <div className="space-y-3">
        <Link
          href="/seeker"
          className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full border border-border/80 bg-card px-4 text-sm font-medium text-foreground shadow-2xs transition-colors hover:border-primary/45 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4 text-primary" />
          Back to dashboard
        </Link>
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Reservation history
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Every reservation you paid for after it ended, newest first.
          </p>
        </div>
      </div>

      {/* The placeholders may wrap and shrink, like the rows they stand for, so they
          fit a 360 px screen at 200% text (design §3). The header row needs min-w-0:
          CardHeader is a grid, and without it the row grows to the w-48 bar. */}
      <div className="max-w-3xl space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card key={placeholderId} className="animate-pulse rounded-3xl bg-card/70">
            <CardHeader className="space-y-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 max-w-full rounded bg-muted" />
                <div className="h-4 w-32 max-w-full rounded bg-muted" />
              </div>
              <div className="h-4 w-28 max-w-full rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-60 max-w-full rounded bg-muted" />
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <div className="h-12 w-28 max-w-full rounded bg-muted" />
              <div className="h-12 w-28 max-w-full rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
