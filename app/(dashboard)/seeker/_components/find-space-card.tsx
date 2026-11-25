import Link from 'next/link'
import { Search } from 'lucide-react'

import { buttonLinkClass } from '../reservations/[id]/_components/reservation-status-view'

/**
 * The way from /seeker to the discovery map (STORY-04, FR-1.1). The page shows it while
 * the Seeker has no hold: a Seeker holds one unit at a time, so with a hold there is
 * nothing new to find. It replaces the Sprint 2 and Sprint 3 preview cards, which still
 * said "coming soon" after both shipped.
 */
export function FindSpaceCard() {
  return (
    <section
      aria-labelledby="find-space-heading"
      className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="find-space-heading" className="text-xl font-semibold">
        Ready for your next study day?
      </h2>
      <p className="text-sm text-muted-foreground">
        Search verified study and co-working Spaces on the map, then hold an open unit.
      </p>
      <Link href="/spaces" className={buttonLinkClass()}>
        <Search aria-hidden="true" className="size-4" /> Find a Space
      </Link>
    </section>
  )
}
