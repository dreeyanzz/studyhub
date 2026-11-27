import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MapPin, Search, ShieldCheck } from 'lucide-react'

import { SeatMapPreview } from './_components/seat-map-preview'
import { StartupLamp } from './_components/startup-lamp'
import './discovery.css'

// Quick-search campus links resolved natively by lib/geo/campuses.ts (STORY-08).
const CAMPUS_SHORTCUTS = [
  { label: 'USC Talamban', query: 'USC Talamban' },
  { label: 'UP Cebu', query: 'UP Cebu' },
  { label: 'CIT-U', query: 'CIT-U' },
  { label: 'UC Banilad', query: 'UC Banilad' },
  { label: 'USJ-R Main', query: 'USJ-R Main' },
] as const

const SEEKER_STEPS = [
  {
    number: '01',
    title: 'Filter Verified Spaces',
    text: 'Search near your Metro Cebu campus and filter by curated tags like quietness, Wi-Fi, power outlets, late hours, and price tier.',
  },
  {
    number: '02',
    title: 'Hold your exact Unit now',
    text: 'Pick an Available seat, standing desk, or study room on the Host-updated seat map and choose your wait window before leaving.',
  },
  {
    number: '03',
    title: 'Scan in and settle down',
    text: 'Present your booking QR at the front desk to check in. After your Visit, share ratings for quietness, Wi-Fi, cleanliness, and comfort.',
  },
] as const

// D-033: illustrative study environments only—never live inventory or clickable cards.
const STUDY_ENVIRONMENTS = [
  {
    index: '01',
    kind: 'Quiet library corner',
    title: 'Deep reading blocks',
    image: '/images/public-landing/library.webp',
    width: 1600,
    height: 1067,
    text: 'Calm rows for thesis drafts, case readings, and uninterrupted exam prep.',
  },
  {
    index: '02',
    kind: 'Neighborhood café',
    title: 'Coffee and chapters',
    image: '/images/public-landing/cafe.webp',
    width: 1600,
    height: 2387,
    text: 'Daylight tables with outlets and a gentler change of pace for afternoon work.',
  },
  {
    index: '03',
    kind: 'Co-working room',
    title: 'Focused shared desks',
    image: '/images/public-landing/workspace.webp',
    width: 1600,
    height: 1067,
    text: 'Ergonomic desks and enclosed study rooms built for full-day sprints.',
  },
] as const

const TRUST_GUARANTEES = [
  {
    label: 'Administrator-verified',
    text: 'Every Space is reviewed and approved by an Administrator before appearing on the public discovery map.',
  },
  {
    label: 'Honest Host-updated freshness',
    text: 'Each seat map states when its Host last confirmed walk-in availability—no fabricated sensor claims.',
  },
  {
    label: 'Reviews only after a Visit',
    text: 'Ratings for quietness, Wi-Fi reliability, cleanliness, and comfort come strictly from checked-in Seekers.',
  },
] as const

