'use client'

import Link from 'next/link'
import {
  Armchair,
  CheckCircle,
  Clock,
  DoorClosed,
  Hourglass,
  PersonStanding,
  User,
} from 'lucide-react'

import { FreshnessBadge } from '@/components/space/freshness-badge'
import type { SeatMapUnit, SeatMapZone, SeatState, UnitType } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

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

const STATE_CONFIG: Record<
  SeatState,
  {
    label: string
    icon: typeof CheckCircle
    badgeClassName: string
  }
> = {
  available: {
    label: 'Available',
    icon: CheckCircle,
    badgeClassName: 'border-emerald-600/40 bg-emerald-50 text-emerald-900',
  },
  pending_payment: {
    label: 'Pending Payment',
    icon: Hourglass,
    badgeClassName: 'border-purple-600/40 bg-purple-50 text-purple-900',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    badgeClassName: 'border-blue-600/40 bg-blue-50 text-blue-900',
  },
  occupied: {
    label: 'Occupied',
    icon: User,
    badgeClassName: 'border-amber-600/40 bg-amber-50 text-amber-900',
  },
}

export interface SpaceUnitListProps {
  zones: SeatMapZone[]
  selectedUnitId?: string | null
  onSelectUnit?: (unit: SeatMapUnit) => void
}

/**
 * Accessible list view alternative for Seat Map (SRS §3.2.2, STORY-11 TSK-11.5).
 *
 * Grouped by Zone, displaying Label, Type, Capacity, State, individual freshness timestamp,
 * and Select action. Fully operable by keyboard before JavaScript loads via standard links.
 */
export function SpaceUnitList({
  zones,
  selectedUnitId,
  onSelectUnit,
}: SpaceUnitListProps) {
  if (zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No units available in this Space.</p>
    )
  }

  return (
    <div className="space-y-6" data-testid="space-unit-list">
      {zones.map((zone) => (
        <section
          key={zone.id}
          aria-labelledby={`unit-list-zone-${zone.id}`}
          className="space-y-3"
        >
          <h3
            id={`unit-list-zone-${zone.id}`}
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {zone.name}
          </h3>

          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {zone.units.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No units in this zone.</p>
            ) : (
              zone.units.map((unit) => {
                const typeInfo = TYPE_CONFIG[unit.unitType] ?? {
                  label: unit.unitType,
                  icon: Armchair,
                }
                const stateInfo = STATE_CONFIG[unit.seatState] ?? {
                  label: unit.seatState,
                  icon: CheckCircle,
                  badgeClassName: 'border-border bg-muted text-foreground',
                }
                const TypeIcon = typeInfo.icon
                const StateIcon = stateInfo.icon

                const isSelected = selectedUnitId === unit.id

                return (
                  <div
                    key={unit.id}
                    className={cn(
                      'flex flex-col gap-3 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
                      isSelected
                        ? 'bg-primary/5 ring-1 ring-primary ring-inset'
                        : 'hover:bg-muted/30',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                        <TypeIcon className="size-5" aria-hidden="true" />
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-foreground">
                            {unit.label}
                          </span>
                          {unit.unitType === 'room' && unit.capacity && (
                            <span className="text-xs text-muted-foreground">
                              ({unit.capacity} {unit.capacity === 1 ? 'person' : 'people'}
                              )
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {typeInfo.label} · <FreshnessBadge date={unit.hostUpdatedAt} />
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5 self-end sm:self-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          stateInfo.badgeClassName,
                        )}
                      >
                        <StateIcon className="size-3.5" aria-hidden="true" />
                        <span>{stateInfo.label}</span>
                      </span>

                      <Link
                        href={`?view=list&unit=${encodeURIComponent(unit.id)}`}
                        onClick={(e) => {
                          if (onSelectUnit) {
                            e.preventDefault()
                            onSelectUnit(unit)
                          }
                        }}
                        className={cn(
                          'inline-flex min-h-12 min-w-12 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                          isSelected
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-border bg-background text-foreground hover:bg-muted',
                        )}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                        <span className="sr-only"> {unit.label}</span>
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
