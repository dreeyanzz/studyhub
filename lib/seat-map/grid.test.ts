import { describe, expect, it } from 'vitest'
import {
  describeCell,
  describePlaceAction,
  findFirstAvailableCell,
  getZoneRowCount,
  GRID_COLS,
  hasCollision,
  MAX_GRID_ROWS,
  MIN_CELL_WIDTH,
  nextSuggestedLabel,
  unitsOverlap,
  type SeatMapUnit,
  type SeatMapZone,
  type UnitGridPosition,
} from './grid'

describe('grid constants and types', () => {
  it('exports expected grid layout constants', () => {
    expect(MAX_GRID_ROWS).toBe(50)
    expect(GRID_COLS).toBe(6)
    expect(MIN_CELL_WIDTH).toBe(48)
  })

  it('satisfies SeatMapZone and SeatMapUnit type definitions', () => {
    const unit: SeatMapUnit = {
      id: 'unit-1',
      unitType: 'seat',
      label: 'S1',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 1,
      seatState: 'available',
      hostUpdatedAt: '2026-11-02T12:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const zone: SeatMapZone = {
      id: 'zone-1',
      name: 'Quiet desks',
      units: [unit],
      position: 0,
    }

    expect(zone.units[0]?.label).toBe('S1')
    expect(zone.name).toBe('Quiet desks')
    expect(zone.position).toBe(0)
  })
})

describe('unitsOverlap', () => {
  it('returns false for units in different zones', () => {
    const a: UnitGridPosition = { zoneId: 'zone-a', row: 0, col: 0, colSpan: 1 }
    const b: UnitGridPosition = { zoneId: 'zone-b', row: 0, col: 0, colSpan: 1 }
    expect(unitsOverlap(a, b)).toBe(false)
  })

  it('returns false for units in different rows within the same zone', () => {
    const a: UnitGridPosition = { zoneId: 'zone-a', row: 0, col: 0, colSpan: 1 }
    const b: UnitGridPosition = { zoneId: 'zone-a', row: 1, col: 0, colSpan: 1 }
    expect(unitsOverlap(a, b)).toBe(false)
  })

  it('returns false when rows are undefined', () => {
    const a: UnitGridPosition = { col: 0 }
    const b: UnitGridPosition = { col: 0 }
    expect(unitsOverlap(a, b)).toBe(false)
  })

  it('returns false when columns are undefined', () => {
    const a: UnitGridPosition = { row: 0 }
    const b: UnitGridPosition = { row: 0 }
    expect(unitsOverlap(a, b)).toBe(false)

    const c: UnitGridPosition = { row: 0, col: 0 }
    const d: UnitGridPosition = { row: 0 }
    expect(unitsOverlap(c, d)).toBe(false)
    expect(unitsOverlap(d, c)).toBe(false)
  })

  it('returns false when coordinates contain NaN, null, or non-finite numbers', () => {
    expect(unitsOverlap({ row: NaN, col: 0 }, { row: NaN, col: 0 })).toBe(false)
    expect(unitsOverlap({ row: 0, col: NaN }, { row: 0, col: NaN })).toBe(false)
    expect(unitsOverlap({ row: 0, col: 0, colSpan: NaN }, { row: 0, col: 0 })).toBe(false)
    expect(
      unitsOverlap(
        { row: null as unknown as number, col: null as unknown as number },
        { row: null as unknown as number, col: null as unknown as number },
      ),
    ).toBe(false)
    expect(unitsOverlap({ row: Infinity, col: 0 }, { row: Infinity, col: 0 })).toBe(false)
  })

  it('returns false for empty or non-positive spans (matching Postgres empty range)', () => {
    expect(
      unitsOverlap({ row: 0, col: 0, colSpan: 0 }, { row: 0, col: 0, colSpan: 1 }),
    ).toBe(false)
    expect(
      unitsOverlap({ row: 0, col: 0, colSpan: -1 }, { row: 0, col: 0, colSpan: 1 }),
    ).toBe(false)
  })

  it('detects overlap for identical single-column units in the same row', () => {
    const a: UnitGridPosition = { row: 0, col: 2, colSpan: 1 }
    const b: UnitGridPosition = { row: 0, col: 2, colSpan: 1 }
    expect(unitsOverlap(a, b)).toBe(true)
  })

  it('returns false for adjacent non-overlapping single-column units', () => {
    const a: UnitGridPosition = { row: 0, col: 0, colSpan: 1 }
    const b: UnitGridPosition = { row: 0, col: 1, colSpan: 1 }
    expect(unitsOverlap(a, b)).toBe(false)
  })

  it('detects overlap when a multi-column room intersects another unit', () => {
    // Room A covers cols 0, 1, 2
    const room: UnitGridPosition = { row: 0, col: 0, colSpan: 3 }
    // Seat at col 2 overlaps Room A
    const seat: UnitGridPosition = { row: 0, col: 2, colSpan: 1 }
    expect(unitsOverlap(room, seat)).toBe(true)
    expect(unitsOverlap(seat, room)).toBe(true)
  })

  it('detects overlap between two overlapping rooms', () => {
    // Room A covers cols 1, 2, 3
    const roomA: UnitGridPosition = { row: 1, col: 1, colSpan: 3 }
    // Room B covers cols 3, 4
    const roomB: UnitGridPosition = { row: 1, col: 3, colSpan: 2 }
    expect(unitsOverlap(roomA, roomB)).toBe(true)
  })

  it('returns false for adjacent rooms touching boundaries without intersecting', () => {
    // Room A covers cols 0, 1, 2 (interval [0, 3))
    const roomA: UnitGridPosition = { row: 0, col: 0, colSpan: 3 }
    // Room B covers cols 3, 4, 5 (interval [3, 6))
    const roomB: UnitGridPosition = { row: 0, col: 3, colSpan: 3 }
    expect(unitsOverlap(roomA, roomB)).toBe(false)
  })

  it('supports snake_case database properties', () => {
    const a: UnitGridPosition = { zone_id: 'z1', grid_row: 2, grid_col: 1, col_span: 2 }
    const b: UnitGridPosition = { zone_id: 'z1', grid_row: 2, grid_col: 2, col_span: 1 }
    expect(unitsOverlap(a, b)).toBe(true)
  })
})