export default function Home() {
  return (
    <div className="discovery-home">
      <StartupLamp />

      {/* Section 1: Seeker-first Split Editorial Hero (STORY-17, FR-1.1, SRS §3.7.1) */}
      <section
        aria-labelledby="hero-title"
        className="border-b border-border bg-background"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:px-10 lg:py-20">
          <div className="space-y-6 lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-primary" aria-hidden="true" />
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Metro Cebu · Reserve-now study Spaces
              </p>
            </div>

            <h1
              id="hero-title"
              className="max-w-[16ch] font-heading text-4xl leading-[1.06] font-normal tracking-[-0.03em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem]"
            >
              Claim an open seat{' '}
              <em className="font-normal text-primary italic">before you head out.</em>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Explore Verified cafés, libraries, and co-working Spaces across Cebu,
              inspect the Host-updated seat map, and hold your exact desk or study room
              now.
            </p>

            {/* Plain GET form works before JavaScript loads (STORY-17 §3, SRS §3.7.1). */}
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="max-w-xl rounded-2xl border border-input bg-card p-2 shadow-[0_14px_32px_-24px_rgba(23,60,45,0.3)]"
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
                    placeholder="Search by campus, city, or Space name..."
                    className="min-h-12 w-full min-w-0 rounded-xl border border-transparent bg-transparent px-4 py-2.5 pl-10 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Real Cebu campus shortcuts wired to /spaces?q=... */}
            <div className="space-y-2.5">
              <p className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Jump near a campus
              </p>
              <div className="flex flex-wrap gap-2">
                {CAMPUS_SHORTCUTS.map((campus) => (
                  <Link
                    key={campus.label}
                    href={`/spaces?q=${encodeURIComponent(campus.query)}`}
                    className="inline-flex min-h-12 min-w-12 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium whitespace-normal text-foreground transition-colors hover:border-primary/50 hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <MapPin
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {campus.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5">
              <Link
                href="/spaces"
                className="inline-flex min-h-12 min-w-12 items-center gap-2 text-sm font-semibold whitespace-normal text-primary underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Search className="size-4 shrink-0" aria-hidden="true" />
                Find a Space
              </Link>
              {/* Honest about sandbox payments (D-005). */}
              <p className="text-sm text-muted-foreground">
                Reservation fees run in sandbox mode, so no real money moves.
              </p>
            </div>
          </div>

          {/* Right: Architectural Framed Study Photograph */}
          <div className="lg:col-span-5">
            <figure className="rounded-2xl border border-border bg-card p-3 shadow-[0_24px_48px_-32px_rgba(23,60,45,0.32)]">
              <div className="overflow-hidden rounded-xl bg-secondary">
                <Image
                  src="/images/public-landing/workspace.webp"
                  alt="Rows of sunlit desks and chairs inside a calm shared workspace"
                  width={1600}
                  height={1067}
                  sizes="(min-width: 64rem) 40vw, 100vw"
                  loading="eager"
                  className="aspect-[4/3] w-full object-cover lg:aspect-[4/5]"
                />
              </div>
              <figcaption className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">
                    Snap-grid Seat Map · Reserve-now
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pick a seat, standing desk, or study room—never a mystery waitlist.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                  Host-updated
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Snap-Grid Walkthrough & 3-Step Seeker Ledger */}
      <section
        id="how-it-works"
        aria-labelledby="walkthrough-title"
        className="scroll-mt-4 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-12 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                01 / How Worq works
              </p>
              <h2
                id="walkthrough-title"
                className="max-w-[20ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl"
              >
                See the room before you commute.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground lg:col-span-5">
              Worq is built for right now—no advance time slots that drift out of date.
              Every Space publishes a 6-column snap-grid Seat map so you know which exact
              Unit is open before you step out the door.
            </p>
          </div>

          <SeatMapPreview />

          <ol className="grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3 md:gap-0">
            {SEEKER_STEPS.map((step, index) => (
              <li
                key={step.number}
                className={
                  index > 0
                    ? 'space-y-2.5 border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8'
                    : 'space-y-2.5 md:pr-8'
                }
              >
                <span
                  aria-hidden="true"
                  className="block font-heading text-3xl text-primary"
                >
                  {step.number}
                </span>
                <h3 className="font-heading text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Section 3: Illustrative Study Environments (D-033) */}
      <section
        aria-labelledby="settings-title"
        aria-describedby="settings-note"
        className="border-y border-border bg-muted/60 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                02 / Study environments
              </p>
              <h2
                id="settings-title"
                className="max-w-[22ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl"
              >
                Spaces for every kind of study day.
              </h2>
            </div>
            <p
              id="settings-note"
              className="text-sm leading-relaxed text-muted-foreground lg:col-span-5"
            >
              Illustrative study environments, not live Space listings. Open the discovery
              map to browse Verified Spaces near you.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STUDY_ENVIRONMENTS.map((item) => (
              <li
                key={item.title}
                className="flex flex-col rounded-2xl border border-border bg-card p-3"
              >
                <div className="overflow-hidden rounded-xl bg-secondary">
                  <Image
                    src={item.image}
                    alt=""
                    width={item.width}
                    height={item.height}
                    sizes="(min-width: 48rem) 30vw, 100vw"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 px-1 pt-4 pb-2">
                  <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
                    {item.index} · {item.kind}
                  </p>
                  <h3 className="font-heading text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 4: Deep-Forest Seeker Trust & Closing CTA Band */}
      <section
        aria-labelledby="trust-title"
        className="bg-foreground py-16 text-background lg:py-24"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          <div className="space-y-8 lg:col-span-7">
            <div className="space-y-3">
              <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
                03 / Built for Seeker trust
              </p>
              <h2
                id="trust-title"
                className="max-w-[18ch] font-heading text-3xl leading-[1.12] font-normal tracking-[-0.02em] text-balance sm:text-4xl"
              >
                Verified Spaces. Honest seat status.
              </h2>
            </div>

            <dl className="divide-y divide-background/20 border-y border-background/20">
              {TRUST_GUARANTEES.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-12 sm:gap-4"
                >
                  <dt className="font-heading text-lg font-semibold text-background sm:col-span-5">
                    {item.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-background/85 sm:col-span-7">
                    {item.text}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-background/20 bg-primary/45 p-6 sm:p-8 lg:col-span-5">
            <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
              Start your focus
            </p>
            <h3 className="mt-2 font-heading text-2xl font-semibold text-background sm:text-3xl">
              Ready to find your seat?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-background/85">
              Open the Metro Cebu discovery map, filter by curated amenities, and hold an
              open desk or study room before you commute.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/spaces"
                className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-5 py-3 text-center text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                Explore Verified Spaces
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-background/45 px-5 py-3 text-center text-sm font-semibold whitespace-normal text-background transition-colors hover:bg-background/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
              >
                Create a Seeker account
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-background/80">
              No real money moves—reservation fees run in Stripe sandbox test mode.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
