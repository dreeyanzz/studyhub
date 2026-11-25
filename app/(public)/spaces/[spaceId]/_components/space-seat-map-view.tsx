'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, Armchair, Clock, LayoutGrid, List } from 'lucide-react'

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

const STATE_DOT_CLASS: Record<SeatState, string> = {
  available: 'bg-emerald-600',
  pending_payment: 'bg-purple-600',
  reserved: 'bg-blue-600',
  occupied: 'bg-amber-600',
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
    <section
      aria-labelledby="seat-selection-heading"
      className="min-w-0 space-y-5 rounded-3xl sm:border sm:border-primary/20 sm:bg-card/90 sm:p-6 sm:shadow-[0_12px_36px_-18px_rgba(23,60,45,0.14)] lg:p-7"
      data-testid="space-seat-map-view"
    >
      {/* Distinct Booking & Seat Selection header: Eyebrow + Title + Solid pill view switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div className="min-w-0 space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#f0c95c] ring-2 ring-primary/20"
            />
            <span>Reserve a Seat</span>
          </p>
          <h2
            id="seat-selection-heading"
            className="min-w-0 font-heading text-lg font-semibold tracking-tight wrap-anywhere text-foreground"
          >
            Seat Selection
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick an open seat, desk, or room on the map to review details and book it now.
          </p>
        </div>

        <div
          role="group"
          aria-label="View switcher"
          className="inline-flex max-w-full flex-wrap rounded-full bg-secondary/80 p-1"
        >
          <Link
            href={gridHref}
            scroll={false}
            aria-current={view === 'grid' ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:text-sm',
              view === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'text-secondary-foreground hover:bg-card/70',
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
              'inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:text-sm',
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-secondary-foreground hover:bg-card/70',
            )}
          >
            <List className="size-4" aria-hidden="true" />
            <span>Accessible list</span>
          </Link>
        </div>
      </div>

      {/* Main Split Area: Seat map / list alongside the sticky Selected Unit panel from md up */}
      <div
        className={cn(
          'grid grid-cols-1 items-start gap-6',
          allUnits.length > 0 && 'md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
        )}
      >
        <div className="min-w-0">
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
        </div>

        {/* Selected Unit Panel (reservation ticket card side-by-side from md up) */}
        {allUnits.length > 0 && (
          <div className="min-w-0 md:sticky md:top-6">
            {selectedUnit ? (
              <Card
                data-testid="selected-unit-panel"
                className="gap-0 rounded-3xl border border-primary/20 bg-card py-0 shadow-[0_14px_34px_-12px_rgba(23,60,45,0.14)] ring-0"
              >
                <CardHeader className="rounded-t-[calc(1.5rem-1px)] bg-primary px-6 py-5 text-primary-foreground">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <CardTitle className="min-w-0 font-heading text-base font-semibold wrap-anywhere text-primary-foreground">
                      Selected Unit: {selectedUnit.label}
                    </CardTitle>
                    <span className="min-w-0 rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-xs font-semibold wrap-anywhere text-primary-foreground backdrop-blur-xs">
                      {selectedZone?.name ?? 'Zone'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-2.5 text-xs sm:text-sm">
                    <div className="min-w-0 rounded-2xl bg-muted/65 p-3.5">
                      <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Type
                      </span>
                      <span className="mt-0.5 block font-medium wrap-anywhere text-foreground">
                        {TYPE_LABELS[selectedUnit.unitType] ?? selectedUnit.unitType}
                      </span>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-muted/65 p-3.5">
                      <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Capacity
                      </span>
                      <span className="mt-0.5 block font-medium wrap-anywhere text-foreground">
                        {selectedUnit.capacity ?? 1}{' '}
                        {(selectedUnit.capacity ?? 1) === 1 ? 'person' : 'people'}
                      </span>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-muted/65 p-3.5">
                      <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Status
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-medium wrap-anywhere text-foreground">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            STATE_DOT_CLASS[selectedUnit.seatState] ??
                              'bg-muted-foreground',
                          )}
                        />
                        <span>
                          {STATE_LABELS[selectedUnit.seatState] ?? selectedUnit.seatState}
                        </span>
                      </span>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-muted/65 p-3.5">
                      <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Freshness
                      </span>
                      <FreshnessBadge
                        date={selectedUnit.hostUpdatedAt}
                        className="mt-0.5 block font-medium wrap-anywhere text-foreground"
                      />
                    </div>
                  </div>

                  {/* Actions & Status Notices */}
                  {!isOpen ? (
                    <Alert
                      data-testid="selected-unit-space-closed"
                      variant="default"
                      className="rounded-2xl border-0 bg-muted/70"
                    >
                      <Clock
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <AlertTitle>This Space is closed now</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          You can review seats and amenities; reservations open during
                          operating hours.
                        </p>
                        <div>
                          <Link
                            href={DISCOVERY_HREF}
                            className="inline-flex min-h-12 items-center rounded-xs font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                          >
                            Explore other spaces
                          </Link>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : selectedUnit.seatState === 'available' ? (
                    <div
                      data-testid="selected-unit-hold-action"
                      className="border-t border-dashed border-border pt-5"
                    >
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
                    <div className="flex items-center gap-2.5 rounded-2xl border border-amber-600/25 bg-amber-50 p-4 text-xs text-amber-900">
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
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/25 bg-secondary/35 p-8 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-card text-primary shadow-2xs">
                  <Armchair className="size-6" aria-hidden="true" />
                </div>
                <p className="font-heading text-base font-semibold text-foreground">
                  Choose a unit on the map
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Select any seat, desk, or room to view its details and reservation
                  options.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
