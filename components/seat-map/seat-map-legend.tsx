import type { ReactNode } from 'react'
import {
  Armchair,
  PersonStanding,
  DoorClosed,
  CheckCircle,
  Hourglass,
  Clock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared seat map legend (STORY-07, TSK-07.4, FR-3.1).
 *
 * Explains every icon and seat state in words so the interface never relies on color alone (D-031).
 * Rendered once above the zones by SeatMapGrid.
 */
export function SeatMapLegend({
  className,
}: {
  className?: string
} = {}): ReactNode {
  return (
    <div
      role="region"
      aria-label="Seat map legend"
      className={cn(
        'rounded-md border border-border bg-card p-3 text-xs text-foreground',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <span className="font-semibold text-foreground">States:</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-950 dark:text-emerald-200">
              <CheckCircle
                className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>Available</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-purple-950 dark:text-purple-200">
              <Hourglass
                className="size-3.5 shrink-0 text-purple-700 dark:text-purple-400"
                aria-hidden="true"
              />
              <span>Pending Payment</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue-950 dark:text-blue-200">
              <Clock
                className="size-3.5 shrink-0 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>Reserved</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-950 dark:text-amber-200">
              <User
                className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <span>Occupied</span>
            </span>
          </div>
        </div>
        <div className="border-t border-border/60 pt-2">
          <span className="font-semibold text-foreground">Types:</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Armchair
                className="size-3.5 shrink-0 text-foreground"
                aria-hidden="true"
              />
              <span>Seat</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PersonStanding
                className="size-3.5 shrink-0 text-foreground"
                aria-hidden="true"
              />
              <span>Standing Desk</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DoorClosed
                className="size-3.5 shrink-0 text-foreground"
                aria-hidden="true"
              />
              <span>Room</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
