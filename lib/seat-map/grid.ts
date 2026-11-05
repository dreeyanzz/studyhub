/**
 * Pure geometry and layout helpers for the 6-column snap-grid seat map builder (D-062).
 *
 * All coordinates count from 0 in code and the database, and display from 1 in user-facing text (SRS §3.2.2).
 * Collision detection accurately mirrors PostgreSQL exclusion constraint logic on public.units.
 */

export const MAX_GRID_ROWS = 50
export const GRID_COLS = 6
export const MIN_CELL_WIDTH = 48

export type UnitType = 'seat' | 'standing_desk' | 'room'
export type SeatState = 'available' | 'pending_payment' | 'reserved' | 'occupied'

export type SeatMapZone = {
  id: string
  name: string
  units: SeatMapUnit[]
  position?: number
}

export type SeatMapUnit = {
  id: string
  unitType: UnitType
  label: string
  capacity: number | null
  row: number // counted from 0, like the database
  col: number
  colSpan: number
  seatState: SeatState
  hostUpdatedAt: string
  waitWindowEndsAt: string | null // the Space's Host only; null until STORY-10
  reservationId: string | null // the Space's Host only; null until STORY-09 (D-057)
}

export interface UnitGridPosition {
  id?: string
  zoneId?: string
  zone_id?: string
  row?: number
  grid_row?: number
  col?: number
  grid_col?: number
  colSpan?: number
  col_span?: number
}

/**
 * Checks whether two unit placements overlap on the grid.
 *
 * Matches PostgreSQL exclusion constraint:
 *   exclude using gist (
 *     zone_id with =,
 *     grid_row with =,
 *     int4range(grid_col, grid_col + col_span) with &&
 *   )
 */
export function unitsOverlap(a: UnitGridPosition, b: UnitGridPosition): boolean {
  const zoneA = a.zoneId ?? a.zone_id
  const zoneB = b.zoneId ?? b.zone_id
  if (zoneA !== undefined && zoneB !== undefined && zoneA !== zoneB) {
    return false
  }

  const rowA = a.row ?? a.grid_row
  const rowB = b.row ?? b.grid_row
  if (
    typeof rowA !== 'number' ||
    typeof rowB !== 'number' ||
    !Number.isFinite(rowA) ||
    !Number.isFinite(rowB) ||
    rowA !== rowB
  ) {
    return false
  }

  const colA = a.col ?? a.grid_col
  const colB = b.col ?? b.grid_col
  if (
    typeof colA !== 'number' ||
    typeof colB !== 'number' ||
    !Number.isFinite(colA) ||
    !Number.isFinite(colB)
  ) {
    return false
  }

  const spanA = a.colSpan ?? a.col_span ?? 1
  const spanB = b.colSpan ?? b.col_span ?? 1
  if (
    typeof spanA !== 'number' ||
    typeof spanB !== 'number' ||
    !Number.isFinite(spanA) ||
    !Number.isFinite(spanB) ||
    spanA <= 0 ||
    spanB <= 0
  ) {
    return false
  }

  // Intervals [colA, colA + spanA) and [colB, colB + spanB) intersect iff
  // colA < colB + spanB and colB < colA + spanA
  return colA < colB + spanB && colB < colA + spanA
}

/**
 * Checks whether a candidate unit placement collides with any existing units in a zone.
 * Skips comparison if unit.id matches existing.id (the unit itself being moved or edited)
 * or if the candidate and existing share object identity.
 */
export function hasCollision(
  unit: UnitGridPosition,
  existingUnits?: Iterable<UnitGridPosition> | null,
): boolean {
  if (!existingUnits) {
    return false
  }
  for (const existing of existingUnits) {
    if (!existing) continue
    if (unit === existing) continue
    if (unit.id && existing.id && unit.id === existing.id) {
      continue
    }
    if (unitsOverlap(unit, existing)) {
      return true
    }
  }
  return false
}

/**
 * Finds the next available cell in the 6-column grid in row-major order.
 * Returns { row, col } (0-indexed) or null if no valid position exists within 50 rows.
 */
