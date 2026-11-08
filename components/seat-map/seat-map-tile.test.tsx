import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SeatMapTile } from '@/components/seat-map/seat-map-tile'
import type { SeatMapUnit } from '@/lib/seat-map/grid'

describe('SeatMapTile component (STORY-07 TSK-07.4)', () => {
  it('renders a standard seat with accessible name and available styling', () => {
    const unit: SeatMapUnit = {
      id: 'unit-1',
      unitType: 'seat',
      label: 'S4',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 1,
      seatState: 'available',
      hostUpdatedAt: '2026-11-01T00:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('aria-label="S4, Seat, Available"')
    expect(html).toContain('S4')
    expect(html).toContain('border-emerald-600/40')
    expect(html).toContain('min-h-12')
    // The width is in px, so six tiles still fit 360 px at 200% text (design §3).
    expect(html).toContain('min-w-[48px]')
    // Contains two SVGs (type icon and state icon)
    const svgMatches = html.match(/<svg/g)
    expect(svgMatches).toHaveLength(2)
  })

  it('renders a standing desk with occupied state and styling', () => {
    const unit: SeatMapUnit = {
      id: 'unit-2',
      unitType: 'standing_desk',
      label: 'D1',
      capacity: null,
      row: 1,
      col: 2,
      colSpan: 1,
      seatState: 'occupied',
      hostUpdatedAt: '2026-11-01T00:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('aria-label="D1, Standing Desk, Occupied"')
    expect(html).toContain('D1')
    expect(html).toContain('border-amber-600/40')
  })

  it('renders a whole room spanning multiple columns with capacity indicator', () => {
    const unit: SeatMapUnit = {
      id: 'unit-3',
      unitType: 'room',
      label: 'Room A',
      capacity: 6,
      row: 2,
      col: 0,
      colSpan: 3,
      seatState: 'reserved',
      hostUpdatedAt: '2026-11-01T00:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('aria-label="Room A (6), Room, Reserved"')
    expect(html).toContain('Room A (6)')
    expect(html).toContain('border-blue-600/40')
  })

  it('renders pending payment state with purple styling', () => {
    const unit: SeatMapUnit = {
      id: 'unit-4',
      unitType: 'seat',
      label: 'S9',
      capacity: null,
      row: 0,
      col: 5,
      colSpan: 1,
      seatState: 'pending_payment',
      hostUpdatedAt: '2026-11-01T00:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('aria-label="S9, Seat, Pending Payment"')
    expect(html).toContain('S9')
    expect(html).toContain('border-purple-600/40')
  })

  it('preserves icon sizes with shrink-0 and enables text wrapping with break-words', () => {
    const unit: SeatMapUnit = {
      id: 'unit-5',
      unitType: 'seat',
      label: 'VeryLongSeatLabel',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 1,
      seatState: 'available',
      hostUpdatedAt: '2026-11-01T00:00:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('shrink-0')
    expect(html).toContain('break-words')
  })

  it.each(['available', 'pending_payment', 'reserved', 'occupied'] as const)(
    'keeps the light palette for a tile in the %s state whatever the OS color scheme (D-031)',
    (seatState) => {
      const unit: SeatMapUnit = {
        id: 'unit-7',
        unitType: 'seat',
        label: 'S2',
        capacity: null,
        row: 0,
        col: 1,
        colSpan: 1,
        seatState,
        hostUpdatedAt: '2026-11-01T00:00:00Z',
        waitWindowEndsAt: null,
        reservationId: null,
      }

      const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

      // The app has no dark theme, so a dark: class would follow the OS setting and put
      // near-white text on a grey tile on the light page.
      expect(html).not.toContain('dark:')
    },
  )

  it('uses role="img" for accessible graphic representation without redundant sr-only spans', () => {
    const unit: SeatMapUnit = {
      id: 'unit-6',
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
    }

    const html = renderToStaticMarkup(<SeatMapTile unit={unit} />)

    expect(html).toContain('role="img"')
    expect(html).not.toContain('role="group"')
    expect(html).not.toContain('class="sr-only"')
  })
})
