'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, Clock, LayoutGrid, List } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeatMapGrid } from '@/components/seat-map/seat-map-grid'
import { SeatMapTile } from '@/components/seat-map/seat-map-tile'
import {
  FreshnessBadge,
  formatFreshnessLabel,
  useFreshnessNow,
} from '@/components/space/freshness-badge'
import type { SeatMapUnit, SeatMapZone, SeatState, UnitType } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'
import { SpaceUnitList } from './space-unit-list'

const DISCOVERY_HREF = '/spaces'

const TYPE_LABELS: Record<UnitType, string> = {
  seat: 'Seat',
  standing_desk: 'Standing Desk',
  room: 'Room',
}

const STATE_LABELS: Record<SeatState, string> = {
  available: 'Available',
  pending_payment: 'Pending Payment',
  reserved: 'Reserved',
  occupied: 'Occupied',
}

export interface SpaceSeatMapViewProps {
  zones: SeatMapZone[]
  isOpen: boolean
  initialView?: 'grid' | 'list'
  initialSelectedUnitId?: string | null
  /**
   * Slot for STORY-09 hold actions. Suppressed when Space is closed.
   */
  renderSelectedUnitAction?: (unit: SeatMapUnit) => ReactNode
  /**
   * Server-rendered slot alternative for STORY-09 when ?unit=<id> is loaded.
   */
  selectedUnitActionSlot?: ReactNode
}

/**
 * Seat Map & Accessible List View with Unit Selection (STORY-11 design §3 Screen 1, TSK-11.5).
 *
 * Implements:
 * - URL parameter view switcher (`?view=grid` vs `?view=list`) working before JS loads (SRS §3.2.2).
 * - Shared SeatMapGrid embedding directly without extra card padding (D-062).
 * - Per-unit freshness in list view and tile accessible names.
 * - Unit selection with `renderSelectedUnitAction` slot for STORY-09 hold flow.
 * - Suppressed hold slot when Space is closed (seeker-space-closed).
 */
