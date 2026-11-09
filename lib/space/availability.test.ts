import { describe, expect, it } from 'vitest'

import type { SeatMapUnit, SeatMapZone } from '@/lib/seat-map/grid'
import { computeSpaceAvailability, computeZoneAvailability } from './availability'

function makeUnit(
  id: string,
  seatState: SeatMapUnit['seatState'],
  hostUpdatedAt: string,
): SeatMapUnit {
  return {
    id,
    unitType: 'seat',
    label: id,
    capacity: 1,
    row: 0,
    col: 0,
    colSpan: 1,
    seatState,
    hostUpdatedAt,
    waitWindowEndsAt: null,
    reservationId: null,
  }
}

describe('computeZoneAvailability', () => {
  it('correctly calculates 0 available and total units when zone has no available units', () => {
    const zone: SeatMapZone = {
      id: 'z1',
      name: 'Quiet Desks',
      units: [
        makeUnit('u1', 'occupied', '2026-11-09T10:00:00.000Z'),
        makeUnit('u2', 'reserved', '2026-11-09T10:30:00.000Z'),
        makeUnit('u3', 'pending_payment', '2026-11-09T11:00:00.000Z'),
      ],
    }

    const summary = computeZoneAvailability(zone)
    expect(summary).toEqual({
      zoneId: 'z1',
      zoneName: 'Quiet Desks',
      totalUnits: 3,
      availableUnits: 0,
      oldestAvailableHostUpdatedAt: null,
    })
  })

  it('implements the zone oldest-available rule (D-051): returns oldest hostUpdatedAt among available units', () => {
    const oldestTimestamp = '2026-11-09T08:00:00.000Z'
    const newerTimestamp = '2026-11-09T10:00:00.000Z'
    const newestTimestamp = '2026-11-09T11:30:00.000Z'
    const occupiedTimestamp = '2026-11-09T07:00:00.000Z' // older, but occupied so ignored!

    const zone: SeatMapZone = {
      id: 'z2',
      name: 'Collaborative Area',
      units: [
        makeUnit('u1', 'available', newerTimestamp),
        makeUnit('u2', 'occupied', occupiedTimestamp), // should be ignored for available freshness
        makeUnit('u3', 'available', oldestTimestamp), // this is the oldest AVAILABLE unit
        makeUnit('u4', 'available', newestTimestamp),
      ],
    }

    const summary = computeZoneAvailability(zone)
    expect(summary.totalUnits).toBe(4)
    expect(summary.availableUnits).toBe(3)
    expect(summary.oldestAvailableHostUpdatedAt).toBe(oldestTimestamp)
  })

  it('handles an empty zone with 0 units', () => {
    const zone: SeatMapZone = {
      id: 'z-empty',
      name: 'Empty Zone',
      units: [],
    }

    const summary = computeZoneAvailability(zone)
    expect(summary).toEqual({
      zoneId: 'z-empty',
      zoneName: 'Empty Zone',
      totalUnits: 0,
      availableUnits: 0,
      oldestAvailableHostUpdatedAt: null,
    })
  })
})

describe('computeSpaceAvailability', () => {
  it('aggregates multiple zones across a Space', () => {
    const zones: SeatMapZone[] = [
      {
        id: 'z1',
        name: 'Zone A',
        units: [
          makeUnit('u1', 'available', '2026-11-09T09:00:00.000Z'),
          makeUnit('u2', 'occupied', '2026-11-09T09:30:00.000Z'),
        ],
      },
      {
        id: 'z2',
        name: 'Zone B',
        units: [
          makeUnit('u3', 'available', '2026-11-09T08:00:00.000Z'),
          makeUnit('u4', 'available', '2026-11-09T08:30:00.000Z'),
        ],
      },
      {
        id: 'z3',
        name: 'Zone C (Full)',
        units: [makeUnit('u5', 'reserved', '2026-11-09T10:00:00.000Z')],
      },
    ]

    const result = computeSpaceAvailability(zones)
    expect(result.totalUnits).toBe(5)
    expect(result.availableUnits).toBe(3)
    expect(result.hasAvailableUnits).toBe(true)
    expect(result.zones).toHaveLength(3)
    expect(result.zones[0]?.oldestAvailableHostUpdatedAt).toBe('2026-11-09T09:00:00.000Z')
    expect(result.zones[1]?.oldestAvailableHostUpdatedAt).toBe('2026-11-09T08:00:00.000Z')
    expect(result.zones[2]?.oldestAvailableHostUpdatedAt).toBeNull()
  })

  it('reports hasAvailableUnits: false when entire space is occupied or empty', () => {
    const occupiedZones: SeatMapZone[] = [
      {
        id: 'z1',
        name: 'Zone A',
        units: [makeUnit('u1', 'occupied', '2026-11-09T09:00:00.000Z')],
      },
    ]

    const result = computeSpaceAvailability(occupiedZones)
    expect(result.hasAvailableUnits).toBe(false)
    expect(result.availableUnits).toBe(0)
    expect(result.totalUnits).toBe(1)
  })
})
