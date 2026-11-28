import Image from 'next/image'
import { ArrowRight, Clock, MapPin, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { ReviewRating } from '@/components/review/review-rating'
import { PriceTierBadge } from './price-tier-badge'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import {
  getManilaMinutesFromDate,
  isSpaceOpen24h,
  isSpaceOpenNow,
} from '@/lib/data/spaces'
import { formatDescriptionSnippet } from '@/lib/space/format'
import { cn } from '@/lib/utils'

interface SpaceCardProps {
  space: VerifiedSpaceSearchResult
  isActive?: boolean
  isHovered?: boolean
  /** Optional override for deterministic rendering/tests; defaults to live Manila time. */
  isOpen?: boolean
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
 * Uses a luminous botanical bento card with frosted-glass pills, clear D-006 tag
 * hierarchy, and an airy footer with operating hours and emerald CTA.
 */
export function SpaceCard({
  space,
  isActive = false,
  isHovered = false,
  isOpen,
  onHover,
  onSelect,
  className,
}: SpaceCardProps) {
  const snippet = space.description ? formatDescriptionSnippet(space.description) : ''
  const hoursLabel = formatHours(space.opens_at, space.closes_at)
  const openNow =
    isOpen ??
    isSpaceOpenNow(space.opens_at, space.closes_at, getManilaMinutesFromDate(new Date()))

  return (
    <article
      data-testid={`space-card-${space.id}`}
      data-space-id={space.id}
      aria-label={`${space.name}, ${space.address}`}
      onMouseEnter={() => onHover?.(space.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group relative rounded-3xl border border-border/80 bg-card p-4 text-card-foreground shadow-card transition-all duration-200 outline-none',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover',
        isActive && 'border-primary shadow-card-hover ring-2 ring-primary',
        isHovered && !isActive && 'border-primary/45',
        className,
      )}
    >
      <div className="relative flex flex-col gap-3.5">
        {/* Top Luminous Media Frame or Soft Tinted Verified Bar */}
        {space.cover_photo_url ? (
          <div className="relative aspect-[16/9] rounded-2xl bg-surface-subtle">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
            >
              <Image
                src={space.cover_photo_url}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-forest-deep/45 via-forest-deep/15 to-transparent" />
            </div>
            <div className="relative flex flex-wrap items-start justify-between gap-2 p-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/92 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                <ShieldCheck
                  className="size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>Verified Space</span>
              </span>
              <PriceTierBadge tier={space.price_tier} showSymbol className="shadow-xs" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-subtle/90 px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck
                className="size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>Verified Space</span>
            </span>
            <PriceTierBadge tier={space.price_tier} showSymbol />
          </div>
        )}

        {/* Middle Space Identity Block */}
        <div className="space-y-2.5 px-0.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 font-heading text-xl leading-snug font-bold tracking-[-0.02em] break-words text-foreground transition-colors group-hover:text-primary sm:text-2xl">
              <Link
                href={`/spaces/${space.id}`}
                onFocus={() => onHover?.(space.id)}
                onBlur={() => onHover?.(null)}
                onClick={() => onSelect?.(space.id)}
                className="decoration-primary/40 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {space.name}
              </Link>
            </h2>

            <ReviewRating
              average={space.avg_overall}
              count={space.review_count}
              data-testid={`space-rating-${space.id}`}
              className="rounded-full border border-border bg-surface-subtle px-2.5 py-0.5 text-xs text-foreground"
            />
          </div>

          {/* Address and Distance (wraps cleanly at 200% zoom, #372) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
            <p className="text-sm leading-relaxed break-words text-foreground/85">
              {snippet}
            </p>
          )}

          {/* Curated Amenity Tags (FR-1.3, D-006) */}
          {space.curated_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Amenities">
              {space.curated_tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Custom Display Tags — distinct quiet neutral style (FR-1.3, D-006) */}
          {space.custom_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Host tags">
              {space.custom_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-dashed border-border bg-surface-subtle px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clean Daylight Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-3.5">
          <div className="min-w-0 space-y-0.5">
            <span className="block text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Operating hours
            </span>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-medium text-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>{hoursLabel}</span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[11px] font-semibold',
                  openNow
                    ? 'border-primary/20 bg-accent text-accent-foreground'
                    : 'border-border bg-surface-subtle text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    openNow ? 'bg-primary' : 'bg-muted-foreground',
                  )}
                />
                <span>{openNow ? 'Open now' : 'Closed'}</span>
              </span>
            </div>
          </div>

          <Link
            href={`/spaces/${space.id}`}
            onFocus={() => onHover?.(space.id)}
            onBlur={() => onHover?.(null)}
            onClick={() => onSelect?.(space.id)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 outline-none hover:from-primary-hover hover:to-forest-deep hover:shadow-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <span>View Space</span>
            <ArrowRight
              className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  )
}
