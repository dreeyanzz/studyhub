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
    <section aria-labelledby="availability-overview-heading" className="space-y-3">
      <h2
        id="availability-overview-heading"
        className="text-base font-semibold text-foreground"
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
                className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 text-xs shadow-xs sm:text-sm ${
                  hasAvailable
                    ? 'border-border bg-card text-foreground'
                    : 'border-border/60 bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-foreground">{zone.zoneName}:</span>
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
                      className="text-muted-foreground"
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
          className="border-muted-foreground/20 bg-muted/30"
        >
          <Info className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>No units available</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              No units are currently Available. Check back later or{' '}
              <Link
                href={DISCOVERY_HREF}
                className="inline-flex min-h-12 items-center rounded-xs font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
