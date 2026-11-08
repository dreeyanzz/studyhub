/**
 * Metro Cebu university campus coordinates and aliases dictionary (STORY-08, FR-1.1).
 *
 * Provides curated coordinate centroids and aliases for major Cebu university campuses
 * and study hubs to enable quick campus-centered discovery searches.
 */

export interface CampusLocation {
  id: string
  name: string
  aliases: string[]
  latitude: number
  longitude: number
  radiusKm: number
}

export const CEBU_CAMPUSES: readonly CampusLocation[] = [
  {
    id: 'usc-tc',
    name: 'University of San Carlos - Talamban Campus',
    aliases: [
      'usc tc',
      'usc talamban',
      'talamban campus',
      'usc-tc',
      'san carlos talamban',
    ],
    latitude: 10.354,
    longitude: 123.9114,
    radiusKm: 3,
  },
  {
    id: 'usc-main',
    name: 'University of San Carlos - Downtown Campus',
    aliases: [
      'usc main',
      'usc downtown',
      'usc p del rosario',
      'usc-main',
      'san carlos main',
    ],
    latitude: 10.3005,
    longitude: 123.8979,
    radiusKm: 2.5,
  },
  {
    id: 'cit-u',
    name: 'Cebu Institute of Technology - University',
    aliases: ['cit', 'cit-u', 'cit u', 'citu', 'technologian'],
    latitude: 10.2941,
    longitude: 123.8797,
    radiusKm: 2.5,
  },
  {
    id: 'up-cebu',
    name: 'University of the Philippines Cebu',
    aliases: ['up cebu', 'up', 'upvcc', 'up-cebu', 'lahug up'],
    latitude: 10.3225,
    longitude: 123.8988,
    radiusKm: 2.5,
  },
  {
    id: 'uc-main',
    name: 'University of Cebu - Main Campus',
    aliases: ['uc main', 'uc-main', 'uc sanciangko'],
    latitude: 10.2982,
    longitude: 123.8998,
    radiusKm: 2.5,
  },
  {
    id: 'uc-banilad',
    name: 'University of Cebu - Banilad',
    aliases: ['uc banilad', 'uc-banilad', 'banilad campus'],
    latitude: 10.3392,
    longitude: 123.9117,
    radiusKm: 2.5,
  },
  {
    id: 'uclm',
    name: 'University of Cebu - Lapu-Lapu and Mandaue',
    aliases: ['uclm', 'uc lm', 'uc mandaue', 'uc lapu-lapu mandaue'],
    latitude: 10.3308,
    longitude: 123.9427,
    radiusKm: 2.5,
  },
  {
    id: 'usjr-main',
    name: 'University of San Jose - Recoletos - Main Campus',
    aliases: [
      'usjr',
      'usj-r',
      'usjr main',
      'usj-r main',
      'recoletos main',
      'san jose main',
    ],
    latitude: 10.2938,
    longitude: 123.899,
    radiusKm: 2.5,
  },
  {
    id: 'usjr-basak',
    name: 'University of San Jose - Recoletos - Basak Campus',
    aliases: ['usjr basak', 'usj-r basak', 'recoletos basak', 'san jose basak'],
    latitude: 10.2885,
    longitude: 123.8647,
    radiusKm: 2.5,
  },
  {
    id: 'uspf',
    name: 'University of Southern Philippines Foundation',
    aliases: ['uspf', 'uspf lahug', 'usp'],
    latitude: 10.3299,
    longitude: 123.9009,
    radiusKm: 2.5,
  },
  {
    id: 'swu',
    name: 'Southwestern University PHINMA',
    aliases: ['swu', 'swu phinma', 'southwestern'],
    latitude: 10.3073,
    longitude: 123.8911,
    radiusKm: 2.5,
  },
  {
    id: 'cdu',
    name: "Cebu Doctors' University",
    aliases: ['cdu', 'cebu doc', 'cebu doctors'],
    latitude: 10.3243,
    longitude: 123.9318,
    radiusKm: 3,
  },
  {
    id: 'uv-main',
    name: 'University of the Visayas - Main Campus',
    aliases: ['uv', 'uv main', 'uv colon'],
    latitude: 10.2965,
    longitude: 123.9015,
    radiusKm: 2.5,
  },
] as const

/**
 * Resolves a search query string against the curated Metro Cebu campus dictionary.
 * Matches case-insensitively against campus ID, full name, or registered aliases.
 *
 * @param query The raw user search query string
 * @returns The matching CampusLocation or null if not recognized
 */
export function resolveCampusCoordinates(query: string): CampusLocation | null {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  // 1. Direct match on ID, name, or alias
  for (const campus of CEBU_CAMPUSES) {
    if (
      campus.id.toLowerCase() === normalized ||
      campus.name.toLowerCase() === normalized ||
      campus.aliases.some((alias) => alias.toLowerCase() === normalized)
    ) {
      return campus
    }
  }

  // 2. Word boundary / keyword match: match longest, most specific alias first
  const allAliases: Array<{ alias: string; campus: CampusLocation }> = []
  for (const campus of CEBU_CAMPUSES) {
    for (const alias of campus.aliases) {
      allAliases.push({ alias: alias.toLowerCase(), campus })
    }
  }
  // Sort longest alias first so that "usjr basak" or "usc talamban" is checked before "usjr" or "usc"
  allAliases.sort((a, b) => b.alias.length - a.alias.length)

  for (const item of allAliases) {
    if (
      normalized === item.alias ||
      normalized.startsWith(`${item.alias} `) ||
      normalized.endsWith(` ${item.alias}`) ||
      normalized.includes(` ${item.alias} `)
    ) {
      return item.campus
    }
  }

  return null
}
