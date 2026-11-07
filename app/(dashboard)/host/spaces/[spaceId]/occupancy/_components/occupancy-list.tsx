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
import { tapOutcome } from '@/lib/occupancy/override'
import type { SeatMapUnit, SeatMapZone, SeatState, UnitType } from '@/lib/seat-map/grid'
import type { UnitState } from '@/lib/validation/occupancy'
import { cn } from '@/lib/utils'

import { RelativeTime } from './relative-time'

const TYPE_CONFIG: Record<
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

const STATE_BADGES: Record<
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
    className:
      'border-emerald-600/40 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100',
  },
  pending_payment: {
    label: 'Pending Payment',
    icon: Hourglass,
    className:
      'border-purple-600/40 bg-purple-50 text-purple-950 dark:border-purple-500/40 dark:bg-purple-950/40 dark:text-purple-100',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    className:
      'border-blue-600/40 bg-blue-50 text-blue-950 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-100',
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    className:
      'border-amber-600/40 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
  },
}

const ACTIONS: { state: UnitState; label: string }[] = [
  { state: 'available', label: 'Available' },
  { state: 'reserved', label: 'Reserved' },
  { state: 'occupied', label: 'Occupied' },
]

export interface OccupancyListProps {
  zones: SeatMapZone[]
  isPending?: boolean
  onStateTap: (unit: SeatMapUnit, targetState: UnitState) => void | Promise<void>
}

/**
 * Accessible tabular list view of all units across zones (STORY-12 design §3, D-031).
 *
 * Full keyboard-navigable table alternative to the spatial grid.
 */
export function OccupancyList({
  zones,
  isPending = false,
  onStateTap,
}: OccupancyListProps) {
  const unitsWithZone = zones.flatMap((zone) =>
    zone.units.map((unit) => ({ unit, zoneName: zone.name })),
  )

  if (unitsWithZone.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        No units available in this Space.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">
              Unit
            </th>
            <th scope="col" className="px-4 py-3">
              Zone / Type
            </th>
            <th scope="col" className="px-4 py-3">
              State
            </th>
            <th scope="col" className="px-4 py-3">
              Freshness
            </th>
            <th scope="col" className="px-4 py-3">
              Set Occupancy
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">
          {unitsWithZone.map(({ unit, zoneName }) => {
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
              unit.unitType === 'room' &&
              unit.capacity !== null &&
              unit.capacity !== undefined
            const displayLabel = isRoomWithCapacity
              ? `${unit.label} (${unit.capacity})`
              : unit.label

            const TypeIcon = typeInfo.icon
            const StateIcon = stateInfo.icon

            return (
              <tr key={unit.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-semibold">{displayLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground">
                      {zoneName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <TypeIcon className="size-3" aria-hidden="true" />
                      {typeInfo.label}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
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
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                  <RelativeTime date={unit.hostUpdatedAt} />
                </td>
                <td className="px-4 py-3">
                  <div
                    className="flex flex-wrap gap-1.5"
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
                          disabled={isPending}
                          className={cn(
                            'h-12 min-w-12 px-3 py-2 text-xs font-medium transition-all',
                            isActive && 'ring-2 ring-primary ring-offset-2',
                          )}
                          onClick={() => {
                            if (
                              tapOutcome(unit.reservationId, unit.seatState, state) ===
                              'no_op'
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
