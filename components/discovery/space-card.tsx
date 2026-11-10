import { Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { PriceTierBadge } from './price-tier-badge'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import { isSpaceOpen24h } from '@/lib/data/spaces'
import { cn } from '@/lib/utils'

interface SpaceCardProps {
  space: VerifiedSpaceSearchResult
  isActive?: boolean
  isHovered?: boolean
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
  className?: string
}

/**
 * Format time from "HH:mm:ss" or "HH:mm" to display string.
 */
function formatHours(opensAt: string, closesAt: string): string {
  if (isSpaceOpen24h(opensAt, closesAt)) {
    return 'Open 24 Hours'
  }
  const open = opensAt.slice(0, 5)
  const close = closesAt.slice(0, 5)
  return `${open} - ${close}`
}

/**
 * SpaceCard displays a study space in the synchronized discovery list view (STORY-08, FR-1.1, D-003).
 * Supports bidirectional hover and focus synchronization with Leaflet map markers.
 */
export function SpaceCard({
  space,
  isActive = false,
  isHovered = false,
  onHover,
  onSelect,
  className,
}: SpaceCardProps) {
  return (
    <article
      data-testid={`space-card-${space.id}`}
      data-space-id={space.id}
      aria-label={`${space.name}, ${space.address}`}
      onMouseEnter={() => onHover?.(space.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border bg-card p-5 text-card-foreground shadow-xs transition-all duration-150 outline-none',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary hover:border-primary/60 hover:shadow-md',
        isActive && 'border-primary shadow-md ring-2 ring-primary',
        isHovered && !isActive && 'border-primary/50 bg-accent/20',
        className,
      )}
    >
      <div>
        {/* Header: Title + Price Tier */}
        {/* Wraps, so at 200% text the badge drops below the name instead of past the edge. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 font-heading text-lg font-bold tracking-tight break-words text-foreground group-hover:text-primary">
            <Link
              href={`/spaces/${space.id}`}
              onFocus={() => onHover?.(space.id)}
              onBlur={() => onHover?.(null)}
              onClick={() => onSelect?.(space.id)}
              className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {space.name}
            </Link>
          </h2>
          <PriceTierBadge tier={space.price_tier} showSymbol />
        </div>

        {/* Address and Distance */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="line-clamp-1">{space.address}</span>
          </div>
          {space.distance_km !== null && (
            <span
              data-testid={`distance-${space.id}`}
              className="inline-flex items-center font-medium text-primary"
            >
              {space.distance_km} km away
            </span>
          )}
        </div>

        {/* Operating Hours */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{formatHours(space.opens_at, space.closes_at)}</span>
        </div>

        {/* Description Snippet */}
        {space.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {space.description}
          </p>
        )}

        {/* Curated Amenity Tags */}
        {space.curated_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Amenities">
            {space.curated_tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* Custom Display Tags (FR-1.3, D-006) */}
        {space.custom_tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Host tags">
            {space.custom_tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer / CTA Action Link */}
      <div className="mt-5 flex items-center justify-between border-t pt-3">
        <span className="text-xs text-muted-foreground">Verified study space</span>
        <Link
          href={`/spaces/${space.id}`}
          onFocus={() => onHover?.(space.id)}
          onBlur={() => onHover?.(null)}
          onClick={() => onSelect?.(space.id)}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View Space
        </Link>
      </div>
    </article>
  )
}
