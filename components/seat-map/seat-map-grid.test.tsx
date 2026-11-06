import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SeatMapGrid } from '@/components/seat-map/seat-map-grid'
import type { SeatMapZone } from '@/lib/seat-map/grid'

describe('SeatMapGrid component (STORY-07 TSK-07.4)', () => {
  it('renders legend once above zones and shows message when zones array is empty', () => {
    const html = renderToStaticMarkup(<SeatMapGrid zones={[]} />)

    expect(html).toContain('aria-label="Seat map legend"')
    expect(html).toContain('No zones in this seat map.')
    expect(html).toContain('max-w-xl')
  })

  it('renders zone heading and 6-column snap grid with default tiles', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        units: [
          {
            id: 'unit-1',
            unitType: 'seat',
            label: 'S1',
            capacity: null,
            row: 0,
            col: 0,
            colSpan: 1,
            seatState: 'available',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
          {
            id: 'unit-2',
            unitType: 'seat',
            label: 'S2',
            capacity: null,
            row: 0,
            col: 1,
            colSpan: 1,
            seatState: 'reserved',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]

    const html = renderToStaticMarkup(<SeatMapGrid zones={zones} />)

    // Legend rendered once
    expect(html).toContain('aria-label="Seat map legend"')

    // Zone heading
    expect(html).toContain('Quiet Desks')

    // 6-column grid template
    expect(html).toContain('grid-template-columns:repeat(6, minmax(48px, 1fr))')

    // Units rendered
    expect(html).toContain('S1')
    expect(html).toContain('S2')

    // Empty cells rendered as plain gaps with aria-hidden="true"
    expect(html).toContain('aria-hidden="true"')
  })

  it('correctly handles multi-column units spanning adjacent cells', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'zone-rooms',
        name: 'Private Rooms',
        units: [
          {
            id: 'room-1',
            unitType: 'room',
            label: 'Room A',
            capacity: 6,
            row: 0,
            col: 0,
            colSpan: 3, // columns 0, 1, 2
            seatState: 'available',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
          {
            id: 'room-2',
            unitType: 'room',
            label: 'Room B',
            capacity: 4,
            row: 0,
            col: 3,
            colSpan: 2, // columns 3, 4
            seatState: 'occupied',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
          // Column 5 is empty
        ],
      },
    ]

    const emptyCellCalls: string[] = []

    const html = renderToStaticMarkup(
      <SeatMapGrid
        zones={zones}
        renderEmptyCell={({ zoneId, row, col }) => {
          emptyCellCalls.push(`${zoneId}:${row},${col}`)
          return <span data-testid="empty-btn">Place here</span>
        }}
      />,
    )

    // Room A spans 3 columns: grid-column: 1 / span 3
    expect(html).toContain('grid-column:1 / span 3')
    expect(html).toContain('Room A (6)')

    // Room B spans 2 columns: grid-column: 4 / span 2
    expect(html).toContain('grid-column:4 / span 2')
    expect(html).toContain('Room B (4)')

    // Empty cell is only at col 5, cols 1, 2, 4 are covered by spanning rooms
    expect(emptyCellCalls).toEqual(['zone-rooms:0,5'])
    expect(html).toContain('Place here')
  })

  it('supports custom renderUnit prop', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'zone-1',
        name: 'Zone A',
        units: [
          {
            id: 'unit-1',
            unitType: 'seat',
            label: 'S1',
            capacity: null,
            row: 0,
            col: 0,
            colSpan: 1,
            seatState: 'available',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]

    const html = renderToStaticMarkup(
      <SeatMapGrid
        zones={zones}
        renderUnit={(unit) => (
          <button type="button" data-custom-unit={unit.id}>
            Select {unit.label}
          </button>
        )}
      />,
    )

    expect(html).toContain('data-custom-unit="unit-1"')
    expect(html).toContain('Select S1')
  })

  it('draws 1 row of empty cells for a zone with no units', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'empty-zone',
        name: 'Empty Zone',
        units: [],
      },
    ]

    const emptyCoords: number[] = []

    const html = renderToStaticMarkup(
      <SeatMapGrid
        zones={zones}
        renderEmptyCell={({ row, col }) => {
          emptyCoords.push(col)
          return (
            <button type="button">
              Row {row + 1} Col {col + 1}
            </button>
          )
        }}
      />,
    )

    expect(html).toContain('Empty Zone')
    // 6 columns in row 0
    expect(emptyCoords).toEqual([0, 1, 2, 3, 4, 5])
    expect(html).toContain('Row 1 Col 1')
    expect(html).toContain('Row 1 Col 6')
  })

  it('handles colliding or overlapping units safely by skipping the conflicting unit', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'zone-collision',
        name: 'Colliding Zone',
        units: [
          {
            id: 'unit-room',
            unitType: 'room',
            label: 'Room A',
            capacity: 6,
            row: 0,
            col: 0,
            colSpan: 3, // covers (0,0), (0,1), (0,2)
            seatState: 'available',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
          {
            id: 'unit-overlap',
            unitType: 'seat',
            label: 'S_Conflict',
            capacity: null,
            row: 0,
            col: 1, // collides with Room A!
            colSpan: 1,
            seatState: 'occupied',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]

    const html = renderToStaticMarkup(<SeatMapGrid zones={zones} />)

    // Room A rendered
    expect(html).toContain('Room A (6)')
    // Conflicting seat should be skipped, preventing overlapping elements on CSS grid
    expect(html).not.toContain('S_Conflict')
  })

  it('caps rows at MAX_GRID_ROWS (50) and skips units with out-of-bounds row coordinates', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'zone-oob',
        name: 'OOB Zone',
        units: [
          {
            id: 'unit-oob',
            unitType: 'seat',
            label: 'S_OOB',
            capacity: null,
            row: 999, // out of bounds (> 50)
            col: 0,
            colSpan: 1,
            seatState: 'available',
            hostUpdatedAt: '2026-11-01T00:00:00Z',
            waitWindowEndsAt: null,
            reservationId: null,
          },
        ],
      },
    ]

    const html = renderToStaticMarkup(<SeatMapGrid zones={zones} />)

    // S_OOB should be skipped
    expect(html).not.toContain('S_OOB')
    // Grid only renders 1 default row rather than looping up to row 1000
    expect(html).toContain('grid-row:1')
    expect(html).not.toContain('grid-row:1000')
  })
})
