import { Clock, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatOpeningHours, type SpaceOperatingStatus } from '@/lib/space/format'
import { cn } from '@/lib/utils'

export interface SpaceProfileHeaderProps {
  space: {
    id: string
    name: string
    description: string | null
    address: string
    opens_at: string
    closes_at: string
  }
  operatingStatus: SpaceOperatingStatus
}

/**
 * Public Space profile header section (STORY-11 design §3 Screen 1, FR-1.3, D-027, D-048).
 * Renders Space name (h1), address with map pin icon, operating hours with open/closed status badge,
 * and description.
 */
export function SpaceProfileHeader({ space, operatingStatus }: SpaceProfileHeaderProps) {
  const hoursText = formatOpeningHours(space.opens_at, space.closes_at)

  return (
    <header className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight break-words text-foreground sm:text-3xl">
          {space.name}
        </h1>
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm wrap-anywhere text-muted-foreground">
          <MapPin
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span>{space.address}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Hours: {hoursText}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'h-auto min-h-6 px-2 py-0.5 text-xs font-medium break-words whitespace-normal',
            operatingStatus.isOpen
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-border bg-muted/60 text-muted-foreground',
          )}
        >
          {operatingStatus.displayText}
        </Badge>
      </div>

      {space.description && (
        <p className="text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
          {space.description}
        </p>
      )}
    </header>
  )
}
