import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { AlertCircle, ArrowLeft, Camera, Clock, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getHoldTerms, getHoldViewer } from '@/lib/data/reservations'
import {
  getMyReviewableVisit,
  getMyReviews,
  getMyShortName,
  getReviewSummaries,
  getSpaceReviews,
  type SpaceReviewSummary,
} from '@/lib/data/reviews'
import { getSeatMap } from '@/lib/data/seat-map'
import { holdRefusalMessage, parseHoldRefusalReason } from '@/lib/payments/refusals'
import type { SeatMapUnit, SeatState } from '@/lib/seat-map/grid'
import { computeSpaceAvailability } from '@/lib/space/availability'
import { computeOperatingStatus } from '@/lib/space/format'
import { createClient } from '@/lib/supabase/server'
import { reviewListSchema } from '@/lib/validation/review'
import { spaceIdSchema } from '@/lib/validation/space'
import { AvailabilitySummary } from './_components/availability-summary'
import { HoldUnitPanel } from './_components/hold-unit-panel'
import { SeatMapRefresh } from './_components/seat-map-refresh'
import { SpacePhotoGallery, type SpacePhoto } from './_components/space-photo-gallery'
import { SpaceProfileHeader } from './_components/space-profile-header'
import { SpaceReviews } from './_components/space-reviews'
import { SpaceTags, type CuratedTagData } from './_components/space-tags'
import { SpaceSeatMapView } from './_components/space-seat-map-view'

// Discovery search lives at /spaces (STORY-08 design §1, step S1), so the back
// link and the closed and no-units notices return there.
const DISCOVERY_HREF = '/spaces'

// Canonical curated amenity category order matching the Host tagging form (STORY-08 design §3).
const CATEGORY_ORDER: Record<string, number> = {
  wifi: 0,
  power: 1,
  noise: 2,
  ac: 3,
}

/**
 * The Space, or null when the id is malformed, the Space is missing, or it isn't
 * Verified. D-055: only Verified Spaces are public, so a Hidden Space reads as
 * missing, even to its owning Host or an Administrator (RLS lets them read it).
 *
 * generateMetadata and the page both need it; React's cache() makes it one query
 * per request (Next's "Memoizing data requests").
 */
const getVerifiedSpace = cache(async (rawSpaceId: string) => {
  const parsedId = spaceIdSchema.safeParse(rawSpaceId)
  if (!parsedId.success) {
    return null
  }

  const supabase = await createClient()
  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, description, address, opens_at, closes_at, price_tier, status')
    .eq('id', parsedId.data)
    .maybeSingle()

  return space?.status === 'verified' ? space : null
})

// The seat map's state words (space-seat-map-view.tsx), for the Hold again notice.
// That file is a Client Component, so its constant can't be imported into this one.
const SEAT_STATE_LABELS: Record<SeatState, string> = {
  available: 'Available',
  pending_payment: 'Pending Payment',
  reserved: 'Reserved',
  occupied: 'Occupied',
}

/**
 * Why a unit from the reservation history can't be held right now (STORY-16 design §3
 * Screen 3, D-077), or null when there is nothing to say: the unit is Available (the hold
 * panel opens as usual), no unit was named, or the Space is closed (its closed alert
 * says so instead, so only one closed alert appears).
 */
function holdAgainNoticeMessage({
  isOpen,
  unitRemoved,
  unitParam,
  selectedUnit,
}: {
  isOpen: boolean
  unitRemoved: boolean
  unitParam: string | undefined
  selectedUnit: SeatMapUnit | undefined
}): string | null {
  if (!isOpen) {
    return null
  }
  if (unitRemoved || (unitParam !== undefined && !selectedUnit)) {
    return 'The unit you held before was removed. Pick another Available unit below.'
  }
  if (selectedUnit && selectedUnit.seatState !== 'available') {
    const stateLabel = SEAT_STATE_LABELS[selectedUnit.seatState] ?? selectedUnit.seatState
    return `${selectedUnit.label} is taken right now (${stateLabel}). Pick another Available unit below.`
  }
  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ spaceId: string }>
}): Promise<Metadata> {
  const { spaceId } = await params
  const space = await getVerifiedSpace(spaceId)
  return { title: space ? space.name : 'Space Not Found' }
}

/**
 * Public Space Profile Server Component (STORY-11 design §0, §1, §3 Screen 1, FR-1.3, D-055, TSK-11.6).
 *
 * Enforces verified check (D-055): returns 404 notFound() for missing spaces,
 * invalid UUIDs, or hidden (pending/rejected) spaces, leaking no information
 * even to their owning Host or Administrators.
 *
 * Renders header with open/closed status badge, photo gallery, curated and custom tag
 * presentation (D-006), availability overview, seat map grid / list view with unit selection,
 * and closed / no-available-unit notices.
 */
