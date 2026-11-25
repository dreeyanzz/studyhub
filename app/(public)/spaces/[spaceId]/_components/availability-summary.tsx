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
      className="h-full min-w-0 space-y-4 rounded-3xl border border-primary/15 bg-gradient-to-br from-secondary/75 via-secondary/45 to-muted/80 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="availability-overview-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Current Availability
        </h2>

        {summary.totalUnits > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-2xs"
          >
            <span
              className={`size-2 rounded-full ${
                summary.availableUnits > 0 ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            />
            {summary.availableUnits} / {summary.totalUnits} open
          </span>
        )}
      </div>

      {/* Zone availability breakdown */}
      {summary.zones.length > 0 && (
        <div className="space-y-2.5" role="list" aria-label="Zone availability breakdown">
          {summary.zones.map((zone) => {
            const hasAvailable = zone.availableUnits > 0
            const openRatio =
              zone.totalUnits > 0
                ? Math.round((zone.availableUnits / zone.totalUnits) * 100)
                : 0

            return (
              <div
                key={zone.zoneId}
                role="listitem"
                className={`max-w-full min-w-0 space-y-2 rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                  hasAvailable
                    ? 'bg-card text-foreground shadow-[0_1px_4px_rgba(23,60,45,0.06)]'
                    : 'bg-background/85 text-muted-foreground'
                }`}
              >
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${
                      hasAvailable ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
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
                      <span className="font-medium text-amber-800">
                        No available units
                      </span>
                    </>
                  )}
                </div>

                {/* Visual open-capacity meter for quick scanning (non-semantic; counts above carry full info) */}
                {zone.totalUnits > 0 && (
                  <div
                    aria-hidden="true"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        hasAvailable ? 'bg-primary' : 'bg-amber-500/40'
                      }`}
                      style={{ width: `${openRatio}%` }}
                    />
                  </div>
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
          className="rounded-2xl border-0 bg-card"
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
