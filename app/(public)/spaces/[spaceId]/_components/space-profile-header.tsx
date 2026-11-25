import { Clock, MapPin } from 'lucide-react'

import { PriceTierBadge } from '@/components/discovery/price-tier-badge'
import { Badge } from '@/components/ui/badge'
import { formatOpeningHours, type SpaceOperatingStatus } from '@/lib/space/format'
import { cn } from '@/lib/utils'
import type { PriceTier } from '@/lib/validation/search'

export interface SpaceProfileHeaderProps {
  space: {
    id: string
    name: string
    description: string | null
    address: string
    opens_at: string
    closes_at: string
    price_tier: PriceTier
  }
  operatingStatus: SpaceOperatingStatus
}

/**
 * Public Space profile header section (STORY-11 design §0, §3 Screen 1, FR-1.3, D-027, D-048).
 * Renders Space name (h1), address with map pin icon, operating hours with open/closed status badge,
 * curated price tier badge (₱ / ₱₱ / ₱₱₱ / Free), and description.
 */
export function SpaceProfileHeader({ space, operatingStatus }: SpaceProfileHeaderProps) {
  const hoursText = formatOpeningHours(space.opens_at, space.closes_at)

  return (
    <header className="flex h-full flex-col justify-between gap-5 rounded-3xl bg-secondary/75 p-6 sm:p-8">
      <div className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'h-auto min-h-6 rounded-full border-transparent px-3 py-0.5 text-xs font-medium break-words whitespace-normal',
              operatingStatus.isOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground',
            )}
          >
            {operatingStatus.displayText}
          </Badge>
          <PriceTierBadge tier={space.price_tier} showSymbol />
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight break-words text-foreground sm:text-3xl">
            {space.name}
          </h1>
          <div className="mt-2 flex min-w-0 items-start gap-1.5 text-sm wrap-anywhere text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{space.address}</span>
          </div>
        </div>

        {space.description && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-line text-foreground/85">
            {space.description}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2.5 border-t border-border/60 pt-4 text-sm text-foreground">
        <div className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 font-medium">
          <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Hours: {hoursText}</span>
        </div>
      </div>
    </header>
  )
}
