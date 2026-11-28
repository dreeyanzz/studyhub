import Link from 'next/link'
import { ArrowRight, Clock, Compass, MapPin, Search, Sparkles } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { WRAPPING_BUTTON } from '../reservations/[id]/_components/reservation-status-view'

const QUICK_CAMPUSES = [
  { label: 'USC TC', query: 'USC TC' },
  { label: 'USC Main', query: 'USC Main' },
  { label: 'UP Cebu', query: 'UP Cebu' },
  { label: 'CIT-U', query: 'CIT-U' },
  { label: 'UC Main', query: 'UC Main' },
  { label: 'USJ-R', query: 'USJ-R' },
] as const

const QUICK_FILTERS = [
  { label: 'Open now', href: '/spaces?open_now=true' },
  { label: 'Open late', href: '/spaces?open_late=true' },
  { label: 'Budget (₱)', href: '/spaces?price_tier=budget' },
] as const

/**
 * The way from /seeker to the discovery map (STORY-04, FR-1.1, STORY-17).
 * The page shows it while the Seeker has no hold: a Seeker holds one unit at a time,
 * so with a hold there is nothing new to find.
 */
export function FindSpaceCard() {
  return (
    <section
      aria-labelledby="find-space-heading"
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_92%_14%,rgba(231,203,131,0.26),transparent_44%),linear-gradient(135deg,var(--primary)_0%,var(--forest-mid)_58%,var(--forest-deep)_100%)] p-6 text-white shadow-hero sm:p-8"
    >
      <div className="relative space-y-5">
        <div className="space-y-2.5">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/35 bg-white/10 px-3.5 py-1 text-xs font-semibold text-brass backdrop-blur-xs">
            <Sparkles aria-hidden="true" className="size-3.5" />
            <span>Metro Cebu · Verified Spaces</span>
          </p>
          <h2
            id="find-space-heading"
            className="font-heading text-3xl leading-[1.08] font-bold tracking-[-0.03em] text-white sm:text-4xl"
          >
            Ready for your next study day?
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/88">
            Search verified study and co-working Spaces on the map, inspect Host-updated
            seat layouts, and hold an open unit before you commute.
          </p>
        </div>

        {/* Embedded working GET search capsule routing straight to /spaces?q=... */}
        <form
          action="/spaces"
          method="get"
          role="search"
          aria-label="Search study Spaces from dashboard"
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/25 bg-white/95 p-1.5 shadow-float backdrop-blur-md"
        >
          <div className="relative min-w-0 flex-1 basis-48">
            <label htmlFor="seeker-dashboard-search" className="sr-only">
              Search by campus, city, or Space name
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary"
            />
            <input
              id="seeker-dashboard-search"
              name="q"
              type="search"
              maxLength={100}
              placeholder="Search campus, city, or Space..."
              className="min-h-12 w-full min-w-0 rounded-xl bg-transparent pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <button
            type="submit"
            className={cn(
              buttonVariants({ variant: 'default' }),
              WRAPPING_BUTTON,
              'shrink-0 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-5 font-semibold text-white hover:from-primary-hover hover:to-forest-deep',
            )}
          >
            Search
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </form>

        {/* Quick campus jump pills */}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-brass uppercase">
            <MapPin aria-hidden="true" className="size-3.5" />
            <span>Jump near a campus</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_CAMPUSES.map((campus) => (
              <Link
                key={campus.query}
                href={`/spaces?q=${encodeURIComponent(campus.query)}`}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold whitespace-normal text-white backdrop-blur-xs transition-all hover:border-brass/60 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-forest-deep focus-visible:outline-none"
              >
                {campus.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Primary CTA + quick filter shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-white/15 pt-4">
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'brass' }),
              WRAPPING_BUTTON,
              'rounded-xl px-6 font-bold shadow-sm',
            )}
          >
            <Compass aria-hidden="true" className="size-4" /> Find a Space
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_FILTERS.map((filter) => (
              <Link
                key={filter.href}
                href={filter.href}
                className="inline-flex min-h-12 min-w-12 items-center gap-1.5 rounded-xl border border-white/20 bg-white/8 px-3.5 py-2 text-xs font-semibold whitespace-normal text-white/92 transition-all hover:border-white/40 hover:bg-white/16 focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-forest-deep focus-visible:outline-none"
              >
                <Clock aria-hidden="true" className="size-3.5 text-brass" />
                <span>{filter.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
