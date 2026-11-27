import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Hourglass,
  MapPin,
  Search,
  User,
} from 'lucide-react'

import { CEBU_CAMPUSES } from '@/lib/geo/campuses'
import { SeatMapPreview } from '../_components/seat-map-preview'

const FEATURED_CAMPUSES = CEBU_CAMPUSES.slice(0, 6)

const STATE_MACHINE_STAGES = [
  {
    code: '01',
    state: 'Available',
    icon: CheckCircle,
    badgeClass: 'border-emerald-700/40 bg-emerald-50 text-emerald-950',
    iconClass: 'text-emerald-700',
    summary: 'Open on the Host-updated seat map and ready to claim immediately.',
  },
  {
    code: '02',
    state: 'Pending Payment',
    icon: Hourglass,
    badgeClass: 'border-purple-600/35 bg-purple-50 text-purple-950',
    iconClass: 'text-purple-700',
    summary:
      'Locked exclusively for you during the payment window while sandbox checkout runs.',
  },
  {
    code: '03',
    state: 'Reserved',
    icon: Clock,
    badgeClass: 'border-blue-600/35 bg-blue-50 text-blue-950',
    iconClass: 'text-blue-700',
    summary:
      'Held for your chosen wait window while you travel. Your booking QR is ready.',
  },
  {
    code: '04',
    state: 'Occupied',
    icon: User,
    badgeClass: 'border-amber-600/35 bg-amber-50 text-amber-950',
    iconClass: 'text-amber-700',
    summary:
      'Host scans your booking token on arrival. Once checked in, you can leave a Review.',
  },
] as const

const ATMOSPHERE_STRIP = [
  {
    label: 'Quiet reading rooms',
    image: '/images/public-landing/library.webp',
    width: 1600,
    height: 1067,
  },
  {
    label: 'Work-friendly cafés',
    image: '/images/public-landing/cafe.webp',
    width: 1600,
    height: 2387,
  },
  {
    label: 'Co-working rooms',
    image: '/images/public-landing/workspace.webp',
    width: 1600,
    height: 1067,
  },
] as const

/**
 * PROTOTYPE VARIANT C — "The Floorplan First"
 * Inspired by SeatGeek (seat-map-is-the-product), Workfrom, and product-led
 * Swiss directory layouts: puts the interactive 6-column snap-grid seat map
 * directly inside the hero above the fold, followed by the D-004 reserve-now
 * state schematic and a real Metro Cebu campus coordinate index from
 * `lib/geo/campuses.ts`.
 */
