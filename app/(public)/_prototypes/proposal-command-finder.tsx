'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Clock,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

const QUICK_FILTERS = [
  { label: 'Open now', href: '/spaces?hours=open_now' },
  { label: 'Open late', href: '/spaces?hours=open_late' },
  { label: 'Study rooms', href: '/spaces?unitType=room' },
  { label: 'Budget Spaces', href: '/spaces?price=budget' },
  { label: 'USC Talamban', href: '/spaces?q=USC%20Talamban' },
  { label: 'UP Cebu', href: '/spaces?q=UP%20Cebu' },
  { label: 'CIT-U', href: '/spaces?q=CIT-U' },
] as const

const FACTUAL_RIBBON = [
  {
    label: 'Reserve-now only',
    detail: 'Hold only Units that are open right now—no stale future time slots.',
  },
  {
    label: 'Exact-Unit seat maps',
    detail:
      'Every Space publishes a 6-column snap grid of seats, standing desks, and rooms.',
  },
  {
    label: 'Administrator-verified',
    detail: 'Only reviewed, verified Spaces appear on the Metro Cebu discovery map.',
  },
  {
    label: 'Sandbox test fees',
    detail: 'Reservation fees run in Stripe sandbox mode, so no real money moves.',
  },
] as const

const STUDY_MODES = [
  {
    id: 'solo',
    tab: 'Solo deep work',
    eyebrow: 'Quiet desks & reading rooms',
    headline: 'Lock in a single quiet seat before leaving your dorm.',
    description:
      'Filter Verified Spaces for quiet zones and individual seats, check when the Host last updated availability, and hold your desk while you commute.',
    bullets: [
      'Filter by Seat units and quietness ratings from checked-in Seekers',
      'Pick a wait window that fits your travel time across Cebu',
      'Scan your booking QR on arrival to switch your hold to Occupied',
    ],
    ctaLabel: 'Browse open seats now',
    ctaHref: '/spaces?unitType=seat&hours=open_now',
    image: '/images/public-landing/library.webp',
    width: 1600,
    height: 1067,
    caption: 'Illustrative reading room setting · not a live Space listing.',
  },
  {
    id: 'cafe',
    tab: 'Café & laptop',
    eyebrow: 'Daylight tables & late-night pours',
    headline: 'Skip circling full cafés hoping a table opens up.',
    description:
      'Discover work-friendly cafés open late or 24 hours, check curated tags for power outlets and Wi-Fi reliability, and claim an open seat before ordering.',
    bullets: [
      'Filter instantly by Open late, Open 24 hours, or Budget price tier',
      'Read Visit-verified scores for Wi-Fi reliability and comfort',
      'See honest Host-updated timestamps on every seat map',
    ],
    ctaLabel: 'Find Spaces open late',
    ctaHref: '/spaces?hours=open_late',
    image: '/images/public-landing/cafe.webp',
    width: 1600,
    height: 2387,
    caption: 'Illustrative café study setting · not a live Space listing.',
  },
  {
    id: 'group',
    tab: 'Group study room',
    eyebrow: 'Enclosed rooms with clear capacity',
    headline: 'Hold a whole study room for thesis prep or sprint reviews.',
    description:
      'Find Spaces offering multi-seat Room units on their snap-grid map, confirm capacity before rallying your teammates, and check in with one booking token.',
    bullets: [
      'Filter specifically for enclosed Room units with posted capacity',
      'One atomic hold per Unit prevents double-booking during exam week',
      'Clear Host-set maximum wait windows and transparent fee terms',
    ],
    ctaLabel: 'Find Spaces with rooms',
    ctaHref: '/spaces?unitType=room',
    image: '/images/public-landing/workspace.webp',
    width: 1600,
    height: 1067,
    caption: 'Illustrative co-working room setting · not a live Space listing.',
  },
] as const

const JOURNEY_STEPS = [
  {
    step: '01',
    icon: SlidersHorizontal,
    title: 'Search with real constraints',
    text: 'Enter a Metro Cebu campus, pick Seat, Standing Desk, or Room, and filter by current hours.',
  },
  {
    step: '02',
    icon: Clock,
    title: 'Hold your exact Unit now',
    text: 'Choose an Available tile on the Host-updated seat map and complete sandbox checkout within the payment window.',
  },
  {
    step: '03',
    icon: QrCode,
    title: 'Check in with your booking QR',
    text: 'Arrive within your wait window, let the Host scan your booking token, and leave a Visit-verified Review afterward.',
  },
] as const

/**
 * PROTOTYPE VARIANT A — "The Command Finder"
 * Inspired by Peerspace, Croissant, and LiquidSpace: transaction-intent hero with
 * a unified multi-field GET search bar (location + unitType + hours) and instant
 * filter pills for lowest Time-to-Search.
 */
