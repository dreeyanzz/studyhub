import Image from 'next/image'
import { Armchair, Clock, MapPin, ShieldCheck, Users } from 'lucide-react'

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
  /** Optional cover photo URL rendered full-bleed behind the progressive frosted glass scrim. */
  coverPhotoUrl?: string | null
  /** Optional live seat availability counts displayed in the frosted stat columns. */
  availability?: {
    availableUnits: number
    totalUnits: number
  }
}

/**
 * Public Space profile header section (STORY-11 design §0, §3 Screen 1, FR-1.3, D-027, D-048).
 * Full-bleed atmospheric info card with top-left floating badges, progressive frosted-glass
 * blur + deep forest-green scrim over the lower section, and scannable location/hours footer.
 */
export function SpaceProfileHeader({
  space,
  operatingStatus,
  holdFeeAmount = null,
  coverPhotoUrl,
  availability,
}: SpaceProfileHeaderProps) {
  const hoursText = formatOpeningHours(space.opens_at, space.closes_at)

  return (
    <header
      className={cn(
        'relative flex h-full flex-col justify-between rounded-3xl bg-forest-deep text-white shadow-hero',
        coverPhotoUrl
          ? 'min-h-[380px] sm:min-h-[420px]'
          : 'min-h-[260px] sm:min-h-[290px]',
      )}
    >
      {/* Full-bleed cover photo or luminous midnight aurora fallback */}
      {coverPhotoUrl ? (
        <Image
          src={coverPhotoUrl}
          alt=""
          fill
          preload
          sizes="(max-width: 768px) 100vw, 45vw"
          className="rounded-3xl object-cover"
          aria-hidden="true"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_88%_14%,rgba(231,203,131,0.26),transparent_44%),radial-gradient(circle_at_15%_85%,rgba(46,117,82,0.38),transparent_52%),linear-gradient(145deg,var(--primary)_0%,var(--forest-mid)_50%,var(--forest-deep)_100%)]"
        />
      )}

      {/* Subtle top scrim so floating badges stay crisp without dimming the room */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-forest-deep/40 to-transparent"
      />

      {/* Gentle progressive frosted-glass blur rising from bottom so the photo behind stays clearly visible */}
      {coverPhotoUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] rounded-b-3xl [mask-image:linear-gradient(to_top,black_38%,transparent_100%)] backdrop-blur-md"
        />
      )}

      {/* Translucent midnight cosmos scrim preserving photo visibility and WCAG AA/AAA text contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%] rounded-b-3xl bg-gradient-to-t from-forest-deep/92 via-forest-deep/50 to-transparent"
      />

      {/* Top-left floating frosted pills */}
      <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-2 p-5 sm:p-6">
        <Badge
          variant="outline"
          className={cn(
            'h-auto min-h-7 gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold break-words whitespace-normal shadow-sm backdrop-blur-md',
            operatingStatus.isOpen
              ? 'border-white/90 bg-card/95 text-foreground'
              : 'border-white/80 bg-card/90 text-muted-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-full',
              operatingStatus.isOpen ? 'bg-emerald-600' : 'bg-muted-foreground',
            )}
          />
          {operatingStatus.displayText}
        </Badge>
        <PriceTierBadge tier={space.price_tier} showSymbol className="shadow-sm" />
        {typeof holdFeeAmount === 'number' && (
          <Badge
            variant="outline"
            className="h-auto min-h-7 rounded-full border-white/90 bg-card/95 px-3.5 py-1 font-mono text-xs font-semibold whitespace-normal text-foreground shadow-sm backdrop-blur-md"
          >
            Hold fee: {formatPeso(holdFeeAmount)}
          </Badge>
        )}
      </div>

      {/* Lower frosted-glass info area with telemetry stats + hairline footer */}
      <div className="relative z-10 mt-auto space-y-4 p-5 pt-8 sm:p-6 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="font-heading text-3xl leading-[1.06] font-bold tracking-[-0.03em] break-words text-white drop-shadow-sm sm:text-4xl">
              {space.name}
            </h1>

            <div className="flex min-w-0 items-start gap-1.5 text-sm wrap-anywhere text-white/95 drop-shadow-xs">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden="true" />
              <span>{space.address}</span>
            </div>

            {space.description && (
              <p className="text-sm leading-relaxed break-words whitespace-pre-line text-white/88 drop-shadow-xs">
                {space.description}
              </p>
            )}
          </div>

          {availability && availability.totalUnits > 0 && (
            <div
              aria-hidden="true"
              className="flex shrink-0 items-center divide-x divide-white/20 rounded-2xl border border-white/20 bg-white/10 px-1 py-2 backdrop-blur-md"
            >
              <div className="px-3.5 text-center">
                <span className="flex items-center justify-center gap-1.5 font-mono text-sm font-bold text-white tabular-nums">
                  <Armchair className="size-3.5 text-brass" />
                  <span>{availability.availableUnits}</span>
                </span>
                <span className="block text-[11px] text-white/80">Open</span>
              </div>
              <div className="px-3.5 text-center">
                <span className="flex items-center justify-center gap-1.5 font-mono text-sm font-bold text-white tabular-nums">
                  <Users className="size-3.5 text-brass" />
                  <span>{availability.totalUnits}</span>
                </span>
                <span className="block text-[11px] text-white/80">Units</span>
              </div>
            </div>
          )}
        </div>

        {/* Hairline glass footer strip */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5 border-t border-white/15 pt-3.5 text-sm text-white drop-shadow-xs">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs font-medium">
            <Clock className="size-4 shrink-0 text-brass" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">Hours: {hoursText}</span>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass"
          >
            <ShieldCheck className="size-3.5 shrink-0 text-brass" />
            <span>Verified Space</span>
          </span>
        </div>
      </div>
    </header>
  )
}
