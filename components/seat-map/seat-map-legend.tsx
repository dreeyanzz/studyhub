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
 * Rendered once above the zones by SeatMapGrid. Its state colors match SeatMapTile's light
 * palette, with no `dark:` variants, because the app ships light mode only (D-031).
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
        'rounded-2xl border border-border/80 bg-surface-subtle/85 p-3.5 text-xs text-foreground shadow-2xs',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div>
          <span className="font-semibold tracking-wide text-foreground uppercase">
            States:
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-950">
              <CheckCircle
                className="size-3.5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>Available</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-600/25 bg-purple-50 px-2.5 py-0.5 font-medium text-purple-950">
              <Hourglass
                className="size-3.5 shrink-0 text-purple-700"
                aria-hidden="true"
              />
              <span>Pending Payment</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-600/25 bg-blue-50 px-2.5 py-0.5 font-medium text-blue-950">
              <Clock className="size-3.5 shrink-0 text-blue-700" aria-hidden="true" />
              <span>Reserved</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/25 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-950">
              <User className="size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
              <span>Occupied</span>
            </span>
          </div>
        </div>
        <div className="border-t border-border/70 pt-2.5">
          <span className="font-semibold tracking-wide text-foreground uppercase">
            Types:
          </span>
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