describe('hasCollision', () => {
  it('returns false when existingUnits is null, undefined, or empty', () => {
    const candidate: UnitGridPosition = { row: 0, col: 0, colSpan: 1 }
    expect(hasCollision(candidate, null)).toBe(false)
    expect(hasCollision(candidate, undefined)).toBe(false)
    expect(hasCollision(candidate, [])).toBe(false)
  })

  it('ignores self when candidate unit ID matches existing unit ID', () => {
    const unitBeingMoved: UnitGridPosition = {
      id: 'unit-1',
      row: 0,
      col: 2,
      colSpan: 1,
    }
    const existingList: UnitGridPosition[] = [
      { id: 'unit-1', row: 0, col: 2, colSpan: 1 },
      { id: 'unit-2', row: 0, col: 4, colSpan: 1 },
    ]
    expect(hasCollision(unitBeingMoved, existingList)).toBe(false)
  })

  it('ignores self when candidate and existing share object identity without ID', () => {
    const anonymousUnit: UnitGridPosition = { row: 0, col: 2, colSpan: 1 }
    expect(hasCollision(anonymousUnit, [anonymousUnit])).toBe(false)
  })

  it('detects collision when candidate overlaps an existing unit with a different ID', () => {
    const candidate: UnitGridPosition = {
      id: 'unit-1',
      row: 0,
      col: 4,
      colSpan: 1,
    }
    const existingList: UnitGridPosition[] = [
      { id: 'unit-2', row: 0, col: 4, colSpan: 1 },
    ]
    expect(hasCollision(candidate, existingList)).toBe(true)
  })

  it('safely skips nullish entries in existingUnits', () => {
    const candidate: UnitGridPosition = { row: 0, col: 0, colSpan: 1 }
    const existingList = [
      null as unknown as UnitGridPosition,
      undefined as unknown as UnitGridPosition,
    ]
    expect(hasCollision(candidate, existingList)).toBe(false)
  })
})

