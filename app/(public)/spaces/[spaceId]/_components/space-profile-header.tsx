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
    <header className="relative flex h-full flex-col justify-between gap-6 rounded-3xl border border-white/75 bg-white/82 p-6 shadow-[0_18px_40px_-16px_rgba(10,30,20,0.38),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl sm:p-7">
      <div className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'h-auto min-h-6 rounded-full px-3 py-0.5 text-xs font-medium break-words whitespace-normal',
              operatingStatus.isOpen
                ? 'border-transparent bg-primary text-primary-foreground shadow-xs'
                : 'border-border/70 bg-white/90 text-muted-foreground',
            )}
          >
            {operatingStatus.displayText}
          </Badge>
          <PriceTierBadge tier={space.price_tier} showSymbol />
        </div>

        <div className="space-y-2.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight break-words text-foreground sm:text-3xl">
            {space.name}
          </h1>

          {space.description && (
            <p className="text-sm leading-relaxed break-words whitespace-pre-line text-foreground/85">
              {space.description}
            </p>
          )}
        </div>
      </div>

      {/* Frosted quick-facts tray grouping Location and Hours for instant scanning */}
      <div className="space-y-2.5 rounded-2xl border border-white/90 bg-white/85 p-3.5 shadow-2xs backdrop-blur-md">
        <div className="flex min-w-0 items-start gap-2.5 text-sm wrap-anywhere text-foreground/85">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
          >
            <MapPin className="size-3.5" />
          </span>
          <span className="min-w-0 pt-0.5">{space.address}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2.5 border-t border-border/50 pt-2.5 text-sm font-medium text-foreground">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
          >
            <Clock className="size-3.5" />
          </span>
          <span className="min-w-0 wrap-anywhere">Hours: {hoursText}</span>
        </div>
      </div>
    </header>
  )
}
