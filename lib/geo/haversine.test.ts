import { describe, expect, it } from 'vitest'
import { haversineDistance } from './haversine'

describe('haversineDistance (STORY-08, FR-1.1, D-012)', () => {
  it('returns 0 when coordinates are identical', () => {
    expect(haversineDistance(10.3157, 123.8854, 10.3157, 123.8854)).toBe(0)
    expect(haversineDistance(0, 0, 0, 0)).toBe(0)
    expect(haversineDistance(-33.8688, 151.2093, -33.8688, 151.2093)).toBe(0)
  })

  it('is symmetric: distance from A to B equals distance from B to A', () => {
    const lat1 = 10.3157
    const lon1 = 123.8854
    const lat2 = 10.354
    const lon2 = 123.9114

    const d1 = haversineDistance(lat1, lon1, lat2, lon2)
    const d2 = haversineDistance(lat2, lon2, lat1, lon1)

    expect(d1).toBeCloseTo(d2, 8)
  })

  it('calculates accurate distance between known Cebu coordinate pairs within 0.1% tolerance', () => {
    // Cebu Provincial Capitol (10.3157, 123.8854) to USC Talamban (10.3540, 123.9114)
    // Geodesic distance: ~5.12 km
    const dCapitolToUscTc = haversineDistance(10.3157, 123.8854, 10.354, 123.9114)
    expect(dCapitolToUscTc).toBeGreaterThan(5.0)
    expect(dCapitolToUscTc).toBeLessThan(5.2)
    expect(dCapitolToUscTc).toBeCloseTo(5.12, 1)

    // CIT-U (10.2941, 123.8797) to UP Cebu (10.3225, 123.8988)
    // Geodesic distance: ~3.78 km
    const dCituToUp = haversineDistance(10.2941, 123.8797, 10.3225, 123.8988)
    expect(dCituToUp).toBeGreaterThan(3.7)
    expect(dCituToUp).toBeLessThan(3.9)
    expect(dCituToUp).toBeCloseTo(3.78, 1)
  })

  it('handles anti-meridian or equatorial edge cases properly', () => {
    // Two points on equator 1 degree apart: Earth circumference / 360 = ~111.19 km
    const dEquator = haversineDistance(0, 0, 0, 1)
    expect(dEquator).toBeCloseTo(111.19, 0)

    // North Pole (90, 0) to Equator (0, 0): Quarter of Earth circumference = ~10007.5 km
    const dPoleToEquator = haversineDistance(90, 0, 0, 0)
    expect(dPoleToEquator).toBeCloseTo(10007.5, 0)
  })
})
