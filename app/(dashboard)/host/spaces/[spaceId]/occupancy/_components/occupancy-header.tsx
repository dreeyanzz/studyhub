import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { SeatMapZone } from '@/lib/seat-map/grid'
import { cn } from '@/lib/utils'

import { RelativeTime } from './relative-time'

interface OccupancyHeaderProps {
  space: {
    id: string
    name: string
  }
  zones: SeatMapZone[]
}

/**
 * Server Component header for the Host occupancy management screen (STORY-12 design §3).
 *
 * Displays space title, back link to /host, total vs occupied units counter,
 * and latest space-wide freshness badge.
 */
export function OccupancyHeader({ space, zones }: OccupancyHeaderProps) {
  const allUnits = zones.flatMap((z) => z.units)
  const totalUnits = allUnits.length
  const occupiedUnits = allUnits.filter((u) => u.seatState === 'occupied').length

  // Find most recent host_updated_at across all units
  let latestHostUpdatedAt: string | null = null
  for (const unit of allUnits) {
    if (unit.hostUpdatedAt) {
      if (
        !latestHostUpdatedAt ||
        new Date(unit.hostUpdatedAt).getTime() > new Date(latestHostUpdatedAt).getTime()
      ) {
        latestHostUpdatedAt = unit.hostUpdatedAt
      }
    }
  }

  return (
    <header className="space-y-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link
              href="/host"
              className="inline-flex min-h-12 min-w-12 items-center underline-offset-4 hover:underline"
            >
              Your Spaces
            </Link>
            <span aria-hidden="true"> /</span>
          </li>
          <li className="wrap-anywhere">
            {space.name}
            <span aria-hidden="true"> /</span>
          </li>
          <li aria-current="page">Occupancy</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/host"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-auto min-h-12 max-w-full min-w-12 gap-2 rounded-full border-border/80 bg-card px-4 py-2 text-sm font-medium whitespace-normal shadow-2xs hover:border-primary/45 hover:bg-surface-subtle',
            )}
          >
            <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Back to Spaces
          </Link>
          <Link
            href={`/host/spaces/${space.id}/check-in`}
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-auto min-h-12 max-w-full min-w-12 gap-2 rounded-full px-5 py-2 text-sm font-medium whitespace-normal',
            )}
          >
            Check-in desk
          </Link>
        </div>

        {/* The Badge primitive keeps its text on one line; these may wrap, so they fit
            a 360 px screen at 200% text (design §3, Accessibility: Responsive design). */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="h-auto max-w-full rounded-full px-3.5 py-1 text-sm font-medium whitespace-normal"
          >
            {occupiedUnits} / {totalUnits} units occupied
          </Badge>
          {latestHostUpdatedAt ? (
            <Badge
              variant="outline"
              className="h-auto max-w-full flex-wrap rounded-full border-border/80 bg-card px-3.5 py-1 text-sm font-medium whitespace-normal"
            >
              Host-updated · <RelativeTime date={latestHostUpdatedAt} className="ml-1" />
            </Badge>
          ) : null}
        </div>
      </div>

      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight wrap-anywhere text-foreground sm:text-4xl">
          {space.name} Occupancy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage seat states and walk-ins. Tap any state to update unit occupancy.
        </p>
      </div>
    </header>
  )
}