describe('findFirstAvailableCell', () => {
  it('finds { row: 0, col: 0 } on an empty grid', () => {
    expect(findFirstAvailableCell([])).toEqual({ row: 0, col: 0 })
    expect(findFirstAvailableCell(null)).toEqual({ row: 0, col: 0 })
  })

  it('finds { row: 0, col: 1 } when (0, 0) is occupied by a 1-column unit', () => {
    const units: UnitGridPosition[] = [{ row: 0, col: 0, colSpan: 1 }]
    expect(findFirstAvailableCell(units)).toEqual({ row: 0, col: 1 })
  })

  it('wraps to next row { row: 1, col: 0 } when entire row 0 is full', () => {
    const units: UnitGridPosition[] = [
      { row: 0, col: 0, colSpan: 1 },
      { row: 0, col: 1, colSpan: 1 },
      { row: 0, col: 2, colSpan: 1 },
      { row: 0, col: 3, colSpan: 1 },
      { row: 0, col: 4, colSpan: 1 },
      { row: 0, col: 5, colSpan: 1 },
    ]
    expect(findFirstAvailableCell(units)).toEqual({ row: 1, col: 0 })
  })

  it('finds space for a 3-column room after a 1-column seat', () => {
    const units: UnitGridPosition[] = [{ row: 0, col: 0, colSpan: 1 }]
    // Room needs 3 columns; cols 1, 2, 3 are available on row 0
    expect(findFirstAvailableCell(units, 3)).toEqual({ row: 0, col: 1 })
  })

  it('moves a 3-column room to row 1 when row 0 only has 2 columns left', () => {
    // Room A covers cols 0, 1, 2, 3 (colSpan 4)
    const units: UnitGridPosition[] = [{ row: 0, col: 0, colSpan: 4 }]
    // A 3-column room cannot fit in remaining cols (4, 5) -> moves to row 1 col 0
    expect(findFirstAvailableCell(units, 3)).toEqual({ row: 1, col: 0 })
  })

  it('scopes collision check to the requested zoneId', () => {
    const units: UnitGridPosition[] = [
      { zoneId: 'zone-other', row: 0, col: 0, colSpan: 1 },
    ]
    // zone-target has no units at (0, 0)
    expect(findFirstAvailableCell(units, 1, 'zone-target')).toEqual({ row: 0, col: 0 })
  })

  it('returns null if colSpan is not an integer or is outside 1..GRID_COLS', () => {
    expect(findFirstAvailableCell([], 0)).toBeNull()
    expect(findFirstAvailableCell([], -1)).toBeNull()
    expect(findFirstAvailableCell([], 7)).toBeNull()
    expect(findFirstAvailableCell([], 1.5)).toBeNull()
    expect(findFirstAvailableCell([], NaN)).toBeNull()
  })

  it('returns null when all 50 rows are completely filled', () => {
    const units: UnitGridPosition[] = []
    for (let r = 0; r < MAX_GRID_ROWS; r++) {
      units.push({ row: r, col: 0, colSpan: 6 })
    }
    expect(findFirstAvailableCell(units, 1)).toBeNull()
  })
})

