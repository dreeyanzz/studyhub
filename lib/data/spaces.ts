import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveCampusCoordinates } from '@/lib/geo/campuses'
import { haversineDistance } from '@/lib/geo/haversine'
import type { Database } from '@/lib/supabase/database.types'
import {
  discoverySearchQuerySchema,
  type DiscoverySearchInput,
} from '@/lib/validation/search'

/**
 * Result shape returned by searchVerifiedSpaces for discovery map & list (STORY-08, FR-1.1, FR-1.2).
 */
export interface VerifiedSpaceSearchResult {
  id: string
  name: string
  description: string | null
  address: string
  opens_at: string
  closes_at: string
  latitude: number | null
  longitude: number | null
  price_tier: Database['public']['Enums']['price_tier']
  distance_km: number | null
  curated_tags: Array<{
    id: string
    label: string
    category: string
  }>
  custom_tags: string[]
}

export interface SearchSpacesOptions {
  /**
   * Reference time for evaluating dynamic hours filters ("open_now").
   * Defaults to current wall-clock time. Evaluated in Asia/Manila (UTC+8, D-048).
   */
  now?: Date
}

/**
 * Converts a "HH:mm" or "HH:mm:ss" string into minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10))
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * Returns current minutes from midnight in Asia/Manila time (UTC+8, D-048).
 * Asia/Manila has no daylight saving time (permanent UTC+8).
 */
export function getManilaMinutesFromDate(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return (utcMinutes + 8 * 60) % 1440
}

/**
 * Evaluates whether a space is currently open given its opening and closing times.
 */
export function isSpaceOpenNow(
  opensAt: string,
  closesAt: string,
  currentManilaMinutes: number,
): boolean {
  const openMinutes = parseTimeToMinutes(opensAt)
  const closeMinutes = parseTimeToMinutes(closesAt)

  // Open 24 Hours (D-027: opens_at = closes_at)
  if (openMinutes === closeMinutes) {
    return true
  }

  // Same-day hours (e.g. 08:00 to 22:00)
  if (openMinutes < closeMinutes) {
    return currentManilaMinutes >= openMinutes && currentManilaMinutes < closeMinutes
  }

  // Overnight hours (e.g. 18:00 to 04:00)
  return currentManilaMinutes >= openMinutes || currentManilaMinutes < closeMinutes
}

/**
 * Evaluates whether a space is "Open Late":
 * - Open 24h
 * - Closes past midnight (overnight span)
 * - Closing time is at or after 22:00 (10:00 PM = 1320 minutes)
 */
export function isSpaceOpenLate(opensAt: string, closesAt: string): boolean {
  const openMinutes = parseTimeToMinutes(opensAt)
  const closeMinutes = parseTimeToMinutes(closesAt)

  if (openMinutes === closeMinutes) {
    return true
  }

  if (closeMinutes < openMinutes) {
    return true
  }

  return closeMinutes >= 1320
}

/**
 * Evaluates whether a space is "Open 24 Hours" (D-027: opens_at = closes_at).
 */
export function isSpaceOpen24h(opensAt: string, closesAt: string): boolean {
  const openMinutes = parseTimeToMinutes(opensAt)
  const closeMinutes = parseTimeToMinutes(closesAt)
  return openMinutes === closeMinutes
}

/**
 * Server query helper for Map Discovery and curated filters (STORY-08, FR-1.1, FR-1.2, D-055).
 *
 * Security & Query Invariants:
 * 1. Always strictly filters `.eq('status', 'verified')`. Pending or rejected spaces are NEVER returned.
 * 2. Multi-criteria curated tag filtering enforces strict AND logic:
 *    Only spaces containing EVERY requested curated tag are returned.
 * 3. Dynamic operating hours are evaluated against spaces.opens_at and spaces.closes_at in Asia/Manila (D-048).
 * 4. Campus queries match against CEBU_CAMPUSES before falling back to name/address text search.
 */
