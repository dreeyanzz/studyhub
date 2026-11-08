/**
 * Pure logic helper calculating human-readable relative time strings (D-002).
 *
 * Formats timestamps relative to a supplied client-side `now` timestamp
 * without referencing system globals or causing hydration mismatches.
 */
export function calculateRelativeTime(dateString: string, now: number): string {
  const time = new Date(dateString).getTime()
  if (Number.isNaN(time)) return 'recently'

  const diffMs = now - time
  if (diffMs < 0 || diffMs < 60_000) {
    return 'just now'
  }

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
  }

  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}
