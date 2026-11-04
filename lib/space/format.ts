// STORY-15, TSK-15.2: Shared Space formatters (D-027, D-053).
// Used by Host portal (/host) and Admin verification portal (/admin).

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

/** Alias for formatOpeningHours matching STORY-05 naming. */
export const hoursText = formatOpeningHours

// Worq's Spaces are located in the Philippines (e.g. seeded venues in Cebu City).
// Since servers may run in UTC, dates and timestamps are displayed in Philippine time (Asia/Manila).
const manilaDateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'Asia/Manila',
})

/**
 * Formats a timestamp into localized Philippine time: e.g. "Nov 2, 2026, 18:00".
 */
export function formatCreationDate(date: string | Date): string {
  return manilaDateTimeFormat.format(typeof date === 'string' ? new Date(date) : date)
}

/** Formats a timestamp for general display; identical to formatCreationDate. */
export const formatDateTime = formatCreationDate
