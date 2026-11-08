import { describe, expect, it } from 'vitest'
import { CEBU_CAMPUSES, resolveCampusCoordinates } from './campuses'

describe('resolveCampusCoordinates (STORY-08, FR-1.1)', () => {
  it('resolves exact campus names case-insensitively', () => {
    const uscTc = resolveCampusCoordinates('University of San Carlos - Talamban Campus')
    expect(uscTc).not.toBeNull()
    expect(uscTc?.id).toBe('usc-tc')
    expect(uscTc?.latitude).toBe(10.354)
    expect(uscTc?.longitude).toBe(123.9114)

    const citU = resolveCampusCoordinates('cebu institute of technology - university')
    expect(citU).not.toBeNull()
    expect(citU?.id).toBe('cit-u')
  })

  it('resolves common campus abbreviations and aliases', () => {
    expect(resolveCampusCoordinates('USC Talamban')?.id).toBe('usc-tc')
    expect(resolveCampusCoordinates('usc tc')?.id).toBe('usc-tc')
    expect(resolveCampusCoordinates('CIT-U')?.id).toBe('cit-u')
    expect(resolveCampusCoordinates('cit')?.id).toBe('cit-u')
    expect(resolveCampusCoordinates('UP Cebu')?.id).toBe('up-cebu')
    expect(resolveCampusCoordinates('up')?.id).toBe('up-cebu')
    expect(resolveCampusCoordinates('UC Banilad')?.id).toBe('uc-banilad')
    expect(resolveCampusCoordinates('uclm')?.id).toBe('uclm')
    expect(resolveCampusCoordinates('uc lm')?.id).toBe('uclm')
    expect(resolveCampusCoordinates('USJR')?.id).toBe('usjr-main')
    expect(resolveCampusCoordinates('usj-r')?.id).toBe('usjr-main')
    expect(resolveCampusCoordinates('usjr basak')?.id).toBe('usjr-basak')
    expect(resolveCampusCoordinates('USPF')?.id).toBe('uspf')
    expect(resolveCampusCoordinates('swu')?.id).toBe('swu')
    expect(resolveCampusCoordinates('cdu')?.id).toBe('cdu')
  })

  it('resolves campus names when embedded in a search phrase', () => {
    expect(resolveCampusCoordinates('study near usc tc')?.id).toBe('usc-tc')
    expect(resolveCampusCoordinates('cit-u cafes')?.id).toBe('cit-u')
    expect(resolveCampusCoordinates('near usjr basak')?.id).toBe('usjr-basak')
  })

  it('returns null for empty, whitespace-only, non-matching queries, or non-school hubs', () => {
    expect(resolveCampusCoordinates('')).toBeNull()
    expect(resolveCampusCoordinates('   ')).toBeNull()
    expect(resolveCampusCoordinates('Silent study')).toBeNull()
    expect(resolveCampusCoordinates('Coffee shop')).toBeNull()
    expect(resolveCampusCoordinates('Random place in Mandaue')).toBeNull()
    expect(resolveCampusCoordinates('cebu it park')).toBeNull()
    expect(resolveCampusCoordinates('it park')).toBeNull()
  })

  it('maintains expected coordinates and radius for all curated campuses in the dictionary', () => {
    expect(CEBU_CAMPUSES.length).toBeGreaterThanOrEqual(10)
    for (const campus of CEBU_CAMPUSES) {
      expect(campus.latitude).toBeGreaterThanOrEqual(10.0)
      expect(campus.latitude).toBeLessThanOrEqual(10.5)
      expect(campus.longitude).toBeGreaterThanOrEqual(123.7)
      expect(campus.longitude).toBeLessThanOrEqual(124.1)
      expect(campus.radiusKm).toBeGreaterThan(0)
      expect(campus.aliases.length).toBeGreaterThan(0)
    }
  })
})