export default async function SpaceProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { spaceId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const viewParam =
    typeof resolvedSearchParams.view === 'string' ? resolvedSearchParams.view : undefined
  const unitParam =
    typeof resolvedSearchParams.unit === 'string' ? resolvedSearchParams.unit : undefined
  const initialView = viewParam === 'list' ? 'list' : 'grid'
  const { sort: reviewSort, reviews: reviewShown } =
    reviewListSchema.parse(resolvedSearchParams)

  const space = await getVerifiedSpace(spaceId)
  if (!space) {
    notFound()
  }

  const supabase = await createClient()
  const [
    zones,
    { data: storageFiles },
    { data: curatedTagRows },
    { data: customTagRows },
    holdTerms,
    viewer,
    reviewSummaries,
    reviewsPage,
    myReviews,
    reviewableVisit,
    viewerShortName,
  ] = await Promise.all([
    getSeatMap(supabase, space.id),
    supabase.storage.from('space-photos').list(space.id, {
      sortBy: { column: 'created_at', order: 'asc' },
    }),
    supabase
      .from('space_curated_tags')
      .select('tag_id, curated_tags(id, category, label, display_order)')
      .eq('space_id', space.id),
    supabase
      .from('space_custom_tags')
      .select('name')
      .eq('space_id', space.id)
      .order('created_at'),
    // STORY-09's hold panel (design §3): what a hold costs here, and who is looking.
    getHoldTerms(supabase, space.id),
    getHoldViewer(supabase),
    // STORY-13's community reviews (design §1 & §3, TSK-13.4).
    getReviewSummaries(supabase, [space.id]),
    getSpaceReviews(supabase, space.id, { sort: reviewSort, shown: reviewShown }),
    getMyReviews(supabase, space.id),
    getMyReviewableVisit(supabase, space.id),
    getMyShortName(supabase),
  ])
  const reviewSummary: SpaceReviewSummary | null =
    reviewSummaries === null
      ? null
      : (reviewSummaries.get(space.id) ?? {
          spaceId: space.id,
          reviewCount: 0,
          avgQuietness: null,
          avgWifiReliability: null,
          avgCleanliness: null,
          avgComfort: null,
          avgOverall: null,
        })
  const availability = computeSpaceAvailability(zones)
  const operatingStatus = computeOperatingStatus(space.opens_at, space.closes_at)

  const photos: SpacePhoto[] = (storageFiles ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from('space-photos').getPublicUrl(`${space.id}/${f.name}`)
        .data.publicUrl,
    }))

  const curatedTags: CuratedTagData[] = (curatedTagRows ?? [])
    .map((row) => row.curated_tags)
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag?.id && tag?.label))
    .sort((a, b) => {
      const catDiff =
        (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
      if (catDiff !== 0) return catDiff
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0)
      if (orderDiff !== 0) return orderDiff
      return a.label.localeCompare(b.label)
    })
    .map(({ id, category, label }) => ({ id, category, label }))

  const customTags: string[] = (customTagRows ?? [])
    .map((row) => row.name)
    .filter(Boolean)

  // The hold panel for the ?unit=<id> unit, rendered here on the server and passed to
  // the seat map view's slot (STORY-09 design §8). The view shows it only while that
  // unit is Available and the Space is open.
  const selectedUnit = zones.flatMap((zone) => zone.units).find((u) => u.id === unitParam)
  // holdUnit's refusal, from `?refused=` (design §3): one message, above the seat map.
  const refusal = parseHoldRefusalReason(resolvedSearchParams.refused)
  const refusalMessage = refusal
    ? holdRefusalMessage(refusal, {
        unitLabel: selectedUnit?.label ?? 'This unit',
        currentHold: viewer.currentHold,
      })
    : null
  const holdPanel = selectedUnit ? (
    <HoldUnitPanel
      spaceId={space.id}
      unit={{ id: selectedUnit.id, label: selectedUnit.label }}
      terms={holdTerms}
      viewerRole={viewer.role}
      view={initialView}
      currentHold={
        viewer.currentHold
          ? {
              id: viewer.currentHold.id,
              unitLabel: viewer.currentHold.unitLabel,
              spaceName: viewer.currentHold.spaceName,
            }
          : null
      }
    />
  ) : null

  // STORY-16's Hold again (design §3 Screen 3, D-077): the history links here with
  // `from=history`, and the profile says why the unit can't be held using today's state.
  // It never holds anything by itself (D-001). A closed Space keeps its one closed alert,
  // with a line added below, so it gets no second notice.
  const fromHistory = resolvedSearchParams.from === 'history'
  const holdAgainNotice = fromHistory
    ? holdAgainNoticeMessage({
        isOpen: operatingStatus.isOpen,
        unitRemoved: resolvedSearchParams.unit_removed === '1',
        unitParam,
        selectedUnit,
      })
    : null

  const hasTags = curatedTags.length > 0 || customTags.length > 0

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full bg-background">
      <div className="w-full min-w-0 space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-10">
        <nav aria-label="Breadcrumb">
          <Link
            href={DISCOVERY_HREF}
            className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Back to search</span>
          </Link>
        </nav>

        {/* Top Hero Split: Full-bleed frosted-glass Info Card beside Availability & Amenities */}
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <SpaceProfileHeader
            space={space}
            operatingStatus={operatingStatus}
            holdFeeAmount={holdTerms?.feeAmount ?? null}
            coverPhotoUrl={photos[0]?.url ?? null}
            availability={{
              availableUnits: availability.availableUnits,
              totalUnits: availability.totalUnits,
            }}
          />

          <div className="flex min-w-0 flex-col gap-5">
            {/* Zone availability overview with oldest-available freshness rule (D-051) */}
            <div className={hasTags ? 'min-w-0' : 'min-w-0 flex-1'}>
              <AvailabilitySummary summary={availability} />
            </div>

            {/* Curated Amenity Tags and Host Custom Tags (D-006, TSK-11.6) */}
            {hasTags && (
              <div className="min-w-0 flex-1">
                <SpaceTags curatedTags={curatedTags} customTags={customTags} />
              </div>
            )}
          </div>
        </div>

        {!operatingStatus.isOpen && (
          <Alert
            data-testid="seeker-space-closed"
            variant="default"
            className="rounded-2xl border-0 bg-muted/80"
          >
            <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <AlertTitle>This Space is closed now</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                You can review seats and amenities; reservations open during operating
                hours.
              </p>
              {fromHistory && (
                <p data-testid="hold-again-closed">
                  You can&apos;t hold that unit while the Space is closed.
                </p>
              )}
              <div>
                <Link
                  href={DISCOVERY_HREF}
                  className="inline-flex min-h-12 items-center rounded-xs font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Explore other spaces
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <SeatMapRefresh />

        {refusalMessage && (
          <Alert
            variant="destructive"
            role="alert"
            data-testid="hold-refusal"
            className="rounded-2xl border-destructive/30"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <AlertDescription>{refusalMessage}</AlertDescription>
          </Alert>
        )}

        {holdAgainNotice && (
          <Alert
            role="status"
            data-testid="hold-again-notice"
            className="rounded-2xl border-primary/30 bg-primary/5"
          >
            <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <AlertDescription>{holdAgainNotice}</AlertDescription>
          </Alert>
        )}

        {/* Synchronized Seat Map & Accessible List View with Unit Selection (TSK-11.5) */}
        <SpaceSeatMapView
          zones={zones}
          isOpen={operatingStatus.isOpen}
          initialView={initialView}
          initialSelectedUnitId={unitParam}
          selectedUnitActionSlot={holdPanel}
        />

        {/* Visual section divider separating Live Seat Booking from Photos & Reviews */}
        <div aria-hidden="true" className="flex items-center gap-4 pt-4">
          <div className="h-px flex-1 bg-border/80" />
          <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary/65 px-4 py-1.5 text-xs font-semibold tracking-wider text-secondary-foreground uppercase">
            Explore More · Photos &amp; Reviews
          </span>
          <div className="h-px flex-1 bg-border/80" />
        </div>

        {/* Dedicated Photo Gallery Card for browsing more Space photos (TSK-11.4) */}
        <section
          aria-labelledby="space-photos-heading"
          className="space-y-4 rounded-3xl border border-border/60 bg-muted/75 p-6 sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Camera className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>Gallery</span>
              </p>
              <h2
                id="space-photos-heading"
                className="font-heading text-lg font-semibold tracking-tight text-foreground"
              >
                Space Photos
              </h2>
              <p className="text-sm text-muted-foreground">
                Browse more photos of {space.name}&apos;s desks, lighting, and interior.
              </p>
            </div>
            {photos.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-card px-3.5 py-1 text-xs font-semibold text-foreground shadow-2xs">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
              </span>
            )}
          </div>

          <SpacePhotoGallery spaceName={space.name} photos={photos} />
        </section>

        {/* Community reviews and ratings (STORY-13, TSK-13.4, TSK-13.5, FR-4.1, FR-4.2) */}
        <SpaceReviews
          spaceId={space.id}
          summary={reviewSummary}
          reviewsPage={reviewsPage}
          myReviews={myReviews}
          reviewableVisit={reviewableVisit}
          viewerShortName={viewerShortName}
          canReport={viewer.role !== null}
          sort={reviewSort}
          shown={reviewShown}
          view={viewParam === 'list' ? 'list' : undefined}
          unit={unitParam}
        />
      </div>
    </div>
  )
}
