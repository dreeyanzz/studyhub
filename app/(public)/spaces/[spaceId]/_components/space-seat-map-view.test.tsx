import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { formatDateTime } from '@/lib/space/format'
import type { SeatMapZone } from '@/lib/seat-map/grid'
import { SpaceSeatMapView } from './space-seat-map-view'

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
  it('renders view switcher with role="group" and ?view=grid / ?view=list links supporting non-JS navigation (SRS §3.2.2)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView zones={mockZones} isOpen={true} initialView="grid" />,
    )

    // Switcher uses role="group" (matching Host seat map), not tablist/tab
    expect(html).toContain('role="group"')
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('role="tab"')
    expect(html).not.toContain('aria-selected')

    // Switcher links
    expect(html).toContain('href="?view=grid"')
    expect(html).toContain('href="?view=list"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Seat map')
    expect(html).toContain('Accessible list')
  })

  it('renders grid view with SeatMapGrid links updating ?unit=<id> and hydration-safe SSR tile freshness (D-062)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={true}
        initialView="grid"
        initialSelectedUnitId="u1"
      />,
    )

    expect(html).toContain('Quiet desks')
    expect(html).toContain('S1')
    expect(html).toContain('S2')

    // Grid tiles are links that update ?unit=<id> without aria-pressed
    expect(html).toContain('href="?view=grid&amp;unit=u1"')
    expect(html).toContain('href="?view=grid&amp;unit=u2"')
    expect(html).toContain('aria-current="true"')
    expect(html).not.toContain('aria-pressed')

    // Switcher links preserve valid selected unit
    expect(html).toContain('href="?view=list&amp;unit=u1"')

    // Tile accessible names render Manila date/time on SSR (hydration-safe, §0)
    expect(html).toContain(
      `S1, Seat, Available, ${formatDateTime('2026-11-11T10:00:00Z')}`,
    )
    expect(html).toContain(
      `S2, Seat, Occupied, ${formatDateTime('2026-11-11T09:00:00Z')}`,
    )
    expect(html).not.toContain('Host-updated')
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

  it('renders selectedUnitActionSlot when space is open and selected unit matches initialSelectedUnitId (STORY-09 §8)', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={true}
        initialSelectedUnitId="u1"
        selectedUnitActionSlot={
          <div data-testid="server-hold-panel">Hold S1 from server</div>
        }
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('data-testid="selected-unit-hold-action"')
    expect(html).toContain('data-testid="server-hold-panel"')
    expect(html).toContain('Hold S1 from server')
  })

  it('omits stale or unknown initialSelectedUnitId from switcher links and suppresses selectedUnitActionSlot', () => {
    const html = renderToStaticMarkup(
      <SpaceSeatMapView
        zones={mockZones}
        isOpen={true}
        initialSelectedUnitId="missing-unit"
        selectedUnitActionSlot={
          <div data-testid="server-hold-panel">Hold from server</div>
        }
      />,
    )

    expect(html).not.toContain('data-testid="selected-unit-panel"')
    expect(html).not.toContain('data-testid="server-hold-panel"')
    expect(html).toContain('href="?view=grid"')
    expect(html).toContain('href="?view=list"')
    expect(html).not.toContain('missing-unit')
  })

  it('suppresses hold action slot and displays closed alert without duplicating seeker-space-closed when space is closed', () => {
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
        selectedUnitActionSlot={<div data-testid="server-hold-panel">Server hold</div>}
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: S1')

    // Hold slots suppressed
    expect(html).not.toContain('data-testid="mock-hold-btn"')
    expect(html).not.toContain('data-testid="server-hold-panel"')

    // Closed notice displayed with distinct testid and discovery link
    expect(html).toContain('data-testid="selected-unit-space-closed"')
    expect(html).not.toContain('data-testid="seeker-space-closed"')
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
        selectedUnitActionSlot={<div data-testid="server-hold-panel">Server hold</div>}
      />,
    )

    expect(html).toContain('data-testid="selected-unit-panel"')
    expect(html).toContain('Selected Unit: S2')
    expect(html).toContain('This unit is currently')
    expect(html).toContain('Occupied')
    expect(html).toContain('It is not available to hold right now.')

    // Hold slots suppressed
    expect(html).not.toContain('Hold')
    expect(html).not.toContain('data-testid="server-hold-panel"')
  })
})
