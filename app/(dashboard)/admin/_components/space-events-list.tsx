import { Badge } from '@/components/ui/badge'
import type { SpaceEventItem, SpaceStatus } from '@/lib/data/verification'
import { formatDateTime } from '@/lib/space/format'
import { cn } from '@/lib/utils'

/** Every status in words (D-031): the same labels the badges use. */
export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  pending: 'Pending verification',
  verified: 'Verified',
  rejected: 'Rejected',
  taken_down: 'Taken down',
}

function pin(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) return 'None'
  return `${latitude}, ${longitude}`
}

/** The lines one entry shows: a status move, its reason, then each changed field. */
export function describeSpaceEvent(event: SpaceEventItem): string[] {
  const lines: string[] = []
  if (event.fromStatus && event.toStatus) {
    lines.push(
      `${SPACE_STATUS_LABELS[event.fromStatus]} → ${SPACE_STATUS_LABELS[event.toStatus]}`,
    )
  }
  if (event.reason) lines.push(`Reason: ${event.reason}`)
  if (event.oldName !== event.newName && (event.oldName || event.newName)) {
    lines.push(`Name: ${event.oldName ?? 'None'} → ${event.newName ?? 'None'}`)
  }
  if (event.oldAddress !== event.newAddress && (event.oldAddress || event.newAddress)) {
    lines.push(`Address: ${event.oldAddress ?? 'None'} → ${event.newAddress ?? 'None'}`)
  }
  if (
    event.oldLatitude !== event.newLatitude ||
    event.oldLongitude !== event.newLongitude
  ) {
    lines.push(
      `Map pin: ${pin(event.oldLatitude, event.oldLongitude)} → ${pin(event.newLatitude, event.newLongitude)}`,
    )
  }
  return lines
}

/**
 * A Space's list of changes on `/admin` (STORY-20 design §3, D-086): newest first, each
 * entry with its status move, reason, `old → new` identity changes, who made it and when.
 * Entries since the Space was last Verified, and the newest entry, are marked in words
 * as well as by their border, never by colour alone.
 */
export function SpaceEventsList({ events }: { events: SpaceEventItem[] }) {
  return (
    <section
      aria-label="List of changes"
      className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
    >
      <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        List of changes
      </h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {events.map((event, index) => {
            const latest = index === 0
            const actor = event.actorDeleted
              ? 'Deleted account'
              : event.actorName?.trim() || 'Unnamed'
            return (
              <li
                key={event.id}
                className={cn(
                  'rounded-lg border border-border/60 bg-card px-3 py-2 text-sm',
                  event.sinceLastVerified && 'border-l-4 border-l-primary/60',
                  latest && 'border-l-4 border-l-primary bg-primary/5 shadow-2xs',
                )}
              >
                {latest || event.sinceLastVerified ? (
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {latest ? (
                      <Badge className="rounded-full px-2 py-0.5 text-xs">Latest</Badge>
                    ) : null}
                    {event.sinceLastVerified ? (
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0.5 text-xs"
                      >
                        Since last verified
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                {describeSpaceEvent(event).map((line, lineIndex) => (
                  <p
                    key={lineIndex}
                    className="wrap-anywhere whitespace-pre-line text-foreground"
                  >
                    {line}
                  </p>
                ))}
                <p className="mt-1 text-xs text-muted-foreground">
                  {actor} ·{' '}
                  <time dateTime={event.createdAt}>
                    {formatDateTime(event.createdAt)}
                  </time>
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
