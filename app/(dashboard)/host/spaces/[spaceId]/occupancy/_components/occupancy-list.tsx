'use client'

import { Armchair, CheckCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { tapOutcome } from '@/lib/occupancy/override'
import type { SeatMapUnit, SeatMapZone } from '@/lib/seat-map/grid'
import type { UnitState } from '@/lib/validation/occupancy'
import { cn } from '@/lib/utils'

import { RelativeTime } from './relative-time'
import { ACTIONS, STATE_BADGES, TYPE_CONFIG } from './unit-control-card'

export interface OccupancyListProps {
  zones: SeatMapZone[]
  isPending?: boolean
  onStateTap: (unit: SeatMapUnit, targetState: UnitState) => void | Promise<void>
}

type PillsProps = Pick<OccupancyListProps, 'isPending' | 'onStateTap'> & {
  unit: SeatMapUnit
}

/** The three one-tap state pills for a unit (design §3, D-031, D-050, D-051). */
function OccupancyPills({ unit, isPending = false, onStateTap }: PillsProps) {
  return (
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
            // Stays focusable while saving, so focus isn't lost (D-031).
            disabled={isPending}
            focusableWhenDisabled
            className={cn(
              'h-12 min-w-12 px-3 py-2 text-xs font-medium transition-all',
              isActive && 'ring-2 ring-primary ring-offset-2',
            )}
            onClick={() => {
              if (tapOutcome(unit.reservationId, unit.seatState, state) === 'no_op') {
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
  )
}

/** The seat state in words, and "Seeker hold" when a Seeker holds the unit (D-057). */
function StateBadges({ unit }: { unit: SeatMapUnit }) {
  const stateInfo = STATE_BADGES[unit.seatState] ?? {
    label: unit.seatState,
    icon: CheckCircle,
    className: 'border-border bg-card text-foreground',
  }
  const StateIcon = stateInfo.icon

  return (
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
        <Badge variant="secondary" className="border-primary/20 text-xs font-medium">
          Seeker hold
        </Badge>
      ) : null}
    </div>
  )
}

/**
 * Accessible list view of all units across zones (STORY-12 design §3, D-031).
 *
 * A keyboard-navigable alternative to the spatial grid. Where the table fits, it is the
 * design's table. Where it doesn't, each unit is a card in a list instead, so the list
 * never scrolls sideways at 360 px or at 200% text (design §3, Accessibility: Responsive
 * design). The switch is a container query in rem (`@2xl`, 42rem), so it follows the
 * text size as well as the width: at 100% text the table shows from about 672 px, and at
 * 200% from about 1344 px. Only one layout is displayed at a time, and the hidden one
 * (`display: none`) is out of the accessibility tree.
 */
export function OccupancyList({
  zones,
  isPending = false,
  onStateTap,
}: OccupancyListProps) {
  const rows = zones.flatMap((zone) =>
    zone.units.map((unit) => {
      const typeInfo = TYPE_CONFIG[unit.unitType] ?? {
        label: unit.unitType,
        icon: Armchair,
      }
      const isRoomWithCapacity =
        unit.unitType === 'room' && unit.capacity !== null && unit.capacity !== undefined
      return {
        unit,
        zoneName: zone.name,
        typeInfo,
        displayLabel: isRoomWithCapacity
          ? `${unit.label} (${unit.capacity})`
          : unit.label,
      }
    }),
  )

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        No units available in this Space.
      </div>
    )
  }

  return (
    <div className="@container">
      {/* Too narrow for the table: one card per unit */}
      <ul aria-label="Units" className="m-0 list-none space-y-3 p-0 @2xl:hidden">
        {rows.map(({ unit, zoneName, typeInfo, displayLabel }) => {
          const TypeIcon = typeInfo.icon
          return (
            <li
              key={unit.id}
              className="space-y-3 rounded-lg border border-border bg-card p-4 text-foreground"
            >
              <div>
                <h2 className="text-base font-semibold wrap-anywhere">{displayLabel}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{zoneName}</span>
                  <span className="inline-flex items-center gap-1">
                    <TypeIcon className="size-3" aria-hidden="true" />
                    {typeInfo.label}
                  </span>
                </p>
              </div>
              <StateBadges unit={unit} />
              <p className="text-xs text-muted-foreground">
                Host-updated · <RelativeTime date={unit.hostUpdatedAt} />
              </p>
              <OccupancyPills unit={unit} isPending={isPending} onStateTap={onStateTap} />
            </li>
          )
        })}
      </ul>

      {/* Wide enough: the table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card @2xl:block">
        <table className="w-full text-left text-sm">
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
            {rows.map(({ unit, zoneName, typeInfo, displayLabel }) => {
              const TypeIcon = typeInfo.icon
              return (
                <tr key={unit.id} className="hover:bg-muted/20">
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-semibold wrap-anywhere"
                  >
                    {displayLabel}
                  </th>
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
                    <StateBadges unit={unit} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <RelativeTime date={unit.hostUpdatedAt} />
                  </td>
                  <td className="px-4 py-3">
                    <OccupancyPills
                      unit={unit}
                      isPending={isPending}
                      onStateTap={onStateTap}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
