import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Compass, MapPin, ShieldCheck } from 'lucide-react'

import { PriceTierBadge } from '@/components/discovery/price-tier-badge'
import { ReviewRating } from '@/components/review/review-rating'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import { computeOperatingStatus, formatOpeningHours } from '@/lib/space/format'
import { cn } from '@/lib/utils'

interface FeaturedSpacesCardProps {
  spaces: VerifiedSpaceSearchResult[]
  totalCount: number
  openNowCount: number
}

/**
 * Curated shelf of real Administrator-verified Spaces on the Seeker Dashboard.
 * Surfaces currently open Spaces first with cover photos, hours, tags, ratings,
 * and one-tap navigation to each Space's seat map.
 */
export function FeaturedSpacesCard({
  spaces,
  totalCount,
  openNowCount,
}: FeaturedSpacesCardProps) {
  return (
    <section
      aria-labelledby="featured-spaces-heading"
      className="space-y-5 rounded-3xl border border-border/80 bg-card p-6 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0 space-y-1">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5 text-primary" />
            <span>Verified Map Directory</span>
          </p>
          <h2
            id="featured-spaces-heading"
            className="font-heading text-2xl font-bold tracking-[-0.025em] text-foreground"
          >
            Explore Verified Spaces
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? 'Administrator-verified study Spaces will appear here as soon as they publish.'
              : `${openNowCount} of ${totalCount} verified ${totalCount === 1 ? 'Space is' : 'Spaces are'} open right now across Metro Cebu.`}
          </p>
        </div>

        <Link
          href="/spaces"
          className="inline-flex min-h-12 min-w-12 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm font-semibold whitespace-normal text-foreground transition-all hover:border-primary/40 hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span>Browse all</span>
          <ArrowRight aria-hidden="true" className="size-4 text-primary" />
        </Link>
      </div>

      {spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-subtle/75 px-6 py-8 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Compass aria-hidden="true" className="size-5" />
          </div>
          <p className="font-heading text-lg font-semibold text-foreground">
            No verified Spaces on the map yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Check the discovery map anytime to see newly verified cafés and study halls.
          </p>
        </div>
      ) : (
        <div
          className={cn('grid grid-cols-1 gap-4', spaces.length > 1 && 'sm:grid-cols-2')}
        >
          {spaces.map((space) => {
            const status = computeOperatingStatus(space.opens_at, space.closes_at)
            const hoursLabel = formatOpeningHours(space.opens_at, space.closes_at)
            const visibleTags = space.curated_tags.slice(0, 3)
            const isSingleFeature = spaces.length === 1

            return (
              <article
                key={space.id}
                className={cn(
                  'group min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-surface-subtle/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:shadow-card-hover',
                  isSingleFeature
                    ? 'grid grid-cols-1 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
                    : 'flex flex-col justify-between',
                )}
              >
                {/* Cover image or authentic Worq botanical emerald-brass pattern */}
                <div
                  className={cn(
                    'relative w-full overflow-hidden bg-forest-deep',
                    isSingleFeature ? 'min-h-44 sm:h-full' : 'h-32',
                  )}
                >
                  {space.cover_photo_url ? (
                    <>
                      <Image
                        src={space.cover_photo_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 35vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-forest-deep/65 via-forest-deep/20 to-forest-deep/35"
                      />
                    </>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[radial-gradient(circle_at_88%_16%,rgba(231,203,131,0.3),transparent_48%),radial-gradient(circle_at_14%_86%,rgba(46,117,82,0.45),transparent_55%),linear-gradient(135deg,var(--primary)_0%,var(--forest-mid)_58%,var(--forest-deep)_100%)]"
                    />
                  )}

                  <div className="relative flex flex-wrap items-start justify-between gap-1.5 p-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border border-white/85 bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold shadow-2xs backdrop-blur-md',
                        status.isOpen ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          status.isOpen ? 'bg-primary' : 'bg-muted-foreground',
                        )}
                      />
                      <span>{status.isOpen ? 'Open now' : 'Closed'}</span>
                    </span>
                    <PriceTierBadge
                      tier={space.price_tier}
                      showSymbol
                      className="shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  {/* Card body */}
                  <div className="space-y-2.5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 font-heading text-lg leading-snug font-bold tracking-[-0.02em] break-words text-foreground group-hover:text-primary">
                        {space.name}
                      </h3>
                      <ReviewRating
                        average={space.avg_overall}
                        count={space.review_count}
                        className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                      />
                    </div>

                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                      <MapPin
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                      />
                      <span className="min-w-0 break-words">{space.address}</span>
                    </p>

                    <p className="flex items-center gap-1.5 font-mono text-xs font-medium text-foreground/85">
                      <Clock
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-primary"
                      />
                      <span>{hoursLabel}</span>
                    </p>

                    {visibleTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full border border-primary/15 bg-accent/80 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground"
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action footer */}
                  <div className="border-t border-border/70 px-4 py-3">
                    <Link
                      href={`/spaces/${space.id}`}
                      className="inline-flex min-h-12 w-full min-w-12 items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-4 py-2 text-xs font-semibold whitespace-normal text-white shadow-2xs transition-all hover:from-primary-hover hover:to-forest-deep focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <span>Inspect seat map</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
