'use client'

import { useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, MapPin, Search } from 'lucide-react'

import {
  EDITORIAL_EASE,
  EDITORIAL_SPRING,
  EditorialInteractive,
  EditorialReveal,
  EditorialStagger,
  EditorialStaggerItem,
} from '@/components/motion/editorial-motion'

const QUICK_FILTERS = [
  { label: 'Open now', href: '/spaces?hours=open_now' },
  { label: 'Open late', href: '/spaces?hours=open_late' },
  { label: 'Private rooms', href: '/spaces?unitType=room' },
  { label: 'Budget Spaces', href: '/spaces?price=budget' },
] as const

const WORK_MODES = [
  {
    id: 'solo',
    tab: 'Solo deep work',
    headline: 'Lock in a quiet desk before you head out.',
    description:
      'Filter Verified Spaces for quiet zones and individual seats, check when the Host last updated availability, and hold your desk while you commute.',
    bullets: [
      'Filter by Seat units and quietness scores from checked-in Seekers',
      'Pick a wait window that fits your travel time across Cebu',
      'Scan your booking QR on arrival to switch your hold to Occupied',
    ],
    ctaLabel: 'Browse open desks now',
    ctaHref: '/spaces?unitType=seat&hours=open_now',
    image: '/images/public-landing/library.webp',
    imageAlt: 'Quiet reading room with wooden study desks and natural daylight',
  },
  {
    id: 'cafe',
    tab: 'Café & laptop',
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
    imageAlt: 'Warm sunlit café interior with timber tables suited for laptop work',
  },
  {
    id: 'group',
    tab: 'Team & private rooms',
    headline: 'Hold a private room for sprints, calls, or group sessions.',
    description:
      'Find Spaces offering multi-seat Room units on their snap-grid map, confirm capacity before rallying everyone, and check in with one booking token.',
    bullets: [
      'Filter specifically for enclosed Room units with posted capacity',
      'One atomic hold per Unit prevents double-booking during peak hours',
      'Clear Host-set maximum wait windows and transparent fee terms',
    ],
    ctaLabel: 'Find Spaces with rooms',
    ctaHref: '/spaces?unitType=room',
    image: '/images/public-landing/workspace.webp',
    imageAlt: 'Bright co-working floor with shared tables and enclosed meeting rooms',
  },
] as const

type WorkModeId = (typeof WORK_MODES)[number]['id']

/**
 * PROTOTYPE VARIANT E — "Curated Hybrid (Command Hero + Manifesto + Session Tabs)"
 * Combines the user's four selected sections from Variants A & B, written for
 * remote workers, freelancers, builders, and students alike (D-026).
 */
