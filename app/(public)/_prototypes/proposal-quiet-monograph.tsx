import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react'

import { SeatMapPreview } from '../_components/seat-map-preview'

const CAMPUS_DIRECTORY = [
  {
    index: '01',
    name: 'USC Talamban',
    neighborhood: 'Talamban · Nasipit & Banilad corridor',
    query: 'USC Talamban',
  },
  {
    index: '02',
    name: 'UP Cebu',
    neighborhood: 'Lahug · Gorordo & IT Park edge',
    query: 'UP Cebu',
  },
  {
    index: '03',
    name: 'CIT-U',
    neighborhood: 'N. Bacalso · South Cebu study strip',
    query: 'CIT-U',
  },
  {
    index: '04',
    name: 'UC Banilad',
    neighborhood: 'Banilad · Gov. Cuenco Ave',
    query: 'UC Banilad',
  },
  {
    index: '05',
    name: 'USJ-R Main',
    neighborhood: 'Downtown · Magallanes & Carbon edge',
    query: 'USJ-R Main',
  },
  {
    index: '06',
    name: 'SWU PHINMA',
    neighborhood: 'Urgello · Midtown student quarter',
    query: 'SWU',
  },
] as const

/**
 * PROTOTYPE VARIANT B — "The Quiet Monograph"
 * Inspired by NeueHouse, Fosbury & Sons, Industrious, and Resy:
 * monumental hospitality photography, anchored floating search dock, generous
 * editorial negative space, asymmetrical Z-pattern chapters, and a boutique
 * neighborhood directory—zero card grids.
 */