export function ProposalCommandFinder() {
  const [activeModeId, setActiveModeId] =
    useState<(typeof STUDY_MODES)[number]['id']>('solo')
  const activeMode =
    STUDY_MODES.find((mode) => mode.id === activeModeId) ?? STUDY_MODES[0]

  return (
    <div className="discovery-home">
      {/* Section 1: Centered Transaction-Intent Hero over Scrimmed Architectural Photo */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate border-b border-border bg-foreground text-background"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <Image
            src="/images/public-landing/workspace.webp"
            alt=""
            fill
            sizes="100vw"
            loading="eager"
            className="object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#173c2d]/85 via-[#173c2d]/78 to-[#173c2d]/95" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
            Metro Cebu · Instant study &amp; co-working seats
          </p>

          <h1
            id="hero-title"
            className="mt-4 max-w-[18ch] font-heading text-4xl leading-[1.06] font-normal tracking-[-0.03em] text-balance text-background sm:text-5xl lg:text-[3.75rem]"
          >
            Find an open seat and hold it right now.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/85 sm:text-lg">
            Search Verified cafés, libraries, and co-working Spaces across Cebu by campus,
            Unit type, and hours—then claim your exact desk on the seat map.
          </p>

          {/* Unified Multi-Field Plain-GET Command Bar wired to real /spaces params */}
          <form
            action="/spaces"
            method="get"
            role="search"
            aria-label="Search study Spaces"
            className="mt-8 w-full max-w-4xl rounded-2xl border border-border bg-card p-2.5 text-left text-foreground shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
          >
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-center lg:gap-0">
              <div className="relative lg:col-span-5 lg:border-r lg:border-border lg:pr-2">
                <label
                  htmlFor="hero-search-input"
                  className="block px-3 pt-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  Search by campus, city, or Space name
                </label>
                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search-input"
                    name="q"
                    type="search"
                    maxLength={100}
                    placeholder="USC Talamban, UP Cebu, IT Park..."
                    className="min-h-12 w-full rounded-xl bg-transparent py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-3 lg:border-r lg:border-border lg:px-2">
                <label
                  htmlFor="hero-unit-type"
                  className="block px-3 pt-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  Unit type
                </label>
                <select
                  id="hero-unit-type"
                  name="unitType"
                  defaultValue=""
                  className="min-h-12 w-full rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Any Unit</option>
                  <option value="seat">Seat</option>
                  <option value="standing_desk">Standing Desk</option>
                  <option value="room">Study Room</option>
                </select>
              </div>

              <div className="lg:col-span-2 lg:px-2">
                <label
                  htmlFor="hero-hours"
                  className="block px-3 pt-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  Hours
                </label>
                <select
                  id="hero-hours"
                  name="hours"
                  defaultValue=""
                  className="min-h-12 w-full rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Anytime</option>
                  <option value="open_now">Open now</option>
                  <option value="open_late">Open late</option>
                  <option value="open_24h">Open 24h</option>
                </select>
              </div>

              <div className="lg:col-span-2 lg:pl-2">
                <button
                  type="submit"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-5 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Search
                </button>
              </div>
            </div>
          </form>

          {/* Instant Filter & Campus Pills */}
          <div className="mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {QUICK_FILTERS.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="inline-flex min-h-12 min-w-12 items-center gap-1.5 rounded-full border border-background/25 bg-background/10 px-4 py-2 text-sm font-medium whitespace-normal text-background transition-colors hover:border-[#f0c95c] hover:bg-background/20 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                {pill.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-background/85">
            <Link
              href="/spaces"
              className="inline-flex min-h-12 min-w-12 items-center gap-1.5 font-semibold text-[#f0c95c] underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Find a Space
            </Link>
            <p>Reservation fees run in sandbox mode, so no real money moves.</p>
          </div>
        </div>
      </section>

      {/* Section 2: Compact Factual Guarantee Ribbon */}
      <section
        aria-label="Platform guarantees"
        className="border-b border-border bg-card"
      >
        <dl className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-border px-4 sm:grid-cols-2 sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:divide-x lg:px-10">
          {FACTUAL_RIBBON.map((item) => (
            <div
              key={item.label}
              className="space-y-1 py-6 sm:px-4 first:sm:pl-0 last:sm:pr-0"
            >
              <dt className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-primary uppercase">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                {item.label}
              </dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Section 3: Tabbed Intent Explorer ("How are you studying today?") */}
      <section aria-labelledby="intent-title" className="py-16 lg:py-24">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-2">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Tailored to your session
              </p>
              <h2
                id="intent-title"
                className="font-heading text-3xl leading-tight font-normal tracking-[-0.02em] text-foreground sm:text-4xl"
              >
                How are you studying today?
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Study session modes"
              className="flex flex-wrap gap-2"
            >
              {STUDY_MODES.map((mode) => {
                const selected = mode.id === activeMode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveModeId(mode.id)}
                    className={
                      selected
                        ? 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold whitespace-normal text-background focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                        : 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium whitespace-normal text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                    }
                  >
                    {mode.tab}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            role="tabpanel"
            className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-border bg-card p-5 sm:p-8 lg:grid-cols-12"
          >
            <div className="space-y-5 lg:col-span-6">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                {activeMode.eyebrow}
              </p>
              <h3 className="font-heading text-2xl leading-snug font-semibold text-foreground sm:text-3xl">
                {activeMode.headline}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {activeMode.description}
              </p>
              <ul className="space-y-2.5 border-t border-border pt-4 text-sm text-foreground">
                {activeMode.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Link
                  href={activeMode.ctaHref}
                  className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {activeMode.ctaLabel}
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <figure className="space-y-2.5 lg:col-span-6">
              <div className="overflow-hidden rounded-xl bg-secondary">
                <Image
                  src={activeMode.image}
                  alt=""
                  width={activeMode.width}
                  height={activeMode.height}
                  sizes="(min-width: 64rem) 45vw, 100vw"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
              <figcaption className="font-mono text-xs text-muted-foreground">
                {activeMode.caption}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Section 4: Fast 3-Step Utility Strip + Closing Action */}
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="border-t border-border bg-muted/60 py-16 lg:py-20"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Three steps from search to seat
              </p>
              <h2
                id="how-title"
                className="font-heading text-3xl font-normal tracking-[-0.02em] text-foreground"
              >
                Zero guesswork on arrival.
              </h2>
            </div>
            <Link
              href="/spaces"
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold whitespace-normal text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open the discovery map
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {JOURNEY_STEPS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.step}
                  className="space-y-3 rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold tracking-widest text-primary">
                      STEP {item.step}
                    </span>
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>
    </div>
  )
}
