// STORY-11, TSK-11.1: Pure calculation of zone availability counts and oldest-available freshness (D-051).

import type { SeatMapZone } from '@/lib/seat-map/grid'

export interface ZoneAvailability {
  zoneId: string
  zoneName: string
  totalUnits: number
  availableUnits: number
  /**
   * The oldest `hostUpdatedAt` timestamp among currently Available units in this zone (D-051).
   * Null if no units in the zone are Available.
   */
  oldestAvailableHostUpdatedAt: string | null
}

export interface SpaceAvailabilitySummary {
  zones: ZoneAvailability[]
  totalUnits: number
  availableUnits: number
  hasAvailableUnits: boolean
}

/**
 * Computes availability statistics for a single SeatMapZone.
 *
 * Implements the oldest-available rule (D-051):
 * The zone timestamp reflects the oldest `hostUpdatedAt` among its currently Available units,
 * ensuring freshness is never overstated.
 */
export function computeZoneAvailability(zone: SeatMapZone): ZoneAvailability {
  const totalUnits = zone.units.length
  const availableUnitsList = zone.units.filter((u) => u.seatState === 'available')
  const availableUnits = availableUnitsList.length

  let oldestAvailableHostUpdatedAt: string | null = null

  if (availableUnits > 0) {
    // Find the oldest hostUpdatedAt timestamp
    let oldestTime = Infinity

    for (const unit of availableUnitsList) {
      if (unit.hostUpdatedAt) {
        const time = new Date(unit.hostUpdatedAt).getTime()
        if (!isNaN(time) && time < oldestTime) {
          oldestTime = time
          oldestAvailableHostUpdatedAt = unit.hostUpdatedAt
        }
      }
    }
  }

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    totalUnits,
    availableUnits,
    oldestAvailableHostUpdatedAt,
  }
}

/**
 * Computes availability statistics for all zones in a Space.
 */
export function computeSpaceAvailability(zones: SeatMapZone[]): SpaceAvailabilitySummary {
  const zoneSummaries = zones.map(computeZoneAvailability)

  const totalUnits = zoneSummaries.reduce((acc, z) => acc + z.totalUnits, 0)
  const availableUnits = zoneSummaries.reduce((acc, z) => acc + z.availableUnits, 0)

  return {
    zones: zoneSummaries,
    totalUnits,
    availableUnits,
    hasAvailableUnits: availableUnits > 0,
  }
}
