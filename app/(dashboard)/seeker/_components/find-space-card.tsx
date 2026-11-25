import Link from 'next/link'
import { Search } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The way from /seeker to the discovery map (STORY-04, FR-1.1, STORY-17).
 * The page shows it while the Seeker has no hold: a Seeker holds one unit at a time,
 * so with a hold there is nothing new to find.
 */
export function FindSpaceCard() {
  return (
    <section
      aria-labelledby="find-space-heading"
      className="space-y-4 rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8"
    >
      <p className="text-xs font-semibold tracking-wider text-primary-foreground/80 uppercase">
        Discover Spaces
      </p>
      <h2 id="find-space-heading" className="font-heading text-2xl font-semibold">
        Ready for your next study day?
      </h2>
      <p className="text-sm leading-relaxed text-primary-foreground/90">
        Search verified study and co-working Spaces on the map, then hold an open unit.
      </p>
      <Link
        href="/spaces"
        className={cn(
          buttonVariants({ variant: 'secondary' }),
          'rounded-full px-6 font-semibold hover:bg-white',
        )}
      >
        <Search aria-hidden="true" className="size-4" /> Find a Space
      </Link>
    </section>
  )
}
