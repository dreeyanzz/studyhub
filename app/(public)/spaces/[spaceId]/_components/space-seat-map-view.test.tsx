import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpaceSeatMapView } from './space-seat-map-view'
import type { SeatMapZone } from '@/lib/seat-map/grid'

const mockZones: SeatMapZone[] = [
  {
    id: 'z1',
    name: 'Quiet desks',
    position: 0,
    units: [
      {
        id: 'u1',
        unitType: 'seat',
        label: 'S1',
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
        unitType: 'seat',
        label: 'S2',
        capacity: 1,
        row: 0,
        col: 1,
        colSpan: 1,
        seatState: 'occupied',
        hostUpdatedAt: '2026-11-11T09:00:00Z',
        waitWindowEndsAt: null,
        reservationId: null,
      },
    ],
  },
]

describe('SpaceSeatMapView (STORY-11, TSK-11.5)', () => {
  it('renders view switcher with ?view=grid and ?view=list links supporting non-JS navigation (SRS §3.2.2)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView zones={mockZones} isOpen={true} initialView="grid" />,
    )

    // Switcher links
    expect(html).toContain('href="?view=grid"')
    expect(html).toContain('href="?view=list"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Seat map')
    expect(html).toContain('Accessible list')
  })

  it('renders grid view with SeatMapGrid embedding directly without extra card padding (D-062)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView zones={mockZones} isOpen={true} initialView="grid" />,
    )

    expect(html).toContain('Quiet desks')
    expect(html).toContain('S1')
    expect(html).toContain('S2')

    // Tile accessible names include unit freshness
    expect(html).toContain('S1, Seat, Available, Host-updated')
    expect(html).toContain('S2, Seat, Occupied, Host-updated')
  })

  it('renders list view when initialView is list', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView zones={mockZones} isOpen={true} initialView="list" />,
    )

    expect(html).toContain('data-testid="space-unit-list"')
    expect(html).toContain('Quiet desks')
    expect(html).toContain('S1')
    expect(html).toContain('S2')
  })

  it('renders selected unit panel and exposes renderSelectedUnitAction slot when space is open and unit is available', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={true}
        initialSelectedUnitId="u1"
        renderSelectedUnitAction={(unit) => (
          <button type="button" data-testid="mock-hold-btn">
            Hold {unit.label} for 15 min
          </button>
        )}
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: S1')
    expect(html).toContain('Quiet desks')
    expect(html).toContain('data-testid="mock-hold-btn"')
    expect(html).toContain('Hold S1 for 15 min')

    // No closed notice
    expect(html).not.toContain('This Space is closed now')
  })

  it('suppresses hold action slot and displays closed alert when space is closed (seeker-space-closed)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={false}
        initialSelectedUnitId="u1"
        renderSelectedUnitAction={(unit) => (
          <button type="button" data-testid="mock-hold-btn">
            Hold {unit.label}
          </button>
        )}
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: S1')

    // Hold button suppressed
    expect(html).not.toContain('data-testid="mock-hold-btn"')

    // Closed notice displayed with discovery link
    expect(html).toContain('data-testid="seeker-space-closed"')
    expect(html).toContain('This Space is closed now')
    expect(html).toContain('Explore other spaces')
    expect(html).toContain('href="/spaces"')
  })

  it('displays non-available status notice and suppresses hold slot when selected unit is occupied', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={true}
        initialSelectedUnitId="u2"
        renderSelectedUnitAction={() => <button type="button">Hold</button>}
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: S2')
    expect(html).toContain('This unit is currently')
    expect(html).toContain('Occupied')
    expect(html).toContain('It is not available to hold right now.')

    // Hold button suppressed
    expect(html).not.toContain('Hold')
  })
})
