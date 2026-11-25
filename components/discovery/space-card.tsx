import { ArrowRight, Clock, MapPin, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { ReviewRating } from '@/components/review/review-rating'
import { PriceTierBadge } from './price-tier-badge'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import { isSpaceOpen24h } from '@/lib/data/spaces'
import { formatDescriptionSnippet } from '@/lib/space/format'
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
  const snippet = space.description ? formatDescriptionSnippet(space.description) : ''

  return (
    <article
      data-testid={`space-card-${space.id}`}
      data-space-id={space.id}
      aria-label={`${space.name}, ${space.address}`}
      onMouseEnter={() => onHover?.(space.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group relative flex flex-col justify-between rounded-3xl border border-border/60 bg-card text-card-foreground shadow-[0_2px_12px_-6px_rgba(23,60,45,0.08)] transition-all duration-200 outline-none',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_12px_28px_-10px_rgba(23,60,45,0.14)]',
        isActive && 'border-primary shadow-md ring-2 ring-primary',
        isHovered && !isActive && 'border-primary/45 bg-secondary/20',
        className,
      )}
    >
      <div className="p-6">
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
        {/* The address wraps instead of being clamped to one line, so none of it is
            cut off with text at 200% (#372, SRS §3.2.2). */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-words">{space.address}</span>
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
          <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{formatHours(space.opens_at, space.closes_at)}</span>
        </div>

        {/* Community Rating Summary (STORY-13, TSK-13.4, D-076) */}
        <div className="mt-2.5">
          <ReviewRating
            average={space.avg_overall}
            count={space.review_count}
            data-testid={`space-rating-${space.id}`}
          />
        </div>

        {/* Description Snippet: shortened by characters, not by a line clamp, so the
            same words show at every text size (#372). */}
        {snippet && (
          <p className="mt-3 text-sm leading-relaxed break-words text-muted-foreground">
            {snippet}
          </p>
        )}

        {/* Curated Amenity Tags */}
        {space.curated_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Amenities">
            {space.curated_tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
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
                className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer / CTA Action Link */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-3xl bg-secondary/45 px-6 py-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>Verified study space</span>
        </span>
        <Link
          href={`/spaces/${space.id}`}
          onFocus={() => onHover?.(space.id)}
          onBlur={() => onHover?.(null)}
          onClick={() => onSelect?.(space.id)}
          className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-all duration-200 outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <span>View Space</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
