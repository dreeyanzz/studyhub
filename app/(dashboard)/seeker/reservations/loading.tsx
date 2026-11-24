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
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <Link
          href="/seeker"
          className="inline-flex min-h-12 min-w-12 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Reservation history
        </h1>
        <p className="text-sm text-muted-foreground">
          Every reservation you paid for after it ended, newest first.
        </p>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((placeholderId) => (
          <Card key={placeholderId} className="animate-pulse bg-muted/50">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-6 w-48 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
              <div className="h-4 w-28 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-60 rounded bg-muted" />
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3 pt-3">
              <div className="h-12 w-28 rounded bg-muted" />
              <div className="h-12 w-28 rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