export async function searchVerifiedSpaces(
  supabase: SupabaseClient<Database>,
  query: DiscoverySearchInput,
  options?: SearchSpacesOptions,
): Promise<VerifiedSpaceSearchResult[]> {
  const parsed = discoverySearchQuerySchema.safeParse(query)
  if (!parsed.success) {
    return []
  }

  const validQuery = parsed.data
  let allowedSpaceIds: string[] | null = null

  // 1. Strict AND Curated Tag Filtering
  if (validQuery.tags.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from('space_curated_tags')
      .select('space_id, tag_id')
      .in('tag_id', validQuery.tags)

    if (tagError || !tagRows || tagRows.length === 0) {
      return []
    }

    const spaceTagMap = new Map<string, Set<string>>()
    for (const row of tagRows) {
      let tags = spaceTagMap.get(row.space_id)
      if (!tags) {
        tags = new Set()
        spaceTagMap.set(row.space_id, tags)
      }
      tags.add(row.tag_id)
    }

    const matchingTagSpaceIds = Array.from(spaceTagMap.entries())
      .filter(([_, tags]) => tags.size === validQuery.tags.length)
      .map(([spaceId]) => spaceId)

    if (matchingTagSpaceIds.length === 0) {
      return []
    }

    allowedSpaceIds = matchingTagSpaceIds
  }

  // 2. Unit Type Inventory Filtering
  if (validQuery.unitType.length > 0) {
    const { data: unitRows, error: unitError } = await supabase
      .from('units')
      .select('space_id')
      .in('unit_type', validQuery.unitType)

    if (unitError || !unitRows || unitRows.length === 0) {
      return []
    }

    const matchingUnitSpaceIds = new Set(unitRows.map((u) => u.space_id))

    if (allowedSpaceIds === null) {
      allowedSpaceIds = Array.from(matchingUnitSpaceIds)
    } else {
      allowedSpaceIds = allowedSpaceIds.filter((id) => matchingUnitSpaceIds.has(id))
      if (allowedSpaceIds.length === 0) {
        return []
      }
    }
  }

  // 3. Geolocation & Campus Dictionary Resolution
  let centerLat = validQuery.lat
  let centerLng = validQuery.lng
  let searchRadius = validQuery.radiusKm ?? 10
  let textFilter = validQuery.q?.trim()
  let isGeoSearch = centerLat !== undefined && centerLng !== undefined

  if (!isGeoSearch && textFilter) {
    const campus = resolveCampusCoordinates(textFilter)
    if (campus) {
      centerLat = campus.latitude
      centerLng = campus.longitude
      searchRadius = campus.radiusKm
      isGeoSearch = true
      textFilter = undefined
    }
  }

  // 4. Primary Spaces Query (Strictly Verified, D-055)
  let spacesQuery = supabase
    .from('spaces')
    .select(
      `
      id,
      name,
      description,
      address,
      opens_at,
      closes_at,
      latitude,
      longitude,
      price_tier,
      space_curated_tags (
        tag_id,
        curated_tags (
          id,
          label,
          category
        )
      ),
      space_custom_tags (
        id,
        name
      )
    `,
    )
    .eq('status', 'verified')

  if (allowedSpaceIds !== null) {
    spacesQuery = spacesQuery.in('id', allowedSpaceIds)
  }

  if (validQuery.price.length > 0) {
    spacesQuery = spacesQuery.in('price_tier', validQuery.price)
  }

  if (textFilter) {
    spacesQuery = spacesQuery.or(
      `name.ilike.%${textFilter}%,address.ilike.%${textFilter}%`,
    )
  }

  const { data: rawSpaces, error: spacesError } = await spacesQuery
  if (spacesError || !rawSpaces) {
    return []
  }

  // 5. Dynamic Operating Hours Filtering (Asia/Manila, D-048)
  const now = options?.now ?? new Date()
  const currentManilaMinutes = getManilaMinutesFromDate(now)

  const filtered = rawSpaces.filter((space) => {
    if (validQuery.hours.length === 0) {
      return true
    }

    // Strict AND: every selected hours filter must be satisfied
    for (const hourCrit of validQuery.hours) {
      if (hourCrit === 'open_now') {
        if (!isSpaceOpenNow(space.opens_at, space.closes_at, currentManilaMinutes)) {
          return false
        }
      } else if (hourCrit === 'open_late') {
        if (!isSpaceOpenLate(space.opens_at, space.closes_at)) {
          return false
        }
      } else if (hourCrit === 'open_24h') {
        if (!isSpaceOpen24h(space.opens_at, space.closes_at)) {
          return false
        }
      }
    }

    return true
  })

  // 6. Haversine Distance & Search Radius Filtering
  const resultsWithDistance: VerifiedSpaceSearchResult[] = []

  interface SpaceCuratedTagRelation {
    tag_id?: string
    curated_tags?: {
      id: string
      label: string
      category: string
    } | null
  }

  interface SpaceCustomTagRelation {
    id?: string
    name: string
  }

  for (const space of filtered) {
    let distanceKm: number | null = null

    if (
      centerLat !== undefined &&
      centerLng !== undefined &&
      space.latitude !== null &&
      space.longitude !== null
    ) {
      const dist = haversineDistance(
        centerLat,
        centerLng,
        space.latitude,
        space.longitude,
      )

      if (isGeoSearch && dist > searchRadius) {
        continue
      }

      distanceKm = Math.round(dist * 10) / 10
    } else if (isGeoSearch) {
      // Exclude spaces without coordinates when actively filtering by geographic radius
      continue
    }

    // Format tags cleanly
    const rawCurated =
      (space.space_curated_tags as unknown as SpaceCuratedTagRelation[]) ?? []
    const curatedTags: VerifiedSpaceSearchResult['curated_tags'] = []
    for (const sct of rawCurated) {
      const ct = sct.curated_tags
      if (ct && typeof ct === 'object') {
        curatedTags.push({
          id: ct.id,
          label: ct.label,
          category: ct.category,
        })
      }
    }

    const rawCustom =
      (space.space_custom_tags as unknown as SpaceCustomTagRelation[]) ?? []
    const customTags: string[] = rawCustom
      .map((t) => t.name)
      .filter((n): n is string => typeof n === 'string')

    resultsWithDistance.push({
      id: space.id,
      name: space.name,
      description: space.description,
      address: space.address,
      opens_at: space.opens_at,
      closes_at: space.closes_at,
      latitude: space.latitude,
      longitude: space.longitude,
      price_tier: space.price_tier,
      distance_km: distanceKm,
      curated_tags: curatedTags,
      custom_tags: customTags,
    })
  }

  // 7. Sort: distance ascending when geo search, otherwise name ascending
  if (isGeoSearch) {
    resultsWithDistance.sort((a, b) => {
      if (a.distance_km === null) return 1
      if (b.distance_km === null) return -1
      return a.distance_km - b.distance_km
    })
  } else {
    resultsWithDistance.sort((a, b) => a.name.localeCompare(b.name))
  }

  return resultsWithDistance
}