export function ProposalCuratedHybrid() {
  const [activeModeId, setActiveModeId] = useState<WorkModeId>('solo')
  const prefersReducedMotion = useReducedMotion()
  const activeMode = WORK_MODES.find((mode) => mode.id === activeModeId) ?? WORK_MODES[0]

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % WORK_MODES.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + WORK_MODES.length) % WORK_MODES.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = WORK_MODES.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    const nextMode = WORK_MODES[nextIndex]!
    setActiveModeId(nextMode.id)
    document.getElementById(`mode-tab-${nextMode.id}`)?.focus()
  }

  return (
    <div className="discovery-home">
      {/* Section 1: Centered Full-Bleed Dark-Forest Command Hero */}
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
          <EditorialReveal immediate y={14}>
            <h1
              id="hero-title"
              className="max-w-[18ch] font-heading text-4xl leading-[1.05] font-normal tracking-[-0.03em] text-balance text-background sm:text-5xl lg:text-[3.85rem]"
            >
              Find an open seat and hold it right now.
            </h1>
          </EditorialReveal>

          <EditorialReveal immediate delay={0.08} y={12}>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/85 sm:text-lg">
              Search Verified co-working Spaces, cafés, and reading rooms across Cebu by
              area, Unit type, and hours—then claim your exact desk on the seat map.
            </p>
          </EditorialReveal>

          {/* Single-Field Plain-GET Search Bar wired to /spaces */}
          <EditorialReveal
            immediate
            delay={0.14}
            y={14}
            className="mt-8 w-full max-w-2xl"
          >
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-2 text-left text-foreground shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center"
            >
              <label htmlFor="hero-search-input" className="sr-only">
                Search by area, city, or Space name
              </label>
              <div className="relative flex flex-1 items-center">
                <Search
                  className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="hero-search-input"
                  name="q"
                  type="search"
                  maxLength={100}
                  placeholder="Area, city, or Space name (e.g. IT Park, Lahug)"
                  className="min-h-12 w-full rounded-xl bg-transparent py-2 pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:text-base"
                />
              </div>

              <motion.button
                type="submit"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={EDITORIAL_SPRING}
                className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Search
              </motion.button>
            </form>
          </EditorialReveal>

          {/* Compact Filter Shortcuts */}
          <EditorialStagger
            immediate
            delayChildren={0.2}
            stagger={0.035}
            className="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2"
          >
            {QUICK_FILTERS.map((pill) => (
              <EditorialStaggerItem key={pill.label} y={8}>
                <EditorialInteractive lift={-1.5}>
                  <Link
                    href={pill.href}
                    className="inline-flex min-h-12 min-w-12 items-center rounded-full border border-background/20 px-4 py-2 text-sm font-medium whitespace-normal text-background/90 transition-colors hover:border-[#f0c95c] hover:bg-background/10 hover:text-background focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
                  >
                    {pill.label}
                  </Link>
                </EditorialInteractive>
              </EditorialStaggerItem>
            ))}
          </EditorialStagger>

          <EditorialReveal immediate delay={0.28} y={8} className="mt-5">
            <Link
              href="/spaces"
              className="group inline-flex min-h-12 min-w-12 items-center gap-1.5 text-sm font-semibold text-[#f0c95c] underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Find a Space
              <ArrowRight
                className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </EditorialReveal>
        </div>
      </section>

      {/* Section 2: Centered Literary Manifesto Pull-Quote */}
      <section aria-label="Editorial manifesto" className="py-16 lg:py-24">
        <EditorialReveal className="mx-auto max-w-4xl space-y-5 px-4 text-center sm:px-6">
          <p className="font-heading text-2xl leading-[1.32] font-normal text-balance text-foreground sm:text-4xl">
            &ldquo;Finding a quiet place to focus, ship work, or read shouldn&rsquo;t mean
            gambling on Cebu traffic and hoping an outlet desk happens to be free.&rdquo;
          </p>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every Space on Worq is Administrator-verified, mapped to individual desks and
            rooms, and honest about when its Host last checked walk-in occupancy.
          </p>
        </EditorialReveal>
      </section>

      {/* Section 3: Interactive "How are you working today?" Tabbed Explorer */}
      <section
        id="how-it-works"
        aria-labelledby="intent-title"
        className="scroll-mt-4 border-t border-border bg-muted/45 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-10">
          <EditorialReveal className="flex flex-col justify-between gap-5 border-b border-border pb-4 md:flex-row md:items-end md:pb-0">
            <h2
              id="intent-title"
              className="font-heading text-3xl leading-[1.1] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-4xl md:pb-4"
            >
              How are you working today?
            </h2>

            <LayoutGroup id="curated-hybrid-modes">
              <div
                role="tablist"
                aria-label="Work session modes"
                className="flex flex-wrap items-center gap-1 sm:gap-2"
              >
                {WORK_MODES.map((mode, index) => {
                  const selected = mode.id === activeMode.id
                  return (
                    <button
                      key={mode.id}
                      id={`mode-tab-${mode.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`mode-panel-${mode.id}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActiveModeId(mode.id)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      className={
                        selected
                          ? 'relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center px-3.5 pt-2 pb-3.5 text-sm font-semibold whitespace-normal text-foreground transition-colors focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                          : 'relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center px-3.5 pt-2 pb-3.5 text-sm font-medium whitespace-normal text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                      }
                    >
                      <span>{mode.tab}</span>
                      {selected && (
                        <motion.span
                          layoutId="curated-hybrid-active-tab"
                          transition={EDITORIAL_SPRING}
                          className="absolute right-0 -bottom-px left-0 h-0.5 bg-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </LayoutGroup>
          </EditorialReveal>

          <EditorialReveal>
            <div
              id={`mode-panel-${activeMode.id}`}
              role="tabpanel"
              aria-labelledby={`mode-tab-${activeMode.id}`}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeMode.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.01 : 0.24,
                    ease: EDITORIAL_EASE,
                  }}
                  className="grid grid-cols-1 lg:min-h-[460px] lg:grid-cols-12"
                >
                  <div className="flex flex-col justify-between gap-7 p-6 sm:p-10 lg:col-span-6 lg:p-12">
                    <div className="space-y-4">
                      <h3 className="max-w-[22ch] font-heading text-2xl leading-[1.16] font-normal tracking-[-0.02em] text-balance text-foreground sm:text-[2rem]">
                        {activeMode.headline}
                      </h3>
                      <p className="max-w-[50ch] text-base leading-relaxed text-muted-foreground">
                        {activeMode.description}
                      </p>
                    </div>

                    <ul className="space-y-3 border-t border-border pt-6 text-sm leading-relaxed text-foreground">
                      {activeMode.bullets.map((bullet, bulletIndex) => (
                        <motion.li
                          key={bullet}
                          initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: prefersReducedMotion ? 0.01 : 0.22,
                            delay: prefersReducedMotion ? 0 : 0.04 + bulletIndex * 0.04,
                            ease: EDITORIAL_EASE,
                          }}
                          className="flex items-start gap-3"
                        >
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{bullet}</span>
                        </motion.li>
                      ))}
                    </ul>

                    <div className="pt-1">
                      <EditorialInteractive lift={-1.5} className="inline-block">
                        <Link
                          href={activeMode.ctaHref}
                          className="group inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-lg bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {activeMode.ctaLabel}
                          <ArrowRight
                            className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </Link>
                      </EditorialInteractive>
                    </div>
                  </div>

                  <div className="relative min-h-[260px] overflow-hidden border-t border-border bg-secondary sm:min-h-[340px] lg:col-span-6 lg:min-h-full lg:border-t-0 lg:border-l">
                    <motion.div
                      initial={{ scale: prefersReducedMotion ? 1 : 1.025 }}
                      animate={{ scale: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0.01 : 0.48,
                        ease: EDITORIAL_EASE,
                      }}
                      className="relative h-full min-h-[260px] w-full sm:min-h-[340px] lg:min-h-full"
                    >
                      <Image
                        src={activeMode.image}
                        alt={activeMode.imageAlt}
                        fill
                        sizes="(min-width: 64rem) 50vw, 100vw"
                        className="object-cover"
                      />
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </EditorialReveal>
        </div>
      </section>

      {/* Section 4: Deep-Forest Centered Closing CTA */}
      <section
        aria-labelledby="colophon-title"
        className="bg-foreground py-20 text-background lg:py-24"
      >
        <EditorialReveal className="mx-auto flex max-w-3xl flex-col items-center space-y-6 px-4 text-center sm:px-6">
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
            <EditorialInteractive lift={-1.5}>
              <Link
                href="/spaces"
                className="group inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                Explore Verified Spaces
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </EditorialInteractive>
            <EditorialInteractive lift={-1.5}>
              <Link
                href="/register"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-background/45 px-6 py-3 text-sm font-semibold whitespace-normal text-background transition-colors hover:bg-background/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
              >
                Create a Seeker account
              </Link>
            </EditorialInteractive>
          </div>
        </EditorialReveal>
      </section>
    </div>
  )
}
