import type { SeatMapZone } from '@/lib/seat-map/grid'
import type { RemovalTarget } from './confirm-removal'

export type Query = Record<string, string | string[] | undefined>

/**
 * Constructs the URL for switching between Grid and List views while preserving
 * current query context (e.g. active removal confirmations).
 */
export function buildViewHref(
  baseHref: string,
  query: Query,
  targetView: 'grid' | 'list',
): string {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(query)) {
    if (key === 'view') continue
    if (typeof val === 'string') {
      params.set(key, val)
    } else if (Array.isArray(val)) {
      for (const item of val) params.append(key, item)
    }
  }
  if (targetView === 'list') {
    params.set('view', 'list')
  }
  const qs = params.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
}

/**
 * The confirmation step's target (STORY-07 design §3): ?remove=<unit id> or
 * ?delete-zone=<zone id>. An id that isn't in this Space, or no longer exists, is
 * ignored, so a stale link shows the map as it is.
 */
export function findRemovalTarget(
  zones: SeatMapZone[],
  query: Query,
): RemovalTarget | null {
  const one = (value: string | string[] | undefined) =>
    typeof value === 'string'
      ? value
      : Array.isArray(value) && typeof value[0] === 'string'
        ? value[0]
        : undefined

  const unitId = one(query.remove)
  if (unitId) {
    for (const zone of zones) {
      const unit = zone.units.find((u) => u.id === unitId)
      if (unit) {
        return {
          kind: 'unit',
          id: unit.id,
          label: unit.label,
          zoneId: zone.id,
          zoneName: zone.name,
        }
      }
    }
  }

  const zoneId = one(query['delete-zone'])
  const zone = zoneId ? zones.find((z) => z.id === zoneId) : undefined
  if (zone) {
    return { kind: 'zone', id: zone.id, name: zone.name, unitCount: zone.units.length }
  }
  return null
}
