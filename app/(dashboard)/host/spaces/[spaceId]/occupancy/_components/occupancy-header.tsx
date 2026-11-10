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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/host"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-12 min-w-12 gap-2 px-4 text-sm font-medium',
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Spaces
        </Link>

        {/* The Badge primitive is one fixed-height line; these may wrap, so they fit a
            360 px screen at 200% text (design §3, Accessibility: Responsive design). */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="h-auto max-w-full px-3 py-1 text-sm font-medium whitespace-normal"
          >
            {occupiedUnits} / {totalUnits} units occupied
          </Badge>
          {latestHostUpdatedAt ? (
            <Badge
              variant="outline"
              className="h-auto max-w-full flex-wrap px-3 py-1 text-sm font-medium whitespace-normal"
            >
              Host-updated · <RelativeTime date={latestHostUpdatedAt} className="ml-1" />
            </Badge>
          ) : null}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {space.name} Occupancy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage seat states and walk-ins. Tap any state to update unit occupancy.
        </p>
      </div>
    </header>
  )
}
