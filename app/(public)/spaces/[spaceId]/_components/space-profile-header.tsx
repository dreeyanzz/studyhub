import Image from 'next/image'
import { Armchair, Clock, MapPin, ShieldCheck, Users } from 'lucide-react'

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
  coverPhotoUrl,
  availability,
}: SpaceProfileHeaderProps) {
  const hoursText = formatOpeningHours(space.opens_at, space.closes_at)

  return (
    <header className="relative flex h-full min-h-[380px] flex-col justify-between rounded-[2rem] bg-[#143326] text-white shadow-[0_24px_48px_-18px_rgba(23,60,45,0.36)] sm:min-h-[420px]">
      {/* Full-bleed cover photo or rich Worq botanical gradient fallback */}
      {coverPhotoUrl ? (
        <Image
          src={coverPhotoUrl}
          alt=""
          fill
          preload
          sizes="(max-width: 768px) 100vw, 45vw"
          className="rounded-[2rem] object-cover"
          aria-hidden="true"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_85%_12%,rgba(221,235,204,0.22),transparent_48%),radial-gradient(circle_at_12%_88%,rgba(123,196,150,0.18),transparent_50%),linear-gradient(135deg,#235d42_0%,#194733_52%,#0f291e_100%)]"
        />
      )}

      {/* Subtle top scrim so floating badges stay crisp without dimming the room */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[2rem] bg-gradient-to-b from-black/15 to-transparent"
      />

      {/* Gentle progressive frosted-glass blur rising from bottom so the photo behind stays clearly visible */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-b-[2rem] [mask-image:linear-gradient(to_top,black_36%,transparent_100%)] backdrop-blur-md"
      />

      {/* Translucent Worq forest-green scrim preserving photo visibility and WCAG AA/AAA text contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%] rounded-b-[2rem] bg-gradient-to-t from-[#0f2b20]/72 via-[#173c2d]/42 to-transparent"
      />

      {/* Top-left floating pills */}
      <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-2 p-5 sm:p-6">
        <Badge
          variant="outline"
          className={cn(
            'h-auto min-h-7 gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold break-words whitespace-normal shadow-sm backdrop-blur-md',
            operatingStatus.isOpen
              ? 'border-white/90 bg-white/95 text-foreground'
              : 'border-white/80 bg-white/90 text-muted-foreground',
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
      </div>

      {/* Lower frosted-glass info area with divided quick stats + hairline footer */}
      <div className="relative z-10 mt-auto space-y-4 p-5 pt-10 sm:p-6 sm:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words text-white drop-shadow-sm sm:text-3xl">
              {space.name}
            </h1>

            <div className="flex min-w-0 items-start gap-1.5 text-sm wrap-anywhere text-white/95 drop-shadow-xs">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-[#f0c95c]"
                aria-hidden="true"
              />
              <span>{space.address}</span>
            </div>

            {space.description && (
              <p className="text-sm leading-relaxed break-words whitespace-pre-line text-white/90 drop-shadow-xs">
                {space.description}
              </p>
            )}
          </div>

          {availability && availability.totalUnits > 0 && (
            <div
              aria-hidden="true"
              className="flex shrink-0 items-center divide-x divide-white/25 rounded-2xl border border-white/20 bg-black/25 px-1 py-2 backdrop-blur-md"
            >
              <div className="px-3 text-center">
                <span className="flex items-center justify-center gap-1 text-sm font-semibold text-white">
                  <Armchair className="size-3.5 text-[#f0c95c]" />
                  <span>{availability.availableUnits}</span>
                </span>
                <span className="block text-xs text-white/80">Open</span>
              </div>
              <div className="px-3 text-center">
                <span className="flex items-center justify-center gap-1 text-sm font-semibold text-white">
                  <Users className="size-3.5 text-[#f0c95c]" />
                  <span>{availability.totalUnits}</span>
                </span>
                <span className="block text-xs text-white/80">Units</span>
              </div>
            </div>
          )}
        </div>

        {/* Hairline glass footer strip */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5 border-t border-white/25 pt-3.5 text-sm text-white drop-shadow-xs">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            <Clock className="size-4 shrink-0 text-[#f0c95c]" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">Hours: {hoursText}</span>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90"
          >
            <ShieldCheck className="size-3.5 shrink-0 text-[#f0c95c]" />
            <span>Verified Space</span>
          </span>
        </div>
      </div>
    </header>
  )
}
