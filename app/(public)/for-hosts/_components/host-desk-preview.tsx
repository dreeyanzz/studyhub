'use client'

import { useState } from 'react'
import {
  Armchair,
  CheckCircle,
  Clock,
  DoorClosed,
  PersonStanding,
  QrCode,
  RotateCcw,
  User,
} from 'lucide-react'

import type { SeatState, UnitType } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

interface DeskUnit {
  id: string
  label: string
  unitType: UnitType
  capacity?: number
  state: Extract<SeatState, 'available' | 'occupied'>
}

const INITIAL_DESK_UNITS: readonly DeskUnit[] = [
  { id: 'A1', label: 'A1', unitType: 'seat', state: 'available' },
  { id: 'A2', label: 'A2', unitType: 'seat', state: 'occupied' },
  { id: 'S1', label: 'S1', unitType: 'standing_desk', state: 'available' },
  { id: 'R1', label: 'R1 (4)', unitType: 'room', capacity: 4, state: 'available' },
]

const TYPE_META: Record<UnitType, { label: string; icon: typeof Armchair }> = {
  seat: { label: 'Seat', icon: Armchair },
  standing_desk: { label: 'Standing Desk', icon: PersonStanding },
  room: { label: 'Room', icon: DoorClosed },
}

type CheckInStage = 'reserved' | 'occupied' | 'available'

/**
 * Interactive illustrative Host Front Desk preview for `/for-hosts` (STORY-17).
 * Demonstrates STORY-12 one-tap walk-in occupancy updates (D-002, D-051) and
 * STORY-10 QR booking-token check-in/check-out without calling live data.
 */
