'use client'

import { useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  Armchair,
  ArrowRight,
  Check,
  Clock,
  DoorClosed,
  MapPin,
  PersonStanding,
  QrCode,
  Search,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const EXPO_OUT = [0.16, 1, 0.3, 1] as const
const SEAT_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.85,
}

const QUICK_FILTERS = [
  { label: 'Open now', href: '/spaces?hours=open_now' },
  { label: 'Open late', href: '/spaces?hours=open_late' },
  { label: 'Private rooms', href: '/spaces?unitType=room' },
  { label: 'Budget Spaces', href: '/spaces?price=budget' },
] as const

interface AtelierDesk {
  id: string
  code: string
  name: string
  zone: string
  unitType: 'seat' | 'standing_desk' | 'room'
  status: 'available' | 'occupied'
  capacity: number
  note: string
  waitWindow: string
  ctaLabel: string
  ctaHref: string
  colSpan: string
}

const ATELIER_DESKS: readonly AtelierDesk[] = [
  {
    id: 'w1',
    code: 'W1',
    name: 'Window desk',
    zone: 'Quiet window row',
    unitType: 'seat',
    status: 'available',
    capacity: 1,
    note: 'Outlet under ledge · north daylight',
    waitWindow: '30 min hold window',
    ctaLabel: 'Find open Seat units',
    ctaHref: '/spaces?unitType=seat&hours=open_now',
    colSpan: 'col-span-2',
  },
  {
    id: 'w2',
    code: 'W2',
    name: 'Corner reading desk',
    zone: 'Quiet window row',
    unitType: 'seat',
    status: 'available',
    capacity: 1,
    note: 'Task lamp · acoustic divider',
    waitWindow: '30 min hold window',
    ctaLabel: 'Find open Seat units',
    ctaHref: '/spaces?unitType=seat&hours=open_now',
    colSpan: 'col-span-2',
  },
  {
    id: 'w3',
    code: 'W3',
    name: 'Window desk',
    zone: 'Quiet window row',
    unitType: 'seat',
    status: 'occupied',
    capacity: 1,
    note: 'Walk-in checked in · Host updated 3 min ago',
    waitWindow: 'Currently occupied',
    ctaLabel: 'Browse open Spaces',
    ctaHref: '/spaces?hours=open_now',
    colSpan: 'col-span-2',
  },
  {
    id: 's1',
    code: 'S1',
    name: 'Timber standing bar',
    zone: 'Standing gallery',
    unitType: 'standing_desk',
    status: 'available',
    capacity: 1,
    note: 'High stool optional · fast Wi-Fi zone',
    waitWindow: '20 min hold window',
    ctaLabel: 'Find Standing Desks',
    ctaHref: '/spaces?unitType=standing_desk',
    colSpan: 'col-span-3',
  },
  {
    id: 'r1',
    code: 'R1',
    name: 'Glass study room',
    zone: 'Enclosed rooms',
    unitType: 'room',
    status: 'available',
    capacity: 4,
    note: 'Fits up to 4 · whiteboard & power strip',
    waitWindow: '45 min hold window',
    ctaLabel: 'Find Private Rooms',
    ctaHref: '/spaces?unitType=room',
    colSpan: 'col-span-3',
  },
] as const

const WORK_MODES = [
  {
    id: 'solo',
    tab: 'Solo deep work',
    summary: 'Quiet desks & acoustic corners',
    headline: 'Lock in a quiet desk before you step outside.',
    description:
      'Filter Verified Spaces for quiet zones and individual seats, see when the Host last checked walk-in occupancy, and hold your desk across the commute.',
    bullets: [
      'Filter by Seat units and quietness scores from checked-in Seekers',
      'Pick a wait window that matches your travel time across Cebu',
      'Scan your booking QR on arrival to flip your hold to Occupied',
    ],
    ctaLabel: 'Browse open desks now',
    ctaHref: '/spaces?unitType=seat&hours=open_now',
    image: '/images/public-landing/library.webp',
    imageAlt: 'Quiet reading room with warm timber study desks and natural daylight',
  },
  {
    id: 'cafe',
    tab: 'Café & laptop',
    summary: 'Late pours & outlet tables',
    headline: 'Stop circling full cafés hoping a table opens up.',
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
    imageAlt: 'Sunlit café counter and wooden tables suited for laptop sessions',
  },
  {
    id: 'group',
    tab: 'Team & private rooms',
    summary: 'Enclosed rooms with posted capacity',
    headline: 'Hold a private room for sprints, calls, or study groups.',
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
    imageAlt: 'Bright shared co-working floor with enclosed glass meeting rooms',
  },
] as const

