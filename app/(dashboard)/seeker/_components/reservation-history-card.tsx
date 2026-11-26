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
      className="space-y-3 rounded-3xl border border-border/60 bg-card p-6 shadow-[0_4px_20px_-8px_rgba(23,60,45,0.08)]"
    >
      <h2 id="reservation-history-heading" className="font-heading text-xl font-semibold">
        Reservation history
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        See past paid holds, hold the same unit again, or leave a review.
      </p>
      {/* flex-wrap lets the icon sit above the label when even the wrapped label is
          too wide, so the link still fits a narrow card with 200% text (design §3). */}
      <Link
        href="/seeker/reservations"
        className={cn(buttonLinkClass('outline'), 'flex-wrap')}
      >
        <History aria-hidden="true" className="size-4 text-primary" /> View reservation
        history
      </Link>
    </section>
  )
}
