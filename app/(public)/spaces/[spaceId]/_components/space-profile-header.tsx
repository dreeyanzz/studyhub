import { Clock, MapPin } from 'lucide-react'

import { PriceTierBadge } from '@/components/discovery/price-tier-badge'
import { Badge } from '@/components/ui/badge'
import { formatPeso } from '@/lib/reservations/format'
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
  /** Reservation hold fee in centavos (D-049), shown up front before a unit is picked. */
  holdFeeAmount?: number | null
}

/**
 * Public Space profile header section (STORY-11 design §0, §3 Screen 1, FR-1.3, D-027, D-048).
 * Renders Space name (h1), address with map pin icon, operating hours with open/closed status badge,
 * curated price tier badge (₱ / ₱₱ / ₱₱₱ / Free), upfront hold fee when open for holds, and description.
 */
export function SpaceProfileHeader({
  space,
  operatingStatus,
  holdFeeAmount = null,
}: SpaceProfileHeaderProps) {
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
        <PriceTierBadge tier={space.price_tier} showSymbol />
        {typeof holdFeeAmount === 'number' && (
          <Badge
            variant="secondary"
            className="h-auto min-h-6 px-2 py-0.5 text-xs font-medium whitespace-normal"
          >
            Hold fee: {formatPeso(holdFeeAmount)}
          </Badge>
        )}
      </div>

      {space.description && (
        <p className="text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
          {space.description}
        </p>
      )}
    </header>
  )
}
