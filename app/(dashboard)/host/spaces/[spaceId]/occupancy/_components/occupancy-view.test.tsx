import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import type { SeatMapZone } from '@/lib/seat-map/grid'
import { OccupancyView } from './occupancy-view'

describe('OccupancyView (STORY-12 TSK-12.5 & TSK-12.6)', () => {
  const space = {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Main Space',
  }

  const sampleZones: SeatMapZone[] = [
    {
      id: 'z1',
      name: 'Quiet Area',
      units: [
        {
          id: 'u1',
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
          id: 'u2',
          unitType: 'seat',
          label: 'S2',
          capacity: null,
          row: 0,
          col: 1,
          colSpan: 1,
          seatState: 'reserved',
          hostUpdatedAt: '2026-11-01T00:00:00Z',
          waitWindowEndsAt: null,
          reservationId: '10000000-0000-4000-8000-000000000001',
        },
      ],
    },
  ]

  it('renders empty state when space has no zones or units', () => {
    const html = renderToStaticMarkup(<OccupancyView space={space} initialZones={[]} />)

    expect(html).toContain(
      'No units found. Set up your seat map first to manage occupancy.',
    )
    expect(html).toContain(`/host/spaces/${space.id}/seat-map`)
  })

  it('renders view toggle with aria-pressed and unit details', () => {
    const html = renderToStaticMarkup(
      <OccupancyView space={space} initialZones={sampleZones} />,
    )

    expect(html).toContain('Seat Map View')
    expect(html).toContain('List View')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Selected Unit Control')
    expect(html).toContain('S1')
  })
})
