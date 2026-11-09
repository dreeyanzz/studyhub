// STORY-11, TSK-11.1: Host freshness formatter (D-002, D-051).
// Formats timestamps into "Host-updated · X min ago" labels.
// Invariant: Never use the words "real-time" or "live" (Glossary).

/**
 * Formats a host_updated_at timestamp into an honest relative freshness label.
 *
 * Rules:
 * - < 1 min ago: "Host-updated · Just now"
 * - 1 to 59 min ago: "Host-updated · X min ago"
 * - 1 to 23 hr ago: "Host-updated · X hr ago"
 * - >= 24 hr ago: "Host-updated · X d ago"
 *
 * Accepts string ISO timestamp or Date object, plus an optional `nowInput` for deterministic testing.
 */
export function formatHostFreshness(
  updatedAt: string | Date,
  nowInput: string | Date = new Date(),
): string {
  const updated = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput

  const diffMs = now.getTime() - updated.getTime()

  // Future timestamp or < 1 min diff
  if (diffMs < 60 * 1000) {
    return 'Host-updated · Just now'
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) {
    return `Host-updated · ${diffMinutes} min ago`
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  if (diffHours < 24) {
    return `Host-updated · ${diffHours} hr ago`
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return `Host-updated · ${diffDays} d ago`
}