type WorkModeId = (typeof WORK_MODES)[number]['id']

function DeskTypeIcon({
  unitType,
  className,
}: {
  unitType: AtelierDesk['unitType']
  className?: string
}) {
  if (unitType === 'standing_desk') {
    return <PersonStanding className={className} aria-hidden="true" />
  }
  if (unitType === 'room') {
    return <DoorClosed className={className} aria-hidden="true" />
  }
  return <Armchair className={className} aria-hidden="true" />
}

/**
 * PROTOTYPE VARIANT F — "Reading Room Atelier"
 * Impeccable synthesis (`typeset`, `colorize`, `layout`, `animate`, `delight`):
 * - Fraunces optical display serif paired with Geist Sans & tabular numerals
 * - Warm sunlit linen (#f5f0e6), deep cypress (#0f2b20), brass (#e8b949), terracotta (#9a4322)
 * - Asymmetric architectural split hero, tactile 6-column seat-claim focal moment,
 *   and clip-path curtain editorial session gallery.
 */
export function ProposalReadingRoom() {
  const [selectedDeskId, setSelectedDeskId] = useState<string>('w1')
  const [occupiedNotice, setOccupiedNotice] = useState<string | null>(null)
  const [activeModeId, setActiveModeId] = useState<WorkModeId>('solo')
  const prefersReducedMotion = useReducedMotion()

  const selectedDesk =
    ATELIER_DESKS.find((desk) => desk.id === selectedDeskId) ?? ATELIER_DESKS[0]!
  const activeMode = WORK_MODES.find((mode) => mode.id === activeModeId) ?? WORK_MODES[0]
  const availableDeskCount = ATELIER_DESKS.filter((d) => d.status === 'available').length

  function handleSelectDesk(desk: AtelierDesk) {
    if (desk.status === 'occupied') {
      setOccupiedNotice(
        `${desk.code} is currently occupied by a walk-in (Host updated 3 min ago). Pick an open unit nearby.`,
      )
      return
    }
    setOccupiedNotice(null)
    setSelectedDeskId(desk.id)
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % WORK_MODES.length
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
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
    document.getElementById(`atelier-mode-tab-${nextMode.id}`)?.focus()
  }

  return (
    <div className="discovery-home bg-[#f5f0e6] text-[#0f2b20]">
      {/* Band 1: Asymmetric Deep Cypress Architectural Split Hero */}
      <section
        aria-labelledby="atelier-hero-title"
        className="relative overflow-hidden bg-[#0f2b20] text-[#f5f0e6]"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 lg:grid-cols-12">
          {/* Left editorial column */}
          <div className="flex flex-col justify-between gap-8 px-5 py-14 sm:px-8 sm:py-18 lg:col-span-7 lg:px-10 lg:py-22">
            <div className="space-y-6">
              <motion.h1
                id="atelier-hero-title"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EXPO_OUT }}
                className="max-w-[13ch] font-[family-name:var(--font-display)] text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.98] font-normal tracking-[-0.03em] text-balance text-[#f5f0e6]"
              >
                Claim your desk{' '}
                <em className="font-normal text-[#e8b949] italic">before you leave.</em>
              </motion.h1>

              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08, ease: EXPO_OUT }}
                className="max-w-[50ch] text-base leading-relaxed text-pretty text-[#d4ddd3] sm:text-lg"
              >
                Search Administrator-verified study Spaces, cafés, and reading rooms
                across Metro Cebu, inspect the Host&rsquo;s seat map, and hold an exact
                Unit right now.
              </motion.p>
            </div>

            {/* Streamlined Plain-GET Search Bar wired to /spaces */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: EXPO_OUT }}
              className="space-y-4"
            >
              <form
                action="/spaces"
                method="get"
                role="search"
                aria-label="Search study Spaces"
                className="flex w-full max-w-xl flex-col gap-2 rounded-xl bg-[#f5f0e6] p-2 text-[#0f2b20] shadow-[0_24px_48px_-20px_rgba(4,14,10,0.65)] sm:flex-row sm:items-center"
              >
                <label htmlFor="atelier-search-input" className="sr-only">
                  Search by area, city, or Space name
                </label>
                <div className="relative flex flex-1 items-center">
                  <Search
                    className="pointer-events-none absolute left-3.5 size-4 text-[#45594c]"
                    aria-hidden="true"
                  />
                  <input
                    id="atelier-search-input"
                    name="q"
                    type="search"
                    maxLength={100}
                    placeholder="Area, city, or Space name (e.g. IT Park, Lahug)"
                    className="min-h-12 w-full rounded-lg bg-transparent py-2 pr-3 pl-10 text-sm text-[#0f2b20] placeholder:text-[#4c6153] focus-visible:ring-3 focus-visible:ring-[#215c3f] focus-visible:outline-none sm:text-base"
                  />
                </div>

                <button
                  type="submit"
                  className="group relative inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#215c3f]"
                >
                  <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e8b949] px-6 py-3 text-sm font-semibold text-[#0f2b20] transition-transform duration-150 group-hover:bg-[#dfb03d] group-active:scale-[0.98]">
                    Search
                  </span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                {QUICK_FILTERS.map((filter) => (
                  <Link
                    key={filter.label}
                    href={filter.href}
                    className="inline-flex min-h-12 min-w-12 items-center rounded-lg border border-[#f5f0e6]/20 px-3.5 py-2 text-sm font-medium text-[#e6e2d7] transition-colors duration-150 hover:border-[#e8b949] hover:bg-[#f5f0e6]/8 hover:text-[#f5f0e6] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e8b949]"
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </motion.div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#f5f0e6]/15 pt-6 text-sm text-[#c7d3c6]">
              <Link
                href="/spaces"
                className="group inline-flex min-h-12 items-center gap-2 font-semibold text-[#e8b949] underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e8b949]"
              >
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                Find a Space on the map
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <p className="text-xs text-[#b8c7b8]">
                Verified Metro Cebu Spaces · Sandbox fees during demos
              </p>
            </div>
          </div>

          {/* Right full-bleed architectural reading-room plate */}
          <div className="relative min-h-[300px] overflow-hidden border-t border-[#f5f0e6]/12 bg-[#163628] sm:min-h-[380px] lg:col-span-5 lg:min-h-full lg:border-t-0 lg:border-l">
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 1.04, opacity: 0.85 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.75, ease: EXPO_OUT }}
              className="relative h-full min-h-[300px] w-full sm:min-h-[380px] lg:min-h-full"
            >
              <Image
                src="/images/public-landing/library.webp"
                alt="Sunlit reading room with individual wooden study desks and quiet aisles"
                fill
                priority
                sizes="(min-width: 64rem) 44vw, 100vw"
                className="object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0f2b20]/70 via-transparent to-[#0f2b20]/20"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Band 2: Tactile Desk-Claim Floorplan Focal Moment (Warm Linen #f5f0e6) */}
      <section
        aria-labelledby="atelier-floorplan-title"
        className="border-b border-[#d6cfc0] bg-[#f5f0e6] py-18 lg:py-26"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:px-10">
          {/* Editorial thesis column */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:col-span-5">
            <h2
              id="atelier-floorplan-title"
              className="max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.08] font-normal tracking-[-0.025em] text-balance text-[#0f2b20]"
            >
              Don&rsquo;t cross Cebu traffic hoping a desk is still open.
            </h2>

            <p className="max-w-[46ch] text-base leading-relaxed text-pretty text-[#425548]">
              Every Space on Worq publishes its own 6-column seat map. Tap a Unit on this
              sample floorplan to see how selecting a desk, holding a wait window, and
              checking in by QR fit together.
            </p>

            {/* Live Brass Hold Ticket reacting to the chosen sample desk */}
            <div className="overflow-hidden rounded-xl border border-[#cfc7b6] bg-[#faf7f0]">
              <div className="flex items-center justify-between border-b border-[#e2dccf] bg-[#0f2b20] px-5 py-3.5 text-[#f5f0e6]">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#e8b949]">
                  <QrCode className="size-4 shrink-0" aria-hidden="true" />
                  Hold preview
                </span>
                <span className="font-mono text-xs text-[#d4ddd3] tabular-nums">
                  Unit {selectedDesk.code}
                </span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selectedDesk.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EXPO_OUT }}
                  className="space-y-4 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-xl font-normal text-[#0f2b20]">
                        {selectedDesk.name}
                      </p>
                      <p className="mt-0.5 text-sm text-[#425548]">{selectedDesk.zone}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#dce6d5] px-2.5 py-1 text-xs font-semibold text-[#173c2d] tabular-nums">
                      {selectedDesk.capacity === 1
                        ? '1 Seeker'
                        : `Up to ${selectedDesk.capacity}`}
                    </span>
                  </div>

                  <dl className="space-y-2 border-y border-[#e2dccf] py-3.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[#4c6153]">Details</dt>
                      <dd className="text-right font-medium text-[#0f2b20]">
                        {selectedDesk.note}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[#4c6153]">Arrival</dt>
                      <dd className="inline-flex items-center gap-1.5 font-medium text-[#0f2b20] tabular-nums">
                        <Clock className="size-3.5 text-[#215c3f]" aria-hidden="true" />
                        {selectedDesk.waitWindow}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={selectedDesk.ctaHref}
                    className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e8b949] px-5 py-3 text-sm font-semibold text-[#0f2b20] transition-colors duration-150 hover:bg-[#dfb03d] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#215c3f]"
                  >
                    {selectedDesk.ctaLabel}
                    <ArrowRight
                      className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive 6-column architectural floorplan canvas */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-[#cfc7b6] bg-[#faf7f0] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2dccf] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-[family-name:var(--font-display)] text-lg text-[#0f2b20]">
                    North Reading Floor
                  </span>
                  <span className="text-xs text-[#4c6153]">
                    · Sample only, not a live Space
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173c2d] tabular-nums">
                  <span aria-hidden="true" className="size-2 rounded-full bg-[#215c3f]" />
                  {availableDeskCount} of {ATELIER_DESKS.length} open
                </span>
              </div>

              {/* Architectural window ledge cue */}
              <div
                aria-hidden="true"
                className="mt-5 mb-3 flex items-center gap-3 text-xs text-[#54685b]"
              >
                <span className="h-px flex-1 bg-[#d6cfc0]" />
                <span>North daylight windows</span>
                <span className="h-px flex-1 bg-[#d6cfc0]" />
              </div>

              <LayoutGroup id="atelier-floorplan-grid">
                <div
                  role="group"
                  aria-label="Sample 6-column seat map"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-6"
                >
                  {ATELIER_DESKS.map((desk) => {
                    const isSelected = desk.id === selectedDesk.id
                    const isOccupied = desk.status === 'occupied'

                    return (
                      <button
                        key={desk.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectDesk(desk)}
                        className={cn(
                          'group relative flex min-h-[124px] cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#215c3f]',
                          desk.colSpan,
                          isOccupied
                            ? 'border-[#d6cfc0] bg-[#efeae0] text-[#5e544a] hover:border-[#b5542e]/50'
                            : isSelected
                              ? 'border-[#0f2b20] bg-[#0f2b20] text-[#f5f0e6]'
                              : 'border-[#d6cfc0] bg-[#f5f0e6] text-[#0f2b20] hover:border-[#215c3f]',
                        )}
                      >
                        {/* Shared brass reservation frame sliding physically between seats */}
                        {isSelected && !isOccupied && (
                          <motion.span
                            layoutId="atelier-desk-claim"
                            transition={
                              prefersReducedMotion ? { duration: 0.01 } : SEAT_SPRING
                            }
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-[#e8b949]"
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'font-mono text-xs font-semibold tabular-nums',
                              isSelected
                                ? 'text-[#e8b949]'
                                : isOccupied
                                  ? 'text-[#8c3d1e]'
                                  : 'text-[#215c3f]',
                            )}
                          >
                            {desk.code}
                          </span>
                          <DeskTypeIcon
                            unitType={desk.unitType}
                            className={cn(
                              'size-4 shrink-0',
                              isSelected
                                ? 'text-[#e8b949]'
                                : isOccupied
                                  ? 'text-[#8c3d1e]'
                                  : 'text-[#425548]',
                            )}
                          />
                        </div>

                        <div className="relative z-10 mt-4 space-y-1">
                          <p className="text-sm font-semibold">{desk.name}</p>
                          <p
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium',
                              isSelected
                                ? 'text-[#d4ddd3]'
                                : isOccupied
                                  ? 'text-[#8c3d1e]'
                                  : 'text-[#215c3f]',
                            )}
                          >
                            {isOccupied ? (
                              <>
                                <User className="size-3 shrink-0" aria-hidden="true" />
                                Occupied
                              </>
                            ) : isSelected ? (
                              <>
                                <Check
                                  className="size-3 shrink-0 text-[#e8b949]"
                                  aria-hidden="true"
                                />
                                Selected to hold
                              </>
                            ) : (
                              'Available'
                            )}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </LayoutGroup>

              {/* Humane live feedback when tapping an occupied seat or switching seats */}
              <div
                aria-live="polite"
                className="mt-4 flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-[#e2dccf] pt-3.5 text-xs"
              >
                {occupiedNotice ? (
                  <p className="font-medium text-[#8c3d1e]">{occupiedNotice}</p>
                ) : (
                  <p className="text-[#4c6153]">
                    Tap any open unit to preview its hold ticket. Host-updated · 3 min
                    ago.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Band 3: Asymmetric Editorial Session Index with Curtain Photo Reveal */}
      <section
        id="how-it-works"
        aria-labelledby="atelier-modes-title"
        className="scroll-mt-4 bg-[#ebe5d8] py-18 lg:py-26"
      >
        <div className="mx-auto w-full max-w-7xl space-y-10 px-5 sm:px-8 lg:px-10">
          <h2
            id="atelier-modes-title"
            className="max-w-[18ch] font-[family-name:var(--font-display)] text-[clamp(2rem,3.6vw,3rem)] leading-[1.08] font-normal tracking-[-0.025em] text-balance text-[#0f2b20]"
          >
            How are you working today?
          </h2>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
            {/* Vertical editorial mode rail */}
            <LayoutGroup id="atelier-work-modes">
              <div
                role="tablist"
                aria-label="Work session modes"
                aria-orientation="vertical"
                className="flex flex-col divide-y divide-[#d3cbb9] border-y border-[#d3cbb9] lg:col-span-4"
              >
                {WORK_MODES.map((mode, index) => {
                  const selected = mode.id === activeMode.id
                  return (
                    <button
                      key={mode.id}
                      id={`atelier-mode-tab-${mode.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`atelier-mode-panel-${mode.id}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActiveModeId(mode.id)}
                      onKeyDown={(event) => handleModeKeyDown(event, index)}
                      className={cn(
                        'relative flex min-h-20 cursor-pointer flex-col justify-center px-5 py-5 text-left transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#215c3f]',
                        selected
                          ? 'bg-[#f5f0e6] text-[#0f2b20]'
                          : 'text-[#425548] hover:bg-[#f5f0e6]/55 hover:text-[#0f2b20]',
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId="atelier-mode-indicator"
                          transition={
                            prefersReducedMotion ? { duration: 0.01 } : SEAT_SPRING
                          }
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-1 bg-[#0f2b20]"
                        />
                      )}
                      <span className="font-[family-name:var(--font-display)] text-xl font-normal">
                        {mode.tab}
                      </span>
                      <span className="mt-1 text-sm text-[#4c6153]">{mode.summary}</span>
                    </button>
                  )
                })}
              </div>
            </LayoutGroup>

            {/* Magazine spread panel with clip-path curtain reveal */}
            <div
              id={`atelier-mode-panel-${activeMode.id}`}
              role="tabpanel"
              aria-labelledby={`atelier-mode-tab-${activeMode.id}`}
              className="overflow-hidden rounded-xl border border-[#cfc7b6] bg-[#faf7f0] lg:col-span-8"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeMode.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
                  className="grid h-full grid-cols-1 md:grid-cols-12"
                >
                  <div className="relative min-h-[240px] overflow-hidden bg-[#dce6d5] md:col-span-5 md:min-h-[420px]">
                    <motion.div
                      initial={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : { clipPath: 'inset(0 100% 0 0)', scale: 1.04 }
                      }
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { clipPath: 'inset(0 0% 0 0)', scale: 1 }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0.16 : 0.48,
                        ease: EXPO_OUT,
                      }}
                      className="relative h-full min-h-[240px] w-full md:min-h-[420px]"
                    >
                      <Image
                        src={activeMode.image}
                        alt={activeMode.imageAlt}
                        fill
                        sizes="(min-width: 64rem) 32vw, 100vw"
                        className="object-cover"
                      />
                    </motion.div>
                  </div>

                  <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 md:col-span-7">
                    <div className="space-y-3.5">
                      <h3 className="max-w-[20ch] font-[family-name:var(--font-display)] text-2xl leading-[1.15] font-normal tracking-[-0.02em] text-balance text-[#0f2b20] sm:text-[1.85rem]">
                        {activeMode.headline}
                      </h3>
                      <p className="max-w-[48ch] text-base leading-relaxed text-pretty text-[#425548]">
                        {activeMode.description}
                      </p>
                    </div>

                    <ul className="space-y-2.5 border-t border-[#e2dccf] pt-5 text-sm leading-relaxed text-[#0f2b20]">
                      {activeMode.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-[#215c3f]"
                            aria-hidden="true"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <div>
                      <Link
                        href={activeMode.ctaHref}
                        className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e8b949] px-6 py-3 text-sm font-semibold text-[#0f2b20] transition-colors duration-150 hover:bg-[#dfb03d] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#215c3f]"
                      >
                        {activeMode.ctaLabel}
                        <ArrowRight
                          className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Band 4: Asymmetric Deep Cypress Colophon */}
      <section
        aria-labelledby="atelier-colophon-title"
        className="bg-[#0f2b20] py-20 text-[#f5f0e6] lg:py-24"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-end gap-8 px-5 sm:px-8 lg:grid-cols-12 lg:px-10">
          <div className="space-y-4 lg:col-span-7">
            <h2
              id="atelier-colophon-title"
              className="max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.04] font-normal tracking-[-0.025em] text-balance text-[#f5f0e6]"
            >
              Settle in with your seat{' '}
              <em className="font-normal text-[#e8b949] italic">already waiting.</em>
            </h2>
            <p className="max-w-[52ch] text-base leading-relaxed text-pretty text-[#d4ddd3]">
              Browse Verified Spaces across Cebu, inspect quietness and Wi-Fi scores from
              real Visits, and hold an open Unit before heading out.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 lg:col-span-5 lg:items-end">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/spaces"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e8b949] px-6 py-3 text-sm font-semibold text-[#0f2b20] transition-colors duration-150 hover:bg-[#dfb03d] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e8b949]"
              >
                Explore Verified Spaces
                <ArrowRight
                  className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#f5f0e6]/35 px-6 py-3 text-sm font-semibold text-[#f5f0e6] transition-colors duration-150 hover:bg-[#f5f0e6]/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f5f0e6]"
              >
                Create a Seeker account
              </Link>
            </div>
            <p className="text-xs text-[#b8c7b8]">
              Reservation fees run in sandbox mode, so no real money moves.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
