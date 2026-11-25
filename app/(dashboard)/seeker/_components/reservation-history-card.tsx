import Link from 'next/link'
import { History } from 'lucide-react'

import { cn } from '@/lib/utils'

import { buttonLinkClass } from '../reservations/[id]/_components/reservation-status-view'

/**
 * Reservation history card on the Seeker dashboard (STORY-16 design §3).
 * Links to /seeker/reservations with summary copy.
 */
export function ReservationHistoryCard() {
  return (
    <section
      aria-labelledby="reservation-history-heading"
      className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="reservation-history-heading" className="text-xl font-semibold">
        Reservation history
      </h2>
      <p className="text-sm text-muted-foreground">
        See past paid holds, hold the same unit again, or leave a review.
      </p>
      {/* flex-wrap lets the icon sit above the label when the label wraps, so the
          link fits the dashboard's grid column at 360 px with 200% text (design §3). */}
      <Link
        href="/seeker/reservations"
        className={cn(buttonLinkClass('outline'), 'flex-wrap')}
      >
        <History aria-hidden="true" className="size-4" /> View reservation history
      </Link>
    </section>
  )
}
