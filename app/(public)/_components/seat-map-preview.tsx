'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Armchair,
  ArrowRight,
  CheckCircle,
  Clock,
  DoorClosed,
  Hourglass,
  PersonStanding,
  QrCode,
  User,
} from 'lucide-react'

import type { SeatState, UnitType } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

interface PreviewUnit {
  id: string
  label: string
  unitType: UnitType
  seatState: SeatState
  capacity?: number
  note: string
  colSpanDesktop?: 1 | 2
}

// Illustrative 6-column snap-grid Zone matching D-003/D-004/D-062 semantics.
// Explicitly non-live (D-002, D-033): lets Seekers feel the exact pick-and-hold
// flow before opening /spaces.
const PREVIEW_UNITS: readonly PreviewUnit[] = [
  {
    id: 'A1',
    label: 'A1',
    unitType: 'seat',
    seatState: 'occupied',
    note: 'Corner reading desk near window',
  },
  {
    id: 'A2',
    label: 'A2',
    unitType: 'seat',
    seatState: 'available',
    note: 'Window desk with dedicated power outlet',
  },
  {
    id: 'A3',
    label: 'A3',
    unitType: 'seat',
    seatState: 'available',
    note: 'Quiet center desk under warm task lamp',
  },
  {
    id: 'S1',
    label: 'S1',
    unitType: 'standing_desk',
    seatState: 'reserved',
    note: 'Standing desk held while a Seeker commutes',
  },
  {
    id: 'S2',
    label: 'S2',
    unitType: 'standing_desk',
    seatState: 'available',
    note: 'Standing desk with high-stool option and outlet',
  },
  {
    id: 'B1',
    label: 'B1',
    unitType: 'seat',
    seatState: 'pending_payment',
    note: 'Temporarily locked during payment window',
  },
  {
    id: 'B2',
    label: 'B2',
    unitType: 'seat',
    seatState: 'available',
    note: 'Silent wall desk ideal for exam review',
  },
  {
    id: 'R1',
    label: 'R1',
    unitType: 'room',
    seatState: 'available',
    capacity: 4,
    note: 'Enclosed 4-person study room with whiteboard',
    colSpanDesktop: 2,
  },
  {
    id: 'B3',
    label: 'B3',
    unitType: 'seat',
    seatState: 'occupied',
    note: 'Occupied walk-in study desk',
  },
] as const

const WAIT_WINDOWS = [15, 30, 45] as const

const UNIT_TYPE_META: Record<UnitType, { label: string; icon: typeof Armchair }> = {
  seat: { label: 'Seat', icon: Armchair },
  standing_desk: { label: 'Standing Desk', icon: PersonStanding },
  room: { label: 'Room', icon: DoorClosed },
}

const SEAT_STATE_META: Record<
  SeatState,
  {
    label: string
    icon: typeof CheckCircle
    tileClass: string
    iconClass: string
  }
> = {
  available: {
    label: 'Available',
    icon: CheckCircle,
    tileClass:
      'border-emerald-700/40 bg-emerald-50 text-emerald-950 hover:border-primary hover:bg-emerald-100/80',
    iconClass: 'text-emerald-700',
  },
  pending_payment: {
    label: 'Pending Payment',
    icon: Hourglass,
    tileClass: 'border-purple-600/35 bg-purple-50 text-purple-950',
    iconClass: 'text-purple-700',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    tileClass: 'border-blue-600/35 bg-blue-50 text-blue-950',
    iconClass: 'text-blue-700',
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    tileClass: 'border-amber-600/35 bg-amber-50 text-amber-950',
    iconClass: 'text-amber-700',
  },
}

/**
 * Interactive illustrative 6-column snap-grid seat map preview for `/` (STORY-17).
 * Mirrors Worq's real SeatMapTile states (D-004) and wait-window picker (STORY-09)
 * while clearly stating it is an illustrative preview, never live inventory (D-002, D-033).
 */
