// STORY-15, TSK-15.2 & STORY-11, TSK-11.1: Shared Space formatters (D-027, D-048).
// Used by Host portal (/host), Admin verification portal (/admin), and public Space profile (/spaces/[spaceId]).

/**
 * Formats daily operating hours for a Space (D-027).
 * Postgres returns time as HH:mm:ss and form input submits HH:mm,
 * so only the first 5 characters (HH:mm) are considered.
 * Equal times mean open 24 hours, and closing earlier than opening
 * means the Space closes after midnight.
 */
export function formatOpeningHours(opensAt: string, closesAt: string): string {
  const opens = opensAt.slice(0, 5)
  const closes = closesAt.slice(0, 5)
  if (opens === closes) return 'Open 24 hours'
  if (closes < opens) return `${opens} to ${closes} next day`
  return `${opens} to ${closes}`
}

/** Canonical alias matching STORY-11 design §0. */
export const hoursText = formatOpeningHours

// Assumption: Worq's Spaces are in the Philippines (the seeded ones are in Cebu
// City), and the server may run in UTC, so times are shown in Philippine time.
const manilaDateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'Asia/Manila',
})

/**
 * Formats a timestamp into localized Philippine time: e.g. "Nov 2, 2026, 18:00".
 */
export function formatDateTime(date: string | Date): string {
  return manilaDateTimeFormat.format(typeof date === 'string' ? new Date(date) : date)
}

export interface SpaceOperatingStatus {
  isOpen: boolean
  displayText: string
  opensAt: string
  closesAt: string
  is24Hours: boolean
}

function parseHHMM(time: string): number {
  const parts = time.slice(0, 5).split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  return (h % 24) * 60 + (m % 60)
}

function getManilaMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10) % 60
  return hour * 60 + minute
}

/**
 * Computes current operating open/closed status in Asia/Manila (D-027, D-048).
 * Handles:
 * - 24-hour spaces: opensAt === closesAt -> isOpen: true, "Open 24 hours"
 * - Standard daytime hours: opensAt < closesAt
 * - Overnight hours: closesAt < opensAt (spanning midnight)
 */
export function computeOperatingStatus(
  opensAt: string,
  closesAt: string,
  nowInput: string | Date = new Date(),
): SpaceOperatingStatus {
  const opens = opensAt.slice(0, 5)
  const closes = closesAt.slice(0, 5)

  if (opens === closes) {
    return {
      isOpen: true,
      displayText: 'Open 24 hours',
      opensAt: opens,
      closesAt: closes,
      is24Hours: true,
    }
  }

  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput
  const currentMinutes = getManilaMinutes(now)
  const openMinutes = parseHHMM(opens)
  const closeMinutes = parseHHMM(closes)

  // Standard daytime hours (e.g. 08:00 to 22:00)
  if (openMinutes < closeMinutes) {
    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return {
        isOpen: true,
        displayText: `Open now · Closes at ${closes}`,
        opensAt: opens,
        closesAt: closes,
        is24Hours: false,
      }
    }

    const displayText =
      currentMinutes < openMinutes
        ? `Closed · Opens at ${opens}`
        : `Closed · Opens tomorrow at ${opens}`

    return {
      isOpen: false,
      displayText,
      opensAt: opens,
      closesAt: closes,
      is24Hours: false,
    }
  }

  // Overnight hours (e.g. 18:00 to 02:00 next day)
  const isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes

  if (isOpen) {
    const displayText =
      currentMinutes >= openMinutes
        ? `Open now · Closes at ${closes} next day`
        : `Open now · Closes at ${closes}`

    return {
      isOpen: true,
      displayText,
      opensAt: opens,
      closesAt: closes,
      is24Hours: false,
    }
  }

  return {
    isOpen: false,
    displayText: `Closed · Opens at ${opens}`,
    opensAt: opens,
    closesAt: closes,
    is24Hours: false,
  }
}
