import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { AlertCircle, ArrowLeft, Clock } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getHoldTerms, getHoldViewer } from '@/lib/data/reservations'
import { getSeatMap } from '@/lib/data/seat-map'
import { holdRefusalMessage, parseHoldRefusalReason } from '@/lib/payments/refusals'
import { computeSpaceAvailability } from '@/lib/space/availability'
import { computeOperatingStatus } from '@/lib/space/format'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'
import { AvailabilitySummary } from './_components/availability-summary'
import { HoldUnitPanel } from './_components/hold-unit-panel'
import { SpacePhotoGallery, type SpacePhoto } from './_components/space-photo-gallery'
import { SpaceProfileHeader } from './_components/space-profile-header'
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
  ])
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

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb">
        <Link
          href={DISCOVERY_HREF}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          <span>Back to search</span>
        </Link>
      </nav>

      <SpaceProfileHeader space={space} operatingStatus={operatingStatus} />

      <SpacePhotoGallery spaceName={space.name} photos={photos} />

      {/* Curated Amenity Tags and Host Custom Tags (D-006, TSK-11.6) */}
      <SpaceTags curatedTags={curatedTags} customTags={customTags} />

      {!operatingStatus.isOpen && (
        <Alert
          data-testid="seeker-space-closed"
          variant="default"
          className="border-muted-foreground/20 bg-muted/30"
        >
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>This Space is closed now</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              You can review seats and amenities; reservations open during operating
              hours.
            </p>
            <div>
              <Link
                href={DISCOVERY_HREF}
                className="inline-flex min-h-12 items-center rounded-xs font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Explore other spaces
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Zone availability overview with oldest-available freshness rule (D-051) */}
      <AvailabilitySummary summary={availability} />

      {refusalMessage && (
        <Alert variant="destructive" role="alert" data-testid="hold-refusal">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{refusalMessage}</AlertDescription>
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
    </div>
  )
}