export function SeatMapPreview() {
  const [selectedId, setSelectedId] = useState<string>('A2')
  const [waitWindowMinutes, setWaitWindowMinutes] =
    useState<(typeof WAIT_WINDOWS)[number]>(30)

  const selectedUnit = PREVIEW_UNITS.find((u) => u.id === selectedId) ?? PREVIEW_UNITS[1]!
  const selectedType = UNIT_TYPE_META[selectedUnit.unitType]
  const SelectedTypeIcon = selectedType.icon
  const displayUnitName =
    selectedUnit.unitType === 'room' && selectedUnit.capacity
      ? `${selectedUnit.label} (${selectedUnit.capacity})`
      : selectedUnit.label

  return (
    <div
      data-testid="landing-seat-map-preview"
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8"
    >
      {/* Left: Illustrative 6-column Snap-Grid Zone */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_14px_34px_-28px_rgba(23,60,45,0.28)] sm:p-6 lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
          <div>
            <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
              Interactive preview · illustrative layout
            </p>
            <h3 className="mt-1 font-heading text-xl font-semibold text-foreground">
              Quiet Desk Wing
            </h3>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Sample only · not a live Space
          </p>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Tap any <strong className="font-semibold text-foreground">Available</strong>{' '}
          Unit below to preview how Worq prepares your hold and check-in pass.
        </p>

        {/* Responsive grid: 2 columns at 360px/200% zoom (zero overflow), true 6-column snap-grid from sm up */}
        <div
          role="group"
          aria-label="Illustrative seat map units"
          className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-6 sm:gap-2"
        >
          {PREVIEW_UNITS.map((unit, idx) => {
            const typeInfo = UNIT_TYPE_META[unit.unitType]
            const stateInfo = SEAT_STATE_META[unit.seatState]
            const TypeIcon = typeInfo.icon
            const StateIcon = stateInfo.icon
            const isAvailable = unit.seatState === 'available'
            const isSelected = unit.id === selectedUnit.id
            const label =
              unit.unitType === 'room' && unit.capacity
                ? `${unit.label} (${unit.capacity})`
                : unit.label

            // Insert a subtle aisle spacer on desktop 6-column layout (between col 3 and col 5 in row 1)
            const aisleSpacer =
              idx === 3 ? (
                <div
                  key="aisle-row-1"
                  aria-hidden="true"
                  className="hidden items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/40 font-mono text-[11px] text-muted-foreground sm:flex"
                >
                  Aisle
                </div>
              ) : idx === 7 ? (
                <div
                  key="aisle-row-2"
                  aria-hidden="true"
                  className="hidden items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/40 font-mono text-[11px] text-muted-foreground sm:flex"
                >
                  Aisle
                </div>
              ) : null

            const tileSpanClass =
              unit.colSpanDesktop === 2 ? 'col-span-2 sm:col-span-2' : ''

            const tileContent = (
              <>
                <span className="flex w-full items-center justify-between gap-1">
                  <TypeIcon className="size-3.5 shrink-0 opacity-85" aria-hidden="true" />
                  <StateIcon
                    className={cn('size-3.5 shrink-0', stateInfo.iconClass)}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1.5 block text-sm leading-tight font-semibold wrap-anywhere">
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-tight wrap-anywhere opacity-85">
                  {stateInfo.label}
                </span>
              </>
            )

            return (
              <div key={unit.id} className="contents">
                {aisleSpacer}
                {isAvailable ? (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${label}, ${typeInfo.label}, ${stateInfo.label}${isSelected ? ', selected' : ''}`}
                    onClick={() => setSelectedId(unit.id)}
                    className={cn(
                      'flex min-h-16 min-w-12 flex-col items-start justify-between rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      stateInfo.tileClass,
                      tileSpanClass,
                      isSelected &&
                        'border-foreground bg-secondary ring-2 ring-foreground',
                    )}
                  >
                    {tileContent}
                  </button>
                ) : (
                  <div
                    role="img"
                    aria-label={`${label}, ${typeInfo.label}, ${stateInfo.label}`}
                    className={cn(
                      'flex min-h-16 min-w-12 flex-col items-start justify-between rounded-xl border p-2.5 text-left opacity-90',
                      stateInfo.tileClass,
                      tileSpanClass,
                    )}
                  >
                    {tileContent}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Wait-window chooser mirroring STORY-09 */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Sample wait window (travel time before check-in)
          </p>
          <div
            role="group"
            aria-label="Choose illustrative wait window"
            className="mt-2.5 flex flex-wrap gap-2"
          >
            {WAIT_WINDOWS.map((minutes) => {
              const active = waitWindowMinutes === minutes
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setWaitWindowMinutes(minutes)}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {minutes} min
                </button>
              )
            })}
          </div>
        </div>

        {/* Compact legend matching SeatMapLegend (never color alone, D-031) */}
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-emerald-950">
            <CheckCircle className="size-3.5 text-emerald-700" aria-hidden="true" />
            Available
          </span>
          <span className="inline-flex items-center gap-1.5 text-purple-950">
            <Hourglass className="size-3.5 text-purple-700" aria-hidden="true" />
            Pending Payment
          </span>
          <span className="inline-flex items-center gap-1.5 text-blue-950">
            <Clock className="size-3.5 text-blue-700" aria-hidden="true" />
            Reserved
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-950">
            <User className="size-3.5 text-amber-700" aria-hidden="true" />
            Occupied
          </span>
        </div>
      </div>

      {/* Right: Live-updating Illustrative Hold Summary & Check-in Pass */}
      <div
        aria-live="polite"
        data-testid="landing-hold-summary"
        className="rounded-2xl border border-border bg-card shadow-[0_14px_34px_-28px_rgba(23,60,45,0.28)] lg:col-span-5"
      >
        <div className="rounded-t-2xl bg-foreground px-5 py-4 text-background sm:px-6">
          <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
            Illustrative Hold Summary
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-heading text-2xl font-semibold">Unit {displayUnitName}</p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-background/15 px-2.5 py-1 font-mono text-xs text-background">
              <SelectedTypeIcon className="size-3.5" aria-hidden="true" />
              {selectedType.label}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {selectedUnit.note}
          </p>

          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Seat state</dt>
              <dd className="font-medium text-emerald-900">Available to hold now</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Wait window</dt>
              <dd className="font-mono font-medium text-foreground">
                {waitWindowMinutes} min to check in
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Booking token</dt>
              <dd className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
                <QrCode className="size-4 text-primary" aria-hidden="true" />
                WRQ-DEMO-{selectedUnit.id}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Reservation fee</dt>
              <dd className="font-medium text-foreground">Sandbox test mode</dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-muted-foreground">
            In a live Space, your hold locks for the payment window while you complete
            sandbox checkout, then stays Reserved for your wait window until the Host
            scans your booking QR.
          </p>

          <Link
            href="/spaces"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f0c95c] px-5 py-3 text-center text-sm font-semibold whitespace-normal text-[#173c2d] transition-colors hover:bg-[#e5bc49] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Browse real Verified Spaces
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
