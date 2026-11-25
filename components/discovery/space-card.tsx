import Image from 'next/image'
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
 * Uses an atmospheric frosted-glass halo card with an inset rounded visual showcase, clean
 * center identity block, and a dark frosted bottom stats + CTA bar.
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
  const hoursLabel = formatHours(space.opens_at, space.closes_at)

  return (
    <article
      data-testid={`space-card-${space.id}`}
      data-space-id={space.id}
      aria-label={`${space.name}, ${space.address}`}
      onMouseEnter={() => onHover?.(space.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group relative rounded-[2rem] border border-white/80 bg-gradient-to-br from-[#dce7da] via-[#eef2e9] to-[#d2e0d1] p-3.5 text-card-foreground shadow-[0_16px_36px_-18px_rgba(23,60,45,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 outline-none sm:p-4',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_22px_42px_-16px_rgba(23,60,45,0.26)]',
        isActive && 'border-primary shadow-md ring-2 ring-primary',
        isHovered && !isActive && 'border-primary/50',
        className,
      )}
    >
      {/* Subtle blurred atmospheric photo bleed behind the frosted glass shell when cover photo exists */}
      {space.cover_photo_url && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
        >
          <Image
            src={space.cover_photo_url}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="rounded-[2rem] object-cover opacity-45 blur-md"
          />
          <div className="absolute inset-0 rounded-[2rem] bg-white/55 backdrop-blur-md" />
        </div>
      )}

      <div className="relative flex flex-col gap-4">
        {/* Top Inset Rounded Visual Showcase (cover photo) or Soft Sage Badge Strip */}
        {space.cover_photo_url ? (
          <div className="relative aspect-[16/9] rounded-[1.35rem] bg-muted shadow-xs">
            <Image
              src={space.cover_photo_url}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="rounded-[1.35rem] object-cover"
              aria-hidden="true"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[1.35rem] bg-gradient-to-b from-black/30 to-transparent"
            />
            <div className="relative flex flex-wrap items-start justify-between gap-2 p-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/95 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                <ShieldCheck
                  className="size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>Verified study space</span>
              </span>
              <PriceTierBadge tier={space.price_tier} showSymbol className="shadow-xs" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/15 bg-secondary/55 px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck
                className="size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>Verified study space</span>
            </span>
            <PriceTierBadge tier={space.price_tier} showSymbol />
          </div>
        )}

        {/* Middle Frosted Space Identity Block */}
        <div className="space-y-2.5 px-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
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

            <ReviewRating
              average={space.avg_overall}
              count={space.review_count}
              data-testid={`space-rating-${space.id}`}
              className="rounded-full bg-white/85 px-2.5 py-0.5 text-foreground backdrop-blur-xs"
            />
          </div>

          {/* Address and Distance (wraps cleanly at 200% zoom, #372) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
            <div className="flex min-w-0 items-start gap-1.5">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{space.address}</span>
            </div>
            {space.distance_km !== null && (
              <span
                data-testid={`distance-${space.id}`}
                className="inline-flex items-center font-semibold text-primary"
              >
                {space.distance_km} km away
              </span>
            )}
          </div>

          {/* Description Snippet: shortened by characters, never line-clamped (#372) */}
          {snippet && (
            <p className="text-sm leading-relaxed break-words text-foreground">
              {snippet}
            </p>
          )}

          {/* Curated Amenity Tags */}
          {space.curated_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Amenities">
              {space.curated_tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-white/90 px-2.5 py-0.5 text-xs font-medium text-primary backdrop-blur-xs"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Custom Display Tags (FR-1.3, D-006) */}
          {space.custom_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Host tags">
              {space.custom_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-foreground/15 bg-white/85 px-2.5 py-0.5 text-xs text-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Dark Frosted Glass Metrics + Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/15 bg-[#153528]/92 px-4 py-3 text-white backdrop-blur-md">
          <div className="min-w-0 space-y-0.5">
            <span className="block text-xs text-white/85">Operating hours</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Clock className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span>{hoursLabel}</span>
            </div>
          </div>

          <Link
            href={`/spaces/${space.id}`}
            onFocus={() => onHover?.(space.id)}
            onBlur={() => onHover?.(null)}
            onClick={() => onSelect?.(space.id)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full bg-[#f0c95c] px-5 py-2 text-sm font-semibold text-foreground shadow-xs transition-all duration-200 outline-none hover:bg-[#e5ba45] focus-visible:ring-2 focus-visible:ring-[#f0c95c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#153528] active:scale-[0.98]"
          >
            <span>View Space</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