export function SpaceSeatMapView({
  zones,
  isOpen,
  initialView = 'grid',
  initialSelectedUnitId,
  renderSelectedUnitAction,
  selectedUnitActionSlot,
}: SpaceSeatMapViewProps) {
  const now = useFreshnessNow()
  const view = initialView

  // Resolve selected unit from server-synced URL prop so selectedUnitActionSlot
  // always matches the current ?unit=<id> (STORY-09 design §8).
  const allUnits = zones.flatMap((z) => z.units)
  const selectedUnit = allUnits.find((u) => u.id === initialSelectedUnitId) ?? null
  const selectedZone = selectedUnit
    ? zones.find((z) => z.units.some((u) => u.id === selectedUnit.id))
    : null
  const selectedUnitId = selectedUnit?.id ?? null

  const gridHref = selectedUnit
    ? `?view=grid&unit=${encodeURIComponent(selectedUnit.id)}`
    : '?view=grid'
  const listHref = selectedUnit
    ? `?view=list&unit=${encodeURIComponent(selectedUnit.id)}`
    : '?view=list'

  return (
    <div className="min-w-0 space-y-6" data-testid="space-seat-map-view">
      {/* View Switcher: Seat map vs Accessible list */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight wrap-anywhere text-foreground">
          Seat Selection
        </h2>

        <div
          role="group"
          aria-label="View switcher"
          className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/50 p-1"
        >
          <Link
            href={gridHref}
            scroll={false}
            aria-current={view === 'grid' ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-12 min-w-12 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:text-sm',
              view === 'grid'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            <span>Seat map</span>
          </Link>

          <Link
            href={listHref}
            scroll={false}
            aria-current={view === 'list' ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-12 min-w-12 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:text-sm',
              view === 'list'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="size-4" aria-hidden="true" />
            <span>Accessible list</span>
          </Link>
        </div>
      </div>

      {/* Main View Area */}
      {view === 'grid' ? (
        <div className="w-full overflow-x-auto px-1 pt-1 pb-2">
          {/* Direct embedding without extra card padding to fit 328px at 360px viewport (D-062) */}
          <SeatMapGrid
            zones={zones}
            renderUnit={(unit) => {
              const isSelected = unit.id === selectedUnitId
              const typeLabel = TYPE_LABELS[unit.unitType] ?? unit.unitType
              const stateLabel = STATE_LABELS[unit.seatState] ?? unit.seatState
              const freshnessLabel = formatFreshnessLabel(unit.hostUpdatedAt, now)
              const tileAria = `${unit.label}, ${typeLabel}, ${stateLabel}, ${freshnessLabel}`

              return (
                <Link
                  href={`?view=grid&unit=${encodeURIComponent(unit.id)}`}
                  scroll={false}
                  aria-label={tileAria}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'group relative flex h-full min-h-12 w-full min-w-[48px] items-stretch rounded-md p-0 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                    isSelected && 'ring-2 ring-primary ring-offset-2',
                  )}
                >
                  <SeatMapTile
                    unit={unit}
                    className={cn(
                      'pointer-events-none transition-shadow',
                      isSelected ? 'shadow-md' : 'group-hover:shadow-xs',
                    )}
                  />
                </Link>
              )
            }}
          />
        </div>
      ) : (
        <SpaceUnitList zones={zones} selectedUnitId={selectedUnitId} />
      )}

      {/* Selected Unit Panel */}
      {selectedUnit && (
        <Card
          data-testid="selected-unit-panel"
          className="rounded-xl border-primary/30 bg-card shadow-sm"
        >
          <CardHeader className="pb-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <CardTitle className="min-w-0 text-base font-semibold wrap-anywhere text-foreground">
                Selected Unit: {selectedUnit.label}
              </CardTitle>
              <span className="min-w-0 text-xs wrap-anywhere text-muted-foreground">
                {selectedZone?.name ?? 'Zone'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 sm:text-sm">
              <div className="min-w-0">
                <span className="block text-[11px] tracking-wider text-muted-foreground uppercase">
                  Type
                </span>
                <span className="font-medium wrap-anywhere text-foreground">
                  {TYPE_LABELS[selectedUnit.unitType] ?? selectedUnit.unitType}
                </span>
              </div>

              <div className="min-w-0">
                <span className="block text-[11px] tracking-wider text-muted-foreground uppercase">
                  Capacity
                </span>
                <span className="font-medium wrap-anywhere text-foreground">
                  {selectedUnit.capacity ?? 1}{' '}
                  {(selectedUnit.capacity ?? 1) === 1 ? 'person' : 'people'}
                </span>
              </div>

              <div className="min-w-0">
                <span className="block text-[11px] tracking-wider text-muted-foreground uppercase">
                  Status
                </span>
                <span className="font-medium wrap-anywhere text-foreground">
                  {STATE_LABELS[selectedUnit.seatState] ?? selectedUnit.seatState}
                </span>
              </div>

              <div className="min-w-0">
                <span className="block text-[11px] tracking-wider text-muted-foreground uppercase">
                  Freshness
                </span>
                <FreshnessBadge
                  date={selectedUnit.hostUpdatedAt}
                  className="font-medium wrap-anywhere text-foreground"
                />
              </div>
            </div>

            {/* Actions & Status Notices */}
            {!isOpen ? (
              <Alert
                data-testid="selected-unit-space-closed"
                variant="default"
                className="border-muted-foreground/20 bg-muted/30"
              >
                <Clock className="size-4 shrink-0" aria-hidden="true" />
                <AlertTitle>This Space is closed now</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    You can review seats and amenities; reservations open during operating
                    hours.
                  </p>
                  <div>
                    <Link
                      href={DISCOVERY_HREF}
                      className="inline-flex min-h-12 items-center rounded-xs font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      Explore other spaces
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            ) : selectedUnit.seatState === 'available' ? (
              <div data-testid="selected-unit-hold-action" className="pt-2">
                {renderSelectedUnitAction
                  ? renderSelectedUnitAction(selectedUnit)
                  : ((selectedUnit.id === initialSelectedUnitId
                      ? selectedUnitActionSlot
                      : undefined) ?? (
                      <p className="text-xs text-muted-foreground">
                        Ready for reservation hold.
                      </p>
                    ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertCircle
                  className="size-4 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <span className="min-w-0 wrap-anywhere">
                  This unit is currently{' '}
                  <strong className="font-semibold">
                    {STATE_LABELS[selectedUnit.seatState] ?? selectedUnit.seatState}
                  </strong>
                  . It is not available to hold right now.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
