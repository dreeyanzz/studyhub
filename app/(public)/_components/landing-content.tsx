'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { ArrowRight, Check, MapPin, Search } from 'lucide-react'

const EXPO_OUT = [0.16, 1, 0.3, 1] as const
const TAB_INDICATOR_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 36,
  mass: 0.85,
}

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
 * Seeker-centered public landing page (STORY-17, D-026).
 * Motion thesis:
 * - Focal entrance: quiet architectural aperture settle on the hero plate paired with
 *   a crisp masked display reveal and anchored search bar.
 * - Continuity: directional clip-path curtain wipe + sliding underline indicator in the
 *   session-mode explorer that tracks left/right tab order.
 * - Scroll relationship: gentle ink focus progression on the manifesto pull-quote
 *   (always readable in default state, never hidden).
 * - Hover discipline: outer pointer targets stay anchored; inner child elements carry
 *   subtle feedback so controls never shift out from under the cursor.
 */
export function LandingContent() {
  const [activeModeId, setActiveModeId] = useState<WorkModeId>('solo')
  const [tabDirection, setTabDirection] = useState<1 | -1>(1)
  const prefersReducedMotion = useReducedMotion()

  const manifestoRef = useRef<HTMLElement>(null)
  const { scrollYProgress: manifestoProgress } = useScroll({
    target: manifestoRef,
    offset: ['start 0.92', 'center 0.58'],
  })
  const manifestoOpacity = useTransform(manifestoProgress, [0, 1], [0.58, 1])

  const activeIndex = WORK_MODES.findIndex((mode) => mode.id === activeModeId)
  const safeIndex = activeIndex === -1 ? 0 : activeIndex
  const activeMode = WORK_MODES[safeIndex]!

  function selectMode(nextModeId: WorkModeId) {
    if (nextModeId === activeModeId) return
    const nextIndex = WORK_MODES.findIndex((mode) => mode.id === nextModeId)
    setTabDirection(nextIndex >= safeIndex ? 1 : -1)
    setActiveModeId(nextModeId)
  }

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
    setTabDirection(nextIndex >= index ? 1 : -1)
    setActiveModeId(nextMode.id)
    document.getElementById(`mode-tab-${nextMode.id}`)?.focus()
  }

  return (
    <div className="discovery-home">
      {/* Section 1: Centered Full-Bleed Dark-Forest Command Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate overflow-hidden border-b border-border bg-foreground text-background"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 1.05, opacity: 0.22 }}
            animate={{ scale: 1, opacity: 0.35 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.75, ease: EXPO_OUT }}
            className="relative h-full w-full"
          >
            <Image
              src="/images/public-landing/workspace.webp"
              alt=""
              fill
              sizes="100vw"
              loading="eager"
              className="object-cover"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#173c2d]/85 via-[#173c2d]/78 to-[#173c2d]/95" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="-mb-2 overflow-hidden pb-2">
            <motion.h1
              id="hero-title"
              initial={
                prefersReducedMotion
                  ? false
                  : { clipPath: 'inset(0 0 100% 0)', y: 16, opacity: 0.4 }
              }
              animate={{ clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0.01 : 0.62,
                ease: EXPO_OUT,
              }}
              className="max-w-[16ch] pb-2 font-[family-name:var(--font-display)] text-[clamp(2.5rem,5.4vw,4.25rem)] leading-[1.1] font-normal tracking-[-0.03em] text-balance text-background"
            >
              Find an open seat and hold it{' '}
              <em className="font-normal text-[#f0c95c] italic">right now.</em>
            </motion.h1>
          </div>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0.25, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.5,
              delay: prefersReducedMotion ? 0 : 0.08,
              ease: EXPO_OUT,
            }}
            className="mt-5 max-w-[54ch] text-base leading-[1.65] tracking-[0.008em] text-pretty text-background/90 sm:text-[1.125rem]"
          >
            Search Verified co-working Spaces, cafés, and reading rooms across Cebu by
            area, Unit type, and hours — then claim your exact desk on the seat map.
          </motion.p>

          {/* Single-Field Plain-GET Search Bar wired to /spaces */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0.35, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.52,
              delay: prefersReducedMotion ? 0 : 0.14,
              ease: EXPO_OUT,
            }}
            className="mt-8 w-full max-w-2xl"
          >
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-2 text-left text-foreground shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] transition-shadow duration-200 focus-within:shadow-[0_28px_68px_-20px_rgba(0,0,0,0.72)] sm:flex-row sm:items-center"
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
                  className="min-h-12 w-full rounded-xl bg-transparent py-2 pr-3 pl-10 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>

              <button
                type="submit"
                className="group inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold tracking-[-0.005em] whitespace-normal text-[#173c2d] transition-[background-color,transform] duration-150 group-hover:bg-[#e5bc49] group-active:scale-[0.98]">
                  Search
                </span>
              </button>
            </form>
          </motion.div>

          {/* Compact Filter Shortcuts (stationary hit targets; subtle staggered list reveal) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0.4, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.45,
              delay: prefersReducedMotion ? 0 : 0.2,
              ease: EXPO_OUT,
            }}
            className="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2"
          >
            {QUICK_FILTERS.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="group inline-flex min-h-12 min-w-12 items-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
              >
                <span className="inline-flex min-h-12 items-center rounded-full border border-background/25 px-4 py-2 text-sm font-medium tracking-[0.01em] whitespace-normal text-background/95 transition-[border-color,background-color,color,transform] duration-150 group-hover:border-[#f0c95c] group-hover:bg-background/10 group-hover:text-background group-active:scale-[0.98]">
                  {pill.label}
                </span>
              </Link>
            ))}
          </motion.div>

          <div className="mt-5">
            <Link
              href="/spaces"
              className="group inline-flex min-h-12 min-w-12 items-center gap-1.5 text-sm font-semibold tracking-[0.005em] text-[#f0c95c] decoration-[#f0c95c]/60 underline-offset-[5px] hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Find a Space
              <ArrowRight
                className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2: Centered Literary Manifesto Pull-Quote (scroll-linked ink focus) */}
      <section
        ref={manifestoRef}
        aria-label="Editorial manifesto"
        className="py-18 lg:py-24"
      >
        <motion.div
          style={prefersReducedMotion ? undefined : { opacity: manifestoOpacity }}
          className="mx-auto flex max-w-4xl flex-col items-center space-y-6 px-4 text-center sm:px-6"
        >
          <blockquote className="max-w-[34ch] font-[family-name:var(--font-display)] text-[clamp(1.625rem,3.1vw,2.5rem)] leading-[1.24] font-normal tracking-[-0.02em] text-balance text-foreground">
            &ldquo;Finding a quiet place to focus, ship work, or read shouldn&rsquo;t mean
            gambling on Cebu traffic and hoping an outlet desk happens to be free.&rdquo;
          </blockquote>
          <p className="max-w-[52ch] text-base leading-[1.65] text-pretty text-muted-foreground">
            Every Space on Worq is Administrator-verified, mapped to individual desks and
            rooms, and honest about when its Host last checked walk-in occupancy.
          </p>
        </motion.div>
      </section>

      {/* Section 3: Interactive "How are you working today?" Tabbed Explorer */}
      <section
        id="how-it-works"
        aria-labelledby="intent-title"
        className="scroll-mt-4 border-t border-border bg-muted/45 py-16 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-5 border-b border-border pb-4 md:flex-row md:items-end md:pb-0">
            <h2
              id="intent-title"
              className="font-[family-name:var(--font-display)] text-[clamp(1.85rem,3vw,2.5rem)] leading-[1.1] font-normal tracking-[-0.025em] text-balance text-foreground md:pb-4"
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
                      onClick={() => selectMode(mode.id)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      className={
                        selected
                          ? 'relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center px-3.5 pt-2 pb-3.5 text-sm font-semibold tracking-[-0.005em] whitespace-normal text-foreground transition-colors duration-150 focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                          : 'relative inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center px-3.5 pt-2 pb-3.5 text-sm font-medium tracking-[-0.005em] whitespace-normal text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
                      }
                    >
                      <span>{mode.tab}</span>
                      {selected && (
                        <motion.span
                          layoutId="curated-hybrid-active-tab"
                          transition={
                            prefersReducedMotion
                              ? { duration: 0.01 }
                              : TAB_INDICATOR_SPRING
                          }
                          className="absolute right-0 -bottom-px left-0 h-0.5 bg-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </LayoutGroup>
          </div>

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
                animate={{
                  opacity: 1,
                  transition: {
                    duration: prefersReducedMotion ? 0.14 : 0.24,
                    ease: EXPO_OUT,
                  },
                }}
                exit={{
                  opacity: 0,
                  transition: {
                    duration: prefersReducedMotion ? 0.1 : 0.15,
                    ease: 'easeIn',
                  },
                }}
                className="grid grid-cols-1 lg:min-h-[460px] lg:grid-cols-12"
              >
                <motion.div
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, x: tabDirection * 14 }
                  }
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: {
                      duration: prefersReducedMotion ? 0.14 : 0.3,
                      ease: EXPO_OUT,
                    },
                  }}
                  exit={
                    prefersReducedMotion
                      ? undefined
                      : {
                          opacity: 0,
                          x: tabDirection * -10,
                          transition: { duration: 0.14, ease: 'easeIn' },
                        }
                  }
                  className="flex flex-col justify-between gap-7 p-6 sm:p-10 lg:col-span-6 lg:p-12"
                >
                  <div className="space-y-4">
                    <h3 className="max-w-[23ch] font-[family-name:var(--font-display)] text-[clamp(1.5rem,2.2vw,1.95rem)] leading-[1.18] font-normal tracking-[-0.02em] text-balance text-foreground">
                      {activeMode.headline}
                    </h3>
                    <p className="max-w-[48ch] text-base leading-[1.65] text-pretty text-muted-foreground">
                      {activeMode.description}
                    </p>
                  </div>

                  <ul className="space-y-3 border-t border-border pt-6 text-[0.9375rem] leading-[1.6] text-foreground">
                    {activeMode.bullets.map((bullet, bulletIndex) => (
                      <motion.li
                        key={bullet}
                        initial={
                          prefersReducedMotion
                            ? false
                            : { opacity: 0, x: tabDirection * 8 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: prefersReducedMotion ? 0.14 : 0.24,
                          delay: prefersReducedMotion ? 0 : 0.04 + bulletIndex * 0.04,
                          ease: EXPO_OUT,
                        }}
                        className="flex items-start gap-3"
                      >
                        <Check
                          className="mt-1 size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-pretty">{bullet}</span>
                      </motion.li>
                    ))}
                  </ul>

                  <div className="pt-1">
                    <Link
                      href={activeMode.ctaHref}
                      className="group inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f0c95c] px-6 py-3 text-sm font-semibold tracking-[-0.005em] whitespace-normal text-[#173c2d] transition-[background-color,transform] duration-150 group-hover:bg-[#e5bc49] group-active:scale-[0.98]">
                        {activeMode.ctaLabel}
                        <ArrowRight
                          className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </div>
                </motion.div>

                {/* Directional clip-path curtain reveal matching tab movement */}
                <div className="relative min-h-[260px] overflow-hidden border-t border-border bg-secondary sm:min-h-[340px] lg:col-span-6 lg:min-h-full lg:border-t-0 lg:border-l">
                  <motion.div
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : {
                            clipPath:
                              tabDirection === 1
                                ? 'inset(0 0 0 100%)'
                                : 'inset(0 100% 0 0)',
                            scale: 1.04,
                          }
                    }
                    animate={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { clipPath: 'inset(0 0% 0 0%)', scale: 1 }
                    }
                    transition={{
                      duration: prefersReducedMotion ? 0.16 : 0.46,
                      ease: EXPO_OUT,
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
        </div>
      </section>

      {/* Section 4: Deep-Forest Centered Closing CTA */}
      <section
        aria-labelledby="colophon-title"
        className="bg-foreground py-20 text-background lg:py-24"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 px-4 text-center sm:px-6">
          <h2
            id="colophon-title"
            className="max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(2.1rem,4.2vw,3.35rem)] leading-[1.06] font-normal tracking-[-0.025em] text-balance"
          >
            Settle in with your seat{' '}
            <em className="font-normal text-[#f0c95c] italic">already waiting.</em>
          </h2>
          <p className="max-w-[46ch] text-base leading-[1.65] tracking-[0.008em] text-pretty text-background/90 sm:text-[1.0625rem]">
            Browse the map, inspect quietness and Wi-Fi scores from real Visits, and hold
            an open Unit before stepping out the door.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/spaces"
              className="group inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95c]"
            >
              <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-6 py-3 text-sm font-semibold tracking-[-0.005em] whitespace-normal text-[#173c2d] transition-[background-color,transform] duration-150 group-hover:bg-[#e5bc49] group-active:scale-[0.98]">
                Explore Verified Spaces
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
            <Link
              href="/register"
              className="group inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
            >
              <span className="inline-flex min-h-12 items-center justify-center rounded-xl border border-background/45 px-6 py-3 text-sm font-semibold tracking-[0.01em] whitespace-normal text-background transition-[background-color,transform] duration-150 group-hover:bg-background/10 group-active:scale-[0.98]">
                Create a Seeker account
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
