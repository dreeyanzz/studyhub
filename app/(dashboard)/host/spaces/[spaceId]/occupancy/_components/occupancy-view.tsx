'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, LayoutGrid, List, RefreshCw } from 'lucide-react'

import { SeatMapGrid } from '@/components/seat-map/seat-map-grid'
import { SeatMapTile } from '@/components/seat-map/seat-map-tile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { tapOutcome, toSetUnitStateInput } from '@/lib/occupancy/override'
import type { SeatMapUnit, SeatMapZone } from '@/lib/seat-map/grid'
import type { ExpectedReservationStatus, UnitState } from '@/lib/validation/occupancy'
import { cn } from '@/lib/utils'

import { setUnitStateAction } from '../actions'
import { OccupancyList } from './occupancy-list'
import { OverrideWarningDialog } from './override-warning-dialog'
import { UnitControlCard } from './unit-control-card'

export interface OccupancyViewProps {
  space: {
    id: string
    name: string
  }
  initialZones: SeatMapZone[]
}

const AUTO_REFRESH_MS = 30_000
const MIN_FOCUS_REFRESH_GAP_MS = 5_000

/**
 * Client Component state holder for view toggle (STORY-12 design §3, D-031).
 *
 * Toggles between spatial Seat Map View and accessible List View.
 * Manages unit selection and dispatches occupancy state updates via setUnitStateAction.
 * Also refreshes on tab focus and every 30s while visible so new Seeker holds appear
 * at the front desk without a manual reload (STORY-17).
 */
