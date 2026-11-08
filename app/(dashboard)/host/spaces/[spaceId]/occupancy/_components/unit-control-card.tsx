'use client'

import {
  Armchair,
  CheckCircle,
  Clock,
  DoorClosed,
  Hourglass,
  PersonStanding,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tapOutcome } from '@/lib/occupancy/override'
import type { SeatMapUnit, SeatState, UnitType } from '@/lib/seat-map/grid'
import type { UnitState } from '@/lib/validation/occupancy'
import { cn } from '@/lib/utils'

import { RelativeTime } from './relative-time'

/** Shared with the list view (`occupancy-list.tsx`), so both show a unit the same way. */
export const TYPE_CONFIG: Record<
  UnitType,
  {
    label: string
    icon: typeof Armchair
  }
> = {
  seat: { label: 'Seat', icon: Armchair },
  standing_desk: { label: 'Standing Desk', icon: PersonStanding },
  room: { label: 'Room', icon: DoorClosed },
}

/**
 * Seat-state badge colors, the same palette as STORY-07's tiles until Maria picks the
 * seat-state tokens (design §8, D-031, D-042). Light colors only: the app has no dark
 * theme, and Tailwind's `dark:` follows the operating system, which would put light
 * text on a grey badge on the light page.
 */
export const STATE_BADGES: Record<
  SeatState,
  {
    label: string
    icon: typeof CheckCircle
    className: string
  }
> = {
  available: {
    label: 'Available',
    icon: CheckCircle,
    className: 'border-emerald-600/40 bg-emerald-50 text-emerald-950',
  },
  pending_payment: {
    label: 'Pending Payment',
    icon: Hourglass,
    className: 'border-purple-600/40 bg-purple-50 text-purple-950',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    className: 'border-blue-600/40 bg-blue-50 text-blue-950',
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    className: 'border-amber-600/40 bg-amber-50 text-amber-950',
  },
}

export const ACTIONS: { state: UnitState; label: string }[] = [
  { state: 'available', label: 'Available' },
  { state: 'reserved', label: 'Reserved' },
  { state: 'occupied', label: 'Occupied' },
]

export interface UnitControlCardProps {
  unit: SeatMapUnit
  isPending?: boolean
  onStateTap: (unit: SeatMapUnit, targetState: UnitState) => void | Promise<void>
  className?: string
}

/**
 * Unit control card displaying unit details, freshness, and one-tap occupancy pills (STORY-12 design §3).
 *
 * Implements 48×48 px touch targets (D-031), Seeker hold badge (D-057),
 * and same-state tap logic (no-op for Seeker holds, re-vouch for Host-set units).
 */
export function UnitControlCard({
  unit,
  isPending = false,
  onStateTap,
  className,
}: UnitControlCardProps) {
  const typeInfo = TYPE_CONFIG[unit.unitType] ?? {
    label: unit.unitType,
    icon: Armchair,
  }
  const stateInfo = STATE_BADGES[unit.seatState] ?? {
    label: unit.seatState,
    icon: CheckCircle,
    className: 'border-border bg-card text-foreground',
  }

  const isRoomWithCapacity =
    unit.unitType === 'room' && unit.capacity !== null && unit.capacity !== undefined
  const displayLabel = isRoomWithCapacity
    ? `${unit.label} (Cap: ${unit.capacity})`
    : unit.label

  const TypeIcon = typeInfo.icon
  const StateIcon = stateInfo.icon

  return (
    <Card className={cn('h-full transition-shadow', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              {displayLabel}
            </CardTitle>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TypeIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{typeInfo.label}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold',
                stateInfo.className,
              )}
            >
              <StateIcon className="size-3 shrink-0" aria-hidden="true" />
              {stateInfo.label}
            </span>

            {unit.reservationId ? (
              <Badge
                variant="secondary"
                className="border-primary/20 text-xs font-medium"
              >
                Seeker hold
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="text-xs text-muted-foreground">
          <span>Host-updated · </span>
          <RelativeTime date={unit.hostUpdatedAt} />
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-foreground">Set occupancy:</div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={`Occupancy controls for ${unit.label}`}
          >
            {ACTIONS.map(({ state, label }) => {
              const isActive = unit.seatState === state

              return (
                <Button
                  key={state}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  // Stays focusable while saving, so focus isn't lost (D-031).
                  disabled={isPending}
                  focusableWhenDisabled
                  className={cn(
                    'h-12 min-w-12 px-4 py-2 text-xs font-medium transition-all sm:text-sm',
                    isActive && 'ring-2 ring-primary ring-offset-2',
                  )}
                  onClick={() => {
                    // Tap handling:
                    // If Seeker hold exists and same state tapped -> no-op (FR-3.2, D-050)
                    if (
                      tapOutcome(unit.reservationId, unit.seatState, state) === 'no_op'
                    ) {
                      return
                    }
                    onStateTap(unit, state)
                  }}
                  aria-pressed={isActive}
                  aria-label={`Mark ${unit.label} as ${label}`}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
