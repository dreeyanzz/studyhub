import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceUnitList } from './space-unit-list'
import type { SeatMapZone } from '@/lib/seat-map/grid'

const mockZones: SeatMapZone[] = [
  {
    id: 'z1',
    name: 'Quiet Area',
    position: 0,
    units: [
      {
        id: 'u1',
        unitType: 'seat',
        label: 'Q1',
        capacity: 1,
        row: 0,
        col: 0,
        colSpan: 1,
        seatState: 'available',
        hostUpdatedAt: '2026-11-11T10:00:00Z',
        waitWindowEndsAt: null,
        reservationId: null,
      },
      {
        id: 'u2',
        unitType: 'standing_desk',
        label: 'SD1',
        capacity: 1,
        row: 0,
        col: 1,
        colSpan: 1,
        seatState: 'occupied',
        hostUpdatedAt: '2026-11-11T09:30:00Z',
        waitWindowEndsAt: null,
        reservationId: null,
      },
      {
        id: 'u3',
        unitType: 'room',
        label: 'R1',
        capacity: 4,
        row: 1,
        col: 0,
        colSpan: 2,
        seatState: 'reserved',
        hostUpdatedAt: '2026-11-11T08:00:00Z',
        waitWindowEndsAt: null,
        reservationId: null,
      },
    ],
  },
]

describe('SpaceUnitList (STORY-11, TSK-11.5)', () => {
  it('renders accessible list of units grouped by zone with type, state, and freshness', () => {
    const html = renderToStaticMarkup(<SpaceUnitList zones={mockZones} />)

    expect(html).toContain('Quiet Area')
    expect(html).toContain('Q1')
    expect(html).toContain('Seat')
    expect(html).toContain('Available')
    expect(html).toContain('dateTime="2026-11-11T10:00:00Z"')

    expect(html).toContain('SD1')
    expect(html).toContain('Standing Desk')
    expect(html).toContain('Occupied')
    expect(html).toContain('dateTime="2026-11-11T09:30:00Z"')

    expect(html).toContain('R1')
    expect(html).toContain('(4 people)')
    expect(html).toContain('Room')
    expect(html).toContain('Reserved')
    expect(html).toContain('dateTime="2026-11-11T08:00:00Z"')
  })

  it('renders select links with ?view=list&unit=<id> parameters and 48px touch targets (D-031)', () => {
    const html = renderToStaticMarkup(
      <SpaceUnitList zones={mockZones} selectedUnitId="u1" />,
    )

    // Select links present
    expect(html).toContain('href="?view=list&amp;unit=u1"')
    expect(html).toContain('href="?view=list&amp;unit=u2"')

    // Selected state on u1
    expect(html).toContain('Selected')

    // Touch targets meet 48x48 px minimum (D-031)
    const touchMatches = [...html.matchAll(/min-h-12\s+min-w-12/g)]
    expect(touchMatches.length).toBeGreaterThanOrEqual(3)
  })

  it('renders empty message when zones list is empty', () => {
    const html = renderToStaticMarkup(<SpaceUnitList zones={[]} />)
    expect(html).toContain('No units available in this Space.')
  })
})