export function OccupancyView({ space, initialZones }: OccupancyViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, startRefreshTransition] = useTransition()
  const lastRefreshRef = useRef(0)
  const [viewMode, setViewMode] = useState<'seat_map' | 'list'>('seat_map')
  const [error, setError] = useState<string | null>(null)
  const [canRefresh, setCanRefresh] = useState(false)
  const [pendingOverride, setPendingOverride] = useState<{
    unit: SeatMapUnit
    targetState: UnitState
  } | null>(null)

  useEffect(() => {
    const triggerRefresh = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshRef.current < MIN_FOCUS_REFRESH_GAP_MS) return
      lastRefreshRef.current = now
      startRefreshTransition(() => {
        router.refresh()
      })
    }

    window.addEventListener('focus', triggerRefresh)
    document.addEventListener('visibilitychange', triggerRefresh)
    const timer = setInterval(triggerRefresh, AUTO_REFRESH_MS)

    return () => {
      window.removeEventListener('focus', triggerRefresh)
      document.removeEventListener('visibilitychange', triggerRefresh)
      clearInterval(timer)
    }
  }, [router])

  const allUnits = initialZones.flatMap((z) => z.units)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    allUnits[0]?.id ?? null,
  )

  const selectedUnit =
    allUnits.find((u) => u.id === selectedUnitId) ?? allUnits[0] ?? null

  const executeStateUpdate = (
    unit: SeatMapUnit,
    targetState: UnitState,
    isOverride?: boolean,
  ) => {
    startTransition(async () => {
      try {
        const payload = toSetUnitStateInput(unit, targetState, {
          override: isOverride,
        })
        const result = await setUnitStateAction(space.id, payload)

        if (!result.success) {
          setError(result.error)
          setCanRefresh(result.canRefresh)
        } else {
          router.refresh()
        }
      } catch {
        setError('We could not save that change. Check your connection and try again.')
        setCanRefresh(false)
      } finally {
        setPendingOverride(null)
      }
    })
  }

  const handleStateTap = (unit: SeatMapUnit, targetState: UnitState) => {
    const outcome = tapOutcome(unit.reservationId, unit.seatState, targetState)

    // If Seeker hold exists and same state tapped -> no-op (FR-3.2, D-050)
    if (outcome === 'no_op') {
      return
    }

    setError(null)
    setCanRefresh(false)

    // Different state on a Seeker-held unit requires explicit confirmation (TSK-12.6, Moves R5, R9, R11, D-050)
    if (outcome === 'confirm_override') {
      setPendingOverride({ unit, targetState })
      return
    }

    // Direct Host-set state or same-state re-vouch tap (Move H2, D-051)
    executeStateUpdate(unit, targetState)
  }

  if (initialZones.length === 0 || allUnits.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CardContent className="space-y-4 pt-6">
          <p className="text-base text-muted-foreground">
            No units found. Set up your seat map first to manage occupancy.
          </p>
          <div>
            <Link
              href={`/host/spaces/${space.id}/seat-map`}
              className={cn(buttonVariants({ variant: 'default' }), 'h-12 min-w-12 px-6')}
            >
              Set up seat map
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="View mode toggle"
          className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border/75 bg-surface-subtle p-1"
        >
          <Button
            type="button"
            variant={viewMode === 'seat_map' ? 'default' : 'ghost'}
            className="h-12 min-w-12 gap-2 rounded-full px-5 text-sm font-semibold"
            onClick={() => setViewMode('seat_map')}
            aria-pressed={viewMode === 'seat_map'}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            Seat Map View
          </Button>
          <Button
            type="button"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            className="h-12 min-w-12 gap-2 rounded-full px-5 text-sm font-semibold"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
          >
            <List className="size-4" aria-hidden="true" />
            List View
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          aria-busy={isRefreshing}
          className="h-auto min-h-12 max-w-full min-w-12 gap-2 rounded-full border-border/80 bg-card px-5 py-2 text-sm font-medium whitespace-normal shadow-2xs hover:bg-surface-subtle"
          onClick={() => {
            lastRefreshRef.current = Date.now()
            startRefreshTransition(() => {
              router.refresh()
            })
          }}
        >
          <RefreshCw
            className={cn(
              'size-4 shrink-0',
              isRefreshing && 'animate-spin motion-reduce:animate-none',
            )}
            aria-hidden="true"
          />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Refusal / Network Error Alert */}
      {error ? (
        <Alert
          variant="destructive"
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
          </div>
          {canRefresh ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setError(null)
                setCanRefresh(false)
                router.refresh()
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {/* Main View Area */}
      {viewMode === 'seat_map' ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            <SeatMapGrid
              zones={initialZones}
              renderUnit={(unit) => {
                const isSelected = selectedUnit?.id === unit.id
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={cn(
                      'relative flex h-full w-full items-stretch rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected && 'ring-2 ring-primary ring-offset-2',
                    )}
                    aria-label={`Select ${unit.label} (${unit.seatState.replace('_', ' ')}) to manage occupancy`}
                    aria-pressed={isSelected}
                  >
                    <SeatMapTile unit={unit} className="h-full w-full" />
                  </button>
                )
              }}
            />
          </div>

          <aside
            aria-label="Selected unit control"
            className="space-y-3 lg:sticky lg:top-4"
          >
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Selected Unit Control
            </h2>
            {selectedUnit ? (
              <UnitControlCard
                unit={selectedUnit}
                isPending={isPending}
                onStateTap={handleStateTap}
              />
            ) : (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Select a unit on the seat map to view details and set its occupancy.
              </Card>
            )}
          </aside>
        </div>
      ) : (
        <OccupancyList
          zones={initialZones}
          isPending={isPending}
          onStateTap={handleStateTap}
        />
      )}

      {pendingOverride ? (
        <OverrideWarningDialog
          open={true}
          onOpenChange={(open) => {
            if (!open && !isPending) {
              setPendingOverride(null)
            }
          }}
          unitLabel={pendingOverride.unit.label}
          currentStatus={pendingOverride.unit.seatState as ExpectedReservationStatus}
          targetState={pendingOverride.targetState}
          isSubmitting={isPending}
          onConfirm={() => {
            executeStateUpdate(pendingOverride.unit, pendingOverride.targetState, true)
          }}
        />
      ) : null}
    </div>
  )
}
