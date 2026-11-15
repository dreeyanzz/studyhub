import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import type { SeatMapUnit, SeatMapZone } from '@/lib/seat-map/grid'
import { OccupancyHeader } from './occupancy-header'
import { OccupancyList } from './occupancy-list'
import { OccupancyView } from './occupancy-view'
import { UnitControlCard } from './unit-control-card'

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

  describe('STORY-10 TSK-10.5 check-in link and wait-window badges', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseUnit: SeatMapUnit = {
      id: 'u-wait',
      unitType: 'seat',
      label: 'S3',
      capacity: null,
      row: 0,
      col: 2,
      colSpan: 1,
      seatState: 'reserved',
      hostUpdatedAt: '2026-11-15T09:50:00Z',
      waitWindowEndsAt: '2026-11-15T10:18:00Z',
      reservationId: '10000000-0000-4000-8000-000000000002',
    }

    it('renders the Check-in desk link in OccupancyHeader', () => {
      const html = renderToStaticMarkup(
        <OccupancyHeader space={space} zones={sampleZones} />,
      )

      expect(html).toContain(`/host/spaces/${space.id}/check-in`)
      expect(html).toContain('Check-in desk')
    })

    it('renders wait-window minutes remaining on reserved Seeker holds in card and list views', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-15T10:00:00Z'))

      const cardHtml = renderToStaticMarkup(
        <UnitControlCard unit={baseUnit} onStateTap={vi.fn()} />,
      )
      const listHtml = renderToStaticMarkup(
        <OccupancyList
          zones={[{ id: 'z1', name: 'Quiet Area', units: [baseUnit] }]}
          onStateTap={vi.fn()}
        />,
      )

      expect(cardHtml).toContain('Wait: 18 min left')
      expect(listHtml).toContain('Wait: 18 min left')
    })

    it('renders sub-minute and expired states appropriately', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-15T10:17:20Z'))

      const subMinuteHtml = renderToStaticMarkup(
        <UnitControlCard unit={baseUnit} onStateTap={vi.fn()} />,
      )
      expect(subMinuteHtml).toContain('Wait: &lt; 1 min')

      vi.setSystemTime(new Date('2026-11-15T10:18:05Z'))
      const expiredHtml = renderToStaticMarkup(
        <UnitControlCard unit={baseUnit} onStateTap={vi.fn()} />,
      )
      expect(expiredHtml).toContain('Wait: expired')
    })

    it('hides the wait-window badge for walk-in reserved units and occupied units', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-15T10:00:00Z'))

      const walkInReserved: SeatMapUnit = {
        ...baseUnit,
        waitWindowEndsAt: null,
        reservationId: null,
      }
      const checkedInUnit: SeatMapUnit = {
        ...baseUnit,
        seatState: 'occupied',
      }

      const walkInHtml = renderToStaticMarkup(
        <UnitControlCard unit={walkInReserved} onStateTap={vi.fn()} />,
      )
      const occupiedHtml = renderToStaticMarkup(
        <UnitControlCard unit={checkedInUnit} onStateTap={vi.fn()} />,
      )

      expect(walkInHtml).not.toContain('Wait:')
      expect(occupiedHtml).not.toContain('Wait:')
    })
  })
})
