// STORY-15, TSK-15.2: Shared Space formatters (D-027).
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
