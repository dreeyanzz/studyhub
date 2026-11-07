import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { statusBadges } from '@/app/(dashboard)/host/_components/space-list'
import { Badge } from '@/components/ui/badge'
import { getSeatMap } from '@/lib/data/seat-map'
import type { SeatMapZone } from '@/lib/seat-map/grid'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

import type { RemovalTarget } from './_components/confirm-removal'
import { SeatMapBuilder } from './_components/seat-map-builder'

export const metadata: Metadata = { title: 'Seat map' }

type Query = Record<string, string | string[] | undefined>

/**
 * The confirmation step's target (STORY-07 design §3): ?remove=<unit id> or
 * ?delete-zone=<zone id>. An id that isn't in this Space, or no longer exists, is
 * ignored, so a stale link shows the map as it is.
 */
function findRemovalTarget(zones: SeatMapZone[], query: Query): RemovalTarget | null {
  const one = (value: string | string[] | undefined) =>
    typeof value === 'string' ? value : undefined

  const unitId = one(query.remove)
  if (unitId) {
    for (const zone of zones) {
      const unit = zone.units.find((u) => u.id === unitId)
      if (unit) {
        return {
          kind: 'unit',
          id: unit.id,
          label: unit.label,
          zoneId: zone.id,
          zoneName: zone.name,
        }
      }
    }
  }

  const zoneId = one(query['delete-zone'])
  const zone = zoneId ? zones.find((z) => z.id === zoneId) : undefined
  if (zone) {
    return { kind: 'zone', id: zone.id, name: zone.name, unitCount: zone.units.length }
  }
  return null
}

/**
 * The Host's seat map builder for one of their own Spaces (STORY-07 design §3,
 * TSK-07.6). Like the edit page, it loads the Space owner-scoped: a malformed id, a
 * missing Space, another Host's Space and an Administrator all get the not-found page
 * (STORY-05 §1.3). Editing the seat map doesn't change the Space's Verification
 * status (Host setup journey W4, D-027).
 */
export default async function SeatMapPage({
  params,
  searchParams,
}: PageProps<'/host/spaces/[spaceId]/seat-map'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The layout's check does not stop this page from rendering (see /host).
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // A malformed id is never sent to Postgres (STORY-05 design §2.4).
  const spaceId = spaceIdSchema.safeParse((await params).spaceId)
  if (!spaceId.success) notFound()

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, status')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()
  if (!space) notFound()

  const zones = await getSeatMap(supabase, space.id)
  const confirm = findRemovalTarget(zones, await searchParams)
  const status = statusBadges[space.status]
  const baseHref = `/host/spaces/${space.id}/seat-map`

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link href="/host" className="underline-offset-4 hover:underline">
                Your Spaces
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li aria-current="page" className="wrap-anywhere">
              {space.name}
            </li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Seat map
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-medium wrap-anywhere text-foreground">
            {space.name}
          </p>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Every change saves as you make it, and doesn&apos;t change the Space&apos;s
          Verification status.
        </p>
      </div>

      <SeatMapBuilder
        spaceId={space.id}
        zones={zones}
        confirm={confirm}
        baseHref={baseHref}
      />
    </div>
  )
}