export function ProposalQuietMonograph() {
  return (
    <div className="discovery-home">
      {/* Section 1: Monumental Atmospheric Hero + Anchored Resy-Style Search Dock */}
      <section aria-labelledby="hero-title" className="bg-background pb-10 sm:pb-14">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-10">
          <div className="relative isolate rounded-3xl bg-foreground text-background">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
            >
              <Image
                src="/images/public-landing/library.webp"
                alt=""
                fill
                sizes="100vw"
                loading="eager"
                className="object-cover opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#173c2d]/95 via-[#173c2d]/45 to-[#173c2d]/25" />
            </div>

            <div className="flex min-h-[28rem] flex-col justify-between p-6 sm:min-h-[34rem] sm:p-10 lg:min-h-[38rem] lg:p-14">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-background/20 pb-4">
                <p className="font-mono text-xs font-medium tracking-widest text-background/85 uppercase">
                  Worq · Metro Cebu Study Directory
                </p>
                <p className="font-mono text-xs text-[#f0c95c]">
                  Reserve-now · Host-updated availability
                </p>
              </div>

              <div className="max-w-3xl space-y-4 pt-12 pb-6">
                <h1
                  id="hero-title"
                  className="font-heading text-4xl leading-[1.03] font-normal tracking-[-0.03em] text-balance text-background sm:text-6xl lg:text-[4.25rem]"
                >
                  Quiet rooms, held{' '}
                  <em className="font-normal text-[#f0c95c] italic">for your arrival.</em>
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-background/85 sm:text-lg">
                  An honest index of Verified cafés, libraries, and co-working Spaces
                  across Cebu—complete with exact-Unit seat maps you can claim before
                  commuting.
                </p>
              </div>
            </div>
          </div>

          {/* Floating Architectural Search Dock overlapping bottom edge */}
          <div className="relative z-10 mx-auto -mt-8 max-w-4xl px-2 sm:px-6">
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="rounded-2xl border border-border bg-card p-3 shadow-[0_24px_48px_-24px_rgba(23,60,45,0.34)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                    placeholder="Where in Cebu are you studying? (USC, UP Cebu, IT Park...)"
                    className="min-h-12 w-full rounded-xl border border-transparent bg-transparent px-4 py-2.5 pl-10 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Search
                </button>
                <Link
                  href="/spaces"
                  className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold whitespace-normal text-foreground transition-colors hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Find a Space
                </Link>
              </div>
              <p className="mt-2.5 border-t border-border/70 px-2 pt-2.5 text-xs text-muted-foreground">
                Reservation fees run in sandbox mode, so no real money moves.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Section 2: Centered Literary Manifesto */}
      <section aria-label="Editorial manifesto" className="py-16 lg:py-24">
        <div className="mx-auto max-w-4xl space-y-6 px-4 text-center sm:px-6">
          <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
            Built for focus · Not guesswork
          </p>
          <p className="font-heading text-2xl leading-[1.32] font-normal text-balance text-foreground sm:text-4xl">
            &ldquo;Finding a place to read, write, or prepare for finals shouldn&rsquo;t
            mean gambling on Cebu traffic and hoping an outlet desk happens to be
            free.&rdquo;
          </p>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every Space on Worq is Administrator-verified, mapped to individual seats and
            study rooms, and honest about when its Host last checked walk-in occupancy.
          </p>
        </div>
      </section>

      {/* Section 3: Chapter I — The Room, Mapped (Embedded Interactive Specimen) */}
      <section
        id="how-it-works"
        aria-labelledby="chapter-one-title"
        className="border-y border-border bg-muted/45 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 items-baseline gap-4 border-b border-border pb-6 lg:grid-cols-12">
            <p className="font-heading text-2xl text-primary italic lg:col-span-2">
              Chapter I.
            </p>
            <h2
              id="chapter-one-title"
              className="font-heading text-3xl font-normal tracking-[-0.02em] text-foreground sm:text-4xl lg:col-span-5"
            >
              The room, mapped to the seat.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground lg:col-span-5">
              Instead of advance calendars that drift out of sync, Worq holds only what is
              open right now. Tap an illustrative Unit below to inspect the hold pass and
              wait window.
            </p>
          </div>

          <SeatMapPreview />
        </div>
      </section>

      {/* Section 4: Chapter II — Asymmetrical Diptych + Boutique Cebu Campus Guide */}
      <section aria-labelledby="chapter-two-title" className="py-16 lg:py-24">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          {/* Left: Asymmetrical Photo Diptych (D-033 honest illustrative caption) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="grid grid-cols-12 items-end gap-3">
              <div className="col-span-7 overflow-hidden rounded-2xl border border-border bg-secondary">
                <Image
                  src="/images/public-landing/cafe.webp"
                  alt=""
                  width={1600}
                  height={2387}
                  sizes="(min-width: 64rem) 24vw, 60vw"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
              <div className="col-span-5 overflow-hidden rounded-2xl border border-border bg-secondary">
                <Image
                  src="/images/public-landing/workspace.webp"
                  alt=""
                  width={1600}
                  height={1067}
                  sizes="(min-width: 64rem) 18vw, 40vw"
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              Illustrative study environments, not live Space listings. Every Space on the
              map displays its own Host-uploaded photos and Visit-verified Reviews.
            </p>
          </div>

          {/* Right: Editorial City Guide Directory */}
          <div className="space-y-6 lg:col-span-7">
            <div className="space-y-2">
              <p className="font-heading text-xl text-primary italic">Chapter II.</p>
              <h2
                id="chapter-two-title"
                className="font-heading text-3xl font-normal tracking-[-0.02em] text-foreground sm:text-4xl"
              >
                Explore by Metro Cebu campus.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Select a neighborhood corridor to open the live map centered around your
                campus.
              </p>
            </div>

            <ul className="divide-y divide-border border-y border-border">
              {CAMPUS_DIRECTORY.map((campus) => (
                <li key={campus.name}>
                  <Link
                    href={`/spaces?q=${encodeURIComponent(campus.query)}`}
                    className="group flex min-h-16 flex-wrap items-center justify-between gap-4 py-4 transition-colors hover:bg-secondary/45 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="flex items-baseline gap-4 px-2">
                      <span className="font-mono text-xs text-primary">
                        {campus.index}
                      </span>
                      <div>
                        <p className="font-heading text-xl font-semibold text-foreground">
                          {campus.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {campus.neighborhood}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 font-mono text-xs font-semibold text-primary uppercase">
                      Open map
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Section 5: Deep-Forest Literary Colophon CTA */}
      <section
        aria-labelledby="colophon-title"
        className="bg-foreground py-20 text-background lg:py-24"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 px-4 text-center sm:px-6">
          <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
            Colophon · Verified Spaces Only
          </p>
          <h2
            id="colophon-title"
            className="font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance sm:text-5xl"
          >
            Settle in with your seat already waiting.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-background/85">
            Browse the map, inspect quietness and Wi-Fi scores from real Visits, and hold
            an open Unit before stepping out the door.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/spaces"
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              Explore Verified Spaces
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-background/45 px-6 py-3 text-sm font-semibold whitespace-normal text-background transition-colors hover:bg-background/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
            >
              Create a Seeker account
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