export function ProposalFloorplanFirst() {
  return (
    <div className="discovery-home">
      {/* Section 1: Product-As-Hero — Search + Interactive Seat Map Above the Fold */}
      <section
        aria-labelledby="hero-title"
        className="border-b border-border bg-background py-10 sm:py-14 lg:py-16"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 items-end gap-8 border-b border-border pb-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Worq · Exact-Unit Seat Discovery · Metro Cebu
              </p>
              <h1
                id="hero-title"
                className="max-w-[16ch] font-heading text-4xl leading-[1.04] font-normal tracking-[-0.03em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem]"
              >
                Pick the exact desk. Hold it now.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                Try the illustrative snap-grid seat map below, or jump straight into
                Verified Metro Cebu Spaces to claim a live seat before your commute.
              </p>
            </div>

            <div className="space-y-3 lg:col-span-5">
              <form
                action="/spaces"
                method="get"
                role="search"
                aria-label="Search study Spaces"
                className="rounded-xl border border-input bg-card p-1.5"
              >
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <label htmlFor="hero-search-input" className="sr-only">
                      Search by campus, city, or Space name
                    </label>
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id="hero-search-input"
                      name="q"
                      type="search"
                      maxLength={100}
                      placeholder="Campus, area, or Space name..."
                      className="min-h-12 w-full rounded-lg bg-transparent px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg bg-[#f0c95c] px-5 py-2.5 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <Link
                  href="/spaces"
                  className="inline-flex min-h-12 min-w-12 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  Find a Space
                </Link>
                <p>Reservation fees run in sandbox mode, so no real money moves.</p>
              </div>
            </div>
          </div>

          {/* Interactive Seat Map Hero Centerpiece */}
          <SeatMapPreview />
        </div>
      </section>

      {/* Section 2: D-004 Reserve-Now Seat State Lifecycle Schematic */}
      <section
        id="how-it-works"
        aria-labelledby="lifecycle-title"
        className="border-b border-border bg-muted/50 py-16 lg:py-20"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                How a hold moves
              </p>
              <h2
                id="lifecycle-title"
                className="font-heading text-3xl font-normal tracking-[-0.02em] text-foreground sm:text-4xl"
              >
                Four honest states. Zero double-booking.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Every Unit hold is enforced atomically in the database—one active hold per
              Unit and one per Seeker at a time.
            </p>
          </div>

          <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STATE_MACHINE_STAGES.map((stage) => {
              const Icon = stage.icon
              return (
                <li
                  key={stage.code}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {stage.code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${stage.badgeClass}`}
                      >
                        <Icon
                          className={`size-3.5 ${stage.iconClass}`}
                          aria-hidden="true"
                        />
                        {stage.state}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">
                      {stage.summary}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Section 3: Swiss-Style Real Metro Cebu Campus Coordinate Directory */}
      <section aria-labelledby="campus-index-title" className="py-16 lg:py-24">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-7">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Metro Cebu Campus Index
              </p>
              <h2
                id="campus-index-title"
                className="font-heading text-3xl font-normal tracking-[-0.02em] text-foreground sm:text-4xl"
              >
                Jump directly to Spaces around your campus.
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground lg:col-span-5">
              Each campus shortcut centers the OpenStreetMap discovery view on its
              coordinates and ranks Verified Spaces by distance.
            </p>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {FEATURED_CAMPUSES.map((campus) => (
              <div
                key={campus.id}
                className="grid grid-cols-1 items-center gap-3 py-4 sm:grid-cols-12 sm:gap-4"
              >
                <div className="sm:col-span-5">
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {campus.name}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground sm:col-span-3">
                  {campus.latitude.toFixed(3)}° N · {campus.longitude.toFixed(3)}° E
                </p>
                <p className="font-mono text-xs text-muted-foreground sm:col-span-2">
                  Radius {campus.radiusKm} km
                </p>
                <div className="sm:col-span-2 sm:text-right">
                  <Link
                    href={`/spaces?q=${encodeURIComponent(campus.aliases[0] ?? campus.name)}`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Search nearby
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Compact Visual Footer Strip (D-033 honest label) */}
          <div className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-3">
            {ATMOSPHERE_STRIP.map((item) => (
              <figure
                key={item.label}
                className="rounded-xl border border-border bg-card p-2.5"
              >
                <div className="overflow-hidden rounded-lg bg-secondary">
                  <Image
                    src={item.image}
                    alt=""
                    width={item.width}
                    height={item.height}
                    sizes="(min-width: 48rem) 30vw, 100vw"
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
                <figcaption className="mt-2 px-1 font-mono text-xs text-muted-foreground">
                  {item.label} · illustrative setting
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Stark High-Contrast Closing Strip */}
      <section
        aria-labelledby="floorplan-cta-title"
        className="bg-foreground py-14 text-background"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-10">
          <div className="space-y-1.5">
            <h2
              id="floorplan-cta-title"
              className="font-heading text-3xl font-normal tracking-[-0.02em]"
            >
              Ready to see live Verified Spaces?
            </h2>
            <p className="text-sm text-background/85">
              Every Space is reviewed by an Administrator, with Visit-verified ratings and
              Host-updated seat maps.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/spaces"
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              Open discovery map
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-background/45 px-5 py-3 text-sm font-semibold whitespace-normal text-background transition-colors hover:bg-background/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
            >
              Sign up as a Seeker
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
