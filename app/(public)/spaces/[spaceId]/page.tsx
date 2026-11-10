import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ArrowLeft, Clock, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSeatMap } from '@/lib/data/seat-map'
import { computeSpaceAvailability } from '@/lib/space/availability'
import { computeOperatingStatus } from '@/lib/space/format'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'
import { SpaceProfileHeader } from './_components/space-profile-header'

// Discovery search lives at /spaces (STORY-08 design §1, step S1), so the back
// link and the closed and no-units notices return there.
const DISCOVERY_HREF = '/spaces'

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
    .select('id, name, description, address, opens_at, closes_at, status')
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
 * Public Space Profile Server Component (STORY-11 design §0, §1, §3 Screen 1, FR-1.3, D-055).
 *
 * Enforces verified check (D-055): returns 404 notFound() for missing spaces,
 * invalid UUIDs, or hidden (pending/rejected) spaces, leaking no information
 * even to their owning Host or Administrators.
 *
 * Renders header with open/closed status badge, back navigation link,
 * and closed / no-available-unit notices with discovery search links.
 */
export default async function SpaceProfilePage({
  params,
}: {
  params: Promise<{ spaceId: string }>
}) {
  const { spaceId } = await params
  const space = await getVerifiedSpace(spaceId)
  if (!space) {
    notFound()
  }

  const supabase = await createClient()
  const zones = await getSeatMap(supabase, space.id)
  const availability = computeSpaceAvailability(zones)
  const operatingStatus = computeOperatingStatus(space.opens_at, space.closes_at)

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

      {availability.availableUnits === 0 && (
        <Alert
          data-testid="seeker-profile-no-available-unit"
          variant="default"
          className="border-muted-foreground/20 bg-muted/30"
        >
          <Info className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>No units available</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              No units are currently Available. Check back later or{' '}
              <Link
                href={DISCOVERY_HREF}
                className="inline-flex min-h-12 items-center rounded-xs font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                explore other spaces
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
