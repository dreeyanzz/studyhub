/**
 * Haversine formula calculation for geographic distances (STORY-08, FR-1.1, D-012).
 *
 * Computes the great-circle distance between two WGS 84 coordinates in kilometers.
 * Standard Earth mean radius: 6,371 km.
 */

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculates straight-line distance in kilometers between two latitude/longitude points.
 *
 * @param lat1 Latitude of point 1 in degrees (-90 to 90)
 * @param lon1 Longitude of point 1 in degrees (-180 to 180)
 * @param lat2 Latitude of point 2 in degrees (-90 to 90)
 * @param lon2 Longitude of point 2 in degrees (-180 to 180)
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0
  }

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const rLat1 = toRadians(lat1)
  const rLat2 = toRadians(lat2)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}