describe('nextSuggestedLabel', () => {
  it('suggests S1 for seats when list is empty, null, or undefined', () => {
    expect(nextSuggestedLabel([], 'seat')).toBe('S1')
    expect(nextSuggestedLabel(null, 'seat')).toBe('S1')
    expect(nextSuggestedLabel(undefined, 'seat')).toBe('S1')
  })

  it('suggests S9 when S1 through S8 exist (SRS Figure 3)', () => {
    const existing = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
    expect(nextSuggestedLabel(existing, 'seat')).toBe('S9')
  })

  it('suggests D5 when D1 through D4 exist (SRS Figure 3)', () => {
    const existing = ['D1', 'D2', 'D3', 'D4']
    expect(nextSuggestedLabel(existing, 'standing_desk')).toBe('D5')
  })

  it('suggests Room C when Room A and Room B exist (SRS Figure 3)', () => {
    const existing = ['Room A', 'Room B']
    expect(nextSuggestedLabel(existing, 'room')).toBe('Room C')
  })

  it('fills holes from deleted labels', () => {
    const existing = ['S1', 'S3']
    expect(nextSuggestedLabel(existing, 'seat')).toBe('S2')
  })

  it('is case-insensitive and trims surrounding whitespace', () => {
    const existing = [' s1 ', 'S2', 'room a', ' ROOM B ']
    expect(nextSuggestedLabel(existing, 'seat')).toBe('S3')
    expect(nextSuggestedLabel(existing, 'room')).toBe('Room C')
  })

  it('accepts unit objects with a label property', () => {
    const units = [{ label: 'S1' }, { label: 'S2' }]
    expect(nextSuggestedLabel(units, 'seat')).toBe('S3')
  })

  it('advances room letter sequences beyond Z to AA', () => {
    const letters = Array.from(
      { length: 26 },
      (_, i) => `Room ${String.fromCharCode(65 + i)}`,
    )
    expect(nextSuggestedLabel(letters, 'room')).toBe('Room AA')
  })

  it('falls back to U prefix for unknown unit types', () => {
    expect(nextSuggestedLabel(['U1'], 'custom_type')).toBe('U2')
  })

  it('handles case-insensitive unitType values and nullish items', () => {
    expect(nextSuggestedLabel([null as unknown as string, 'Room A'], 'ROOM')).toBe(
      'Room B',
    )
    expect(nextSuggestedLabel([], 'STANDING_DESK')).toBe('D1')
    expect(nextSuggestedLabel([], 'desk')).toBe('D1')
  })
})

describe('getZoneRowCount', () => {
  it('returns at least 1 row for an empty, null, or undefined zone', () => {
    expect(getZoneRowCount([])).toBe(1)
    expect(getZoneRowCount(null)).toBe(1)
    expect(getZoneRowCount(undefined)).toBe(1)
  })

  it('returns 1 row when highest unit is at row 0', () => {
    expect(getZoneRowCount([{ row: 0 }])).toBe(1)
  })

  it('returns highest unit row + 1', () => {
    expect(getZoneRowCount([{ row: 0 }, { row: 3 }, { row: 1 }])).toBe(4)
  })

  it('works with grid_row database column name', () => {
    expect(getZoneRowCount([{ grid_row: 5 }])).toBe(6)
  })
})

describe('describeCell', () => {
  it('formats single cell coordinates counted from 1', () => {
    expect(describeCell(0, 0)).toBe('Row 1, Column 1')
    expect(describeCell(0, 0, 1)).toBe('Row 1, Column 1')
    expect(describeCell(1, 2, 1)).toBe('Row 2, Column 3')
  })

  it('formats multi-column spans counted from 1 per design doc §3', () => {
    expect(describeCell(0, 0, 3)).toBe('Row 1, Columns 1 to 3')
    expect(describeCell(2, 3, 2)).toBe('Row 3, Columns 4 to 5')
  })
})

describe('describePlaceAction', () => {
  it('formats place button accessible name with zone name', () => {
    expect(describePlaceAction(1, 2, 'Quiet desks')).toBe(
      'Place at row 2, column 3 in Quiet desks',
    )
  })

  it('formats place button accessible name without zone name', () => {
    expect(describePlaceAction(0, 0)).toBe('Place at row 1, column 1')
  })
})