export function findFirstAvailableCell(
  units?: Iterable<UnitGridPosition> | null,
  colSpan: number = 1,
  zoneId?: string,
): { row: number; col: number } | null {
  if (!Number.isInteger(colSpan) || colSpan < 1 || colSpan > GRID_COLS) {
    return null
  }

  const unitList = units ? Array.from(units) : []
  const zoneUnits = unitList.filter((u) => {
    if (!u) return false
    const uZone = u.zoneId ?? u.zone_id
    if (zoneId !== undefined && uZone !== undefined) {
      return uZone === zoneId
    }
    return true
  })

  for (let row = 0; row < MAX_GRID_ROWS; row++) {
    for (let col = 0; col <= GRID_COLS - colSpan; col++) {
      const candidate: UnitGridPosition = {
        row,
        col,
        colSpan,
        ...(zoneId !== undefined ? { zoneId } : {}),
      }
      if (!hasCollision(candidate, zoneUnits)) {
        return { row, col }
      }
    }
  }

  return null
}

function roomIndexToLetters(index: number): string {
  let result = ''
  let n = index
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/**
 * Calculates the next suggested free label for a new unit (e.g. S1..Sn, D1..Dn, Room A..Z).
 * Matches labels case-insensitively against existing labels in the Space.
 * Accepts either an iterable of label strings or an iterable of objects containing a label property.
 */
export function nextSuggestedLabel(
  existingLabelsOrUnits?: Iterable<string | { label?: string }> | null,
  unitType: UnitType | string = 'seat',
): string {
  const taken = new Set<string>()
  if (existingLabelsOrUnits) {
    for (const item of existingLabelsOrUnits) {
      if (typeof item === 'string') {
        taken.add(item.trim().toLowerCase())
      } else if (item && typeof item === 'object' && typeof item.label === 'string') {
        taken.add(item.label.trim().toLowerCase())
      }
    }
  }

  const normalizedType =
    typeof unitType === 'string' ? unitType.trim().toLowerCase() : 'seat'

  if (normalizedType === 'seat') {
    let n = 1
    while (taken.has(`s${n}`)) {
      n++
    }
    return `S${n}`
  }

  if (
    normalizedType === 'standing_desk' ||
    normalizedType === 'standingdesk' ||
    normalizedType === 'desk'
  ) {
    let n = 1
    while (taken.has(`d${n}`)) {
      n++
    }
    return `D${n}`
  }

  if (normalizedType === 'room') {
    let n = 1
    while (taken.has(`room ${roomIndexToLetters(n).toLowerCase()}`)) {
      n++
    }
    return `Room ${roomIndexToLetters(n)}`
  }

  let n = 1
  while (taken.has(`u${n}`)) {
    n++
  }
  return `U${n}`
}

/**
 * Counts the minimum rows needed to draw the zone (at least 1 row, or highest unit row + 1).
 */
export function getZoneRowCount(
  units?: Iterable<{ row?: number; grid_row?: number }> | null,
): number {
  if (!units) return 1
  let maxRow = -1
  for (const u of units) {
    if (!u) continue
    const r = u.row ?? u.grid_row
    if (typeof r === 'number' && Number.isFinite(r) && r > maxRow) {
      maxRow = r
    }
  }
  return Math.max(1, maxRow + 1)
}

/**
 * Accessible cell description in words ("Row 1, Column 1", "Row 1, Columns 1 to 3"),
 * counted from 1 per design doc §3.
 */
export function describeCell(row: number, col: number, colSpan: number = 1): string {
  const rowNum = row + 1
  const colStart = col + 1
  const span = Math.max(1, Math.floor(colSpan || 1))
  if (span > 1) {
    const colEnd = colStart + span - 1
    return `Row ${rowNum}, Columns ${colStart} to ${colEnd}`
  }
  return `Row ${rowNum}, Column ${colStart}`
}

/**
 * Formats the accessible action name for an empty cell button (e.g. "Place at row 2, column 3 in Quiet desks").
 */
export function describePlaceAction(row: number, col: number, zoneName?: string): string {
  const cell = `row ${row + 1}, column ${col + 1}`
  return zoneName ? `Place at ${cell} in ${zoneName}` : `Place at ${cell}`
}
