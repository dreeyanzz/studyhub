import type { ReactNode } from 'react'
import { SeatMapLegend } from '@/components/seat-map/seat-map-legend'
import { SeatMapTile } from '@/components/seat-map/seat-map-tile'
import {
  GRID_COLS,
  MAX_GRID_ROWS,
  getZoneRowCount,
  type SeatMapUnit,
  type SeatMapZone,
} from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

/**
 * Shared snap-grid seat map renderer (STORY-07, TSK-07.4, FR-3.1, D-062).
 *
 * Renders a unified 6-column snap-grid layout up to 576 px (max-w-xl) with the legend
 * above the zones. Each zone renders its name heading and a 6-column grid of cells (min 48x48 px).
 *
 * Designed to be rendered in both Server and Client Components (no 'use client').
 * Callers customize unit display via `renderUnit` (e.g. wrapping with click/focus handlers)
 * and empty cell display via `renderEmptyCell` (e.g. builder placement buttons).
 */
export function SeatMapGrid({
  zones,
  renderUnit,
  renderEmptyCell,
  className,
}: {
  zones: SeatMapZone[]
  renderUnit?: (unit: SeatMapUnit) => ReactNode
  renderEmptyCell?: (cell: { zoneId: string; row: number; col: number }) => ReactNode
  className?: string
}): ReactNode {
  return (
    <div className={cn('w-full max-w-xl space-y-6', className)}>
      <SeatMapLegend />

      {zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No zones in this seat map.</p>
      ) : (
        zones.map((zone) => {
          const rowCount = Math.min(MAX_GRID_ROWS, getZoneRowCount(zone.units))
          const unitsByStart = new Map<string, SeatMapUnit>()
          const coveredCells = new Set<string>()

          for (const unit of zone.units) {
            if (
              unit.row < 0 ||
              unit.row >= MAX_GRID_ROWS ||
              unit.col < 0 ||
              unit.col >= GRID_COLS ||
              !Number.isFinite(unit.row) ||
              !Number.isFinite(unit.col)
            ) {
              continue
            }
            const span = Math.max(1, Math.min(unit.colSpan || 1, GRID_COLS - unit.col))

            // Defensive collision guard: skip if any cell in the span is already covered
            let collides = false
            for (let c = unit.col; c < unit.col + span; c++) {
              if (coveredCells.has(`${unit.row},${c}`)) {
                collides = true
                break
              }
            }
            if (collides) {
              continue
            }

            unitsByStart.set(`${unit.row},${unit.col}`, unit)
            for (let c = unit.col; c < unit.col + span; c++) {
              coveredCells.add(`${unit.row},${c}`)
            }
          }

          const gridCells: ReactNode[] = []

          for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              const cellKey = `${r},${c}`

              if (unitsByStart.has(cellKey)) {
                const unit = unitsByStart.get(cellKey)!
                const span = Math.max(
                  1,
                  Math.min(unit.colSpan || 1, GRID_COLS - unit.col),
                )

                gridCells.push(
                  <div
                    key={unit.id}
                    style={{
                      gridColumn: `${unit.col + 1} / span ${span}`,
                      gridRow: `${unit.row + 1}`,
                    }}
                    className="flex min-h-12 min-w-12 items-stretch"
                  >
                    {renderUnit ? renderUnit(unit) : <SeatMapTile unit={unit} />}
                  </div>,
                )
              } else if (coveredCells.has(cellKey)) {
                // Cell occupied by a multi-column unit originating earlier in the row
                continue
              } else {
                // Empty cell
                const emptyContent = renderEmptyCell
                  ? renderEmptyCell({ zoneId: zone.id, row: r, col: c })
                  : null

                gridCells.push(
                  <div
                    key={`empty-${zone.id}-${r}-${c}`}
                    style={{
                      gridColumn: `${c + 1} / span 1`,
                      gridRow: `${r + 1}`,
                    }}
                    className="flex min-h-12 min-w-12 items-stretch"
                    aria-hidden={emptyContent ? undefined : true}
                  >
                    {emptyContent}
                  </div>,
                )
              }
            }
          }

          return (
            <section
              key={zone.id}
              aria-labelledby={`zone-heading-${zone.id}`}
              className="space-y-2"
            >
              <h3
                id={`zone-heading-${zone.id}`}
                className="text-base font-semibold tracking-tight text-foreground"
              >
                {zone.name}
              </h3>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: 'repeat(6, minmax(48px, 1fr))',
                }}
                role="region"
                aria-label={`${zone.name} seat grid`}
              >
                {gridCells}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
