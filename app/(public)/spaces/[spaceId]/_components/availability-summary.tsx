import Link from 'next/link'
import { Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FreshnessBadge } from '@/components/space/freshness-badge'
import type { SpaceAvailabilitySummary } from '@/lib/space/availability'

const DISCOVERY_HREF = '/spaces'

export interface AvailabilitySummaryProps {
  summary: SpaceAvailabilitySummary
}

/**
 * Availability Overview Banner (STORY-11 design §3 Screen 1, TSK-11.5, D-051).
 *
 * Prominent banner above seat map displaying zone availability chips with available
 * vs total unit counts, and the oldest-available "Host-updated · X min ago" timestamp (D-051).
 *
 * Displays empty state banner when no units are Available across the entire Space (seeker-profile-no-available-unit).
 */
export function AvailabilitySummary({ summary }: AvailabilitySummaryProps) {
  return (
    <section
      aria-labelledby="availability-overview-heading"
      className="min-w-0 space-y-3.5 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
    >
      <h2
        id="availability-overview-heading"
        className="font-heading text-base font-semibold text-foreground"
      >
        Current Availability
      </h2>

      {/* Zone availability breakdown */}
      {summary.zones.length > 0 && (
        <div
          className="flex flex-wrap gap-2.5"
          role="list"
          aria-label="Zone availability breakdown"
        >
          {summary.zones.map((zone) => {
            const hasAvailable = zone.availableUnits > 0

            return (
              <div
                key={zone.zoneId}
                role="listitem"
                className={`flex max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs shadow-2xs sm:text-sm ${
                  hasAvailable
                    ? 'border-primary/25 bg-primary/5 text-foreground'
                    : 'border-border/70 bg-muted/35 text-muted-foreground'
                }`}
              >
                <span className="min-w-0 font-semibold wrap-anywhere text-foreground">
                  {zone.zoneName}:
                </span>
                <span
                  className={
                    hasAvailable ? 'font-medium text-emerald-700' : 'font-medium'
                  }
                >
                  {zone.availableUnits} available
                </span>
                <span className="text-muted-foreground" aria-hidden="true">
                  ·
                </span>
                <span className="text-muted-foreground">{zone.totalUnits} total</span>
                {hasAvailable && zone.oldestAvailableHostUpdatedAt ? (
                  <>
                    <span className="text-muted-foreground" aria-hidden="true">
                      ·
                    </span>
                    <FreshnessBadge
                      date={zone.oldestAvailableHostUpdatedAt}
                      className="min-w-0 wrap-anywhere text-muted-foreground"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium text-amber-800">No available units</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* All-occupied alert notice */}
      {summary.availableUnits === 0 && (
        <Alert
          data-testid="seeker-profile-no-available-unit"
          variant="default"
          className="rounded-2xl border-border/80 bg-muted/30 shadow-2xs"
        >
          <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <AlertTitle>No units available</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              No units are currently Available. Check back later or{' '}
              <Link
                href={DISCOVERY_HREF}
                className="inline-flex min-h-12 items-center rounded-xs font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                explore other spaces
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