export function HostDeskPreview() {
  const [units, setUnits] = useState<DeskUnit[]>(() => [...INITIAL_DESK_UNITS])
  const [freshnessLabel, setFreshnessLabel] = useState<string>('Host-updated · 4 min ago')
  const [deskAnnouncement, setDeskAnnouncement] = useState<string>('')
  const [checkInStage, setCheckInStage] = useState<CheckInStage>('reserved')

  const openCount = units.filter((u) => u.state === 'available').length

  function toggleWalkInUnit(unitId: string) {
    const target = units.find((u) => u.id === unitId)
    if (!target) return
    const nextState: DeskUnit['state'] =
      target.state === 'available' ? 'occupied' : 'available'

    setUnits((current) =>
      current.map((unit) => (unit.id === unitId ? { ...unit, state: nextState } : unit)),
    )
    setFreshnessLabel('Host-updated · just now')
    setDeskAnnouncement(
      `Unit ${target.label} marked ${nextState === 'available' ? 'Available' : 'Occupied'}.`,
    )
  }

  function advanceCheckIn() {
    if (checkInStage === 'reserved') {
      setCheckInStage('occupied')
      setFreshnessLabel('Host-updated · just now')
      setDeskAnnouncement('Booking token WRQ-4821 verified. Unit A3 is now Occupied.')
      return
    }
    if (checkInStage === 'occupied') {
      setCheckInStage('available')
      setFreshnessLabel('Host-updated · just now')
      setDeskAnnouncement('Unit A3 checked out and returned to Available.')
      return
    }
    setCheckInStage('reserved')
    setDeskAnnouncement('Sample hold WRQ-4821 reset to Reserved.')
  }

  return (
    <div
      data-testid="host-desk-preview"
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8"
    >
      {/* Panel A: One-Tap Walk-In Occupancy (STORY-12) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_14px_34px_-28px_rgba(23,60,45,0.28)] sm:p-6 lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
          <div>
            <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
              Interactive preview · one-tap occupancy
            </p>
            <h3 className="mt-1 font-heading text-xl font-semibold text-foreground">
              Walk-in floor control
            </h3>
          </div>
          <span
            data-testid="host-preview-freshness"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground"
          >
            <Clock className="size-3.5 text-primary" aria-hidden="true" />
            {freshnessLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            Tap any Unit below when a walk-in arrives or leaves. Your Space&apos;s
            freshness timestamp updates immediately.
          </p>
          <p className="shrink-0 font-mono text-xs font-semibold text-foreground">
            {openCount} of {units.length} Available
          </p>
        </div>

        <ul className="mt-5 divide-y divide-border border-y border-border">
          {units.map((unit) => {
            const typeInfo = TYPE_META[unit.unitType]
            const TypeIcon = typeInfo.icon
            const isAvailable = unit.state === 'available'
            const nextActionLabel = isAvailable ? 'Mark Occupied' : 'Mark Available'

            return (
              <li
                key={unit.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border',
                      isAvailable
                        ? 'border-emerald-700/35 bg-emerald-50 text-emerald-800'
                        : 'border-amber-600/35 bg-amber-50 text-amber-800',
                    )}
                    aria-hidden="true"
                  >
                    <TypeIcon className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      Unit {unit.label}{' '}
                      <span className="font-normal text-muted-foreground">
                        · {typeInfo.label}
                      </span>
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 inline-flex items-center gap-1 text-xs font-medium',
                        isAvailable ? 'text-emerald-900' : 'text-amber-900',
                      )}
                    >
                      {isAvailable ? (
                        <CheckCircle
                          className="size-3.5 text-emerald-700"
                          aria-hidden="true"
                        />
                      ) : (
                        <User className="size-3.5 text-amber-700" aria-hidden="true" />
                      )}
                      {isAvailable ? 'Available' : 'Occupied'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleWalkInUnit(unit.id)}
                  aria-label={`${nextActionLabel} for Unit ${unit.label}`}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium whitespace-normal transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isAvailable
                      ? 'border-border bg-background text-foreground hover:bg-muted'
                      : 'border-primary bg-secondary text-secondary-foreground hover:bg-accent',
                  )}
                >
                  {nextActionLabel}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Sample desk only · no live Space data is changed.
        </p>
      </div>

      {/* Panel B: QR Check-In Desk (STORY-10) */}
      <div className="rounded-2xl border border-border bg-card shadow-[0_14px_34px_-28px_rgba(23,60,45,0.28)] lg:col-span-5">
        <div className="rounded-t-2xl bg-foreground px-5 py-4 text-background sm:px-6">
          <p className="font-mono text-xs font-semibold tracking-widest text-[#f0c95c] uppercase">
            Illustrative Check-In Desk
          </p>
          <h3 className="mt-1 font-heading text-xl font-semibold text-background">
            Scan or verify a booking token
          </h3>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl border border-border bg-muted/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
                <QrCode className="size-4 text-primary" aria-hidden="true" />
                WRQ-4821
              </span>
              <span
                data-testid="host-checkin-stage-badge"
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 font-mono text-xs font-semibold',
                  checkInStage === 'reserved' &&
                    'border-blue-600/35 bg-blue-50 text-blue-950',
                  checkInStage === 'occupied' &&
                    'border-amber-600/35 bg-amber-50 text-amber-950',
                  checkInStage === 'available' &&
                    'border-emerald-700/35 bg-emerald-50 text-emerald-950',
                )}
              >
                {checkInStage === 'reserved' && 'Reserved'}
                {checkInStage === 'occupied' && 'Occupied · Checked in'}
                {checkInStage === 'available' && 'Available · Checked out'}
              </span>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="font-medium text-foreground">Unit A3 · Seat</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Wait window</dt>
                <dd className="font-mono text-foreground">
                  {checkInStage === 'reserved'
                    ? '24 min remaining'
                    : checkInStage === 'occupied'
                      ? 'Arrived on time'
                      : 'Session ended'}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            onClick={advanceCheckIn}
            className={cn(
              'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-center text-sm font-semibold whitespace-normal transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
              checkInStage === 'reserved' &&
                'bg-[#f0c95c] text-[#173c2d] hover:bg-[#e5bc49]',
              checkInStage === 'occupied' &&
                'bg-primary text-primary-foreground hover:bg-primary/90',
              checkInStage === 'available' &&
                'border border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {checkInStage === 'reserved' && 'Verify check-in'}
            {checkInStage === 'occupied' && 'Complete check-out'}
            {checkInStage === 'available' && (
              <>
                <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
                Reset check-in demo
              </>
            )}
          </button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            If a Seeker does not arrive before their wait window ends, Worq releases the
            hold back to Available automatically and marks it as a no-show.
          </p>

          <p aria-live="polite" className="sr-only">
            {deskAnnouncement}
          </p>
        </div>
      </div>
    </div>
  )
}
