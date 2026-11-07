import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { statusBadges } from '@/app/(dashboard)/host/_components/space-list'
import { Badge } from '@/components/ui/badge'
import { getSeatMap } from '@/lib/data/seat-map'
import type { SeatMapZone } from '@/lib/seat-map/grid'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

import { cn } from '@/lib/utils'

import type { RemovalTarget } from './_components/confirm-removal'
import { SeatMapBuilder } from './_components/seat-map-builder'
import { SeatMapListView } from './_components/seat-map-list-view'

export const metadata: Metadata = { title: 'Seat map' }

type Query = Record<string, string | string[] | undefined>

/**
 * Constructs the URL for switching between Grid and List views while preserving
 * current query context (e.g. active removal confirmations).
 */
export function buildViewHref(
  baseHref: string,
  query: Query,
  targetView: 'grid' | 'list',
): string {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(query)) {
    if (key === 'view') continue
    if (typeof val === 'string') {
      params.set(key, val)
    } else if (Array.isArray(val)) {
      for (const item of val) params.append(key, item)
    }
  }
  if (targetView === 'list') {
    params.set('view', 'list')
  }
  const qs = params.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
}

/**
 * The confirmation step's target (STORY-07 design §3): ?remove=<unit id> or
 * ?delete-zone=<zone id>. An id that isn't in this Space, or no longer exists, is
 * ignored, so a stale link shows the map as it is.
 */
export function findRemovalTarget(
  zones: SeatMapZone[],
  query: Query,
): RemovalTarget | null {
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
 * TSK-07.6, TSK-07.7). Like the edit page, it loads the Space owner-scoped: a malformed id, a
 * missing Space, another Host's Space and an Administrator all get the not-found page
 * (STORY-05 §1.3). Editing the seat map doesn't change the Space's Verification
 * status (Host setup journey W4, D-027). Offers both snap-grid view and accessible
 * list view alternatives.
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

  const query = await searchParams
  const isListView = query.view === 'list'
  const zones = await getSeatMap(supabase, space.id)
  const confirm = findRemovalTarget(zones, query)
  const status = statusBadges[space.status]
  const baseHref = `/host/spaces/${space.id}/seat-map`

  const gridHref = buildViewHref(baseHref, query, 'grid')
  const listHref = buildViewHref(baseHref, query, 'list')

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-medium wrap-anywhere text-foreground">
              {space.name}
            </p>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div
            role="group"
            aria-label="View switcher"
            className="inline-flex rounded-lg border border-input bg-muted p-1 text-muted-foreground"
          >
            <Link
              href={gridHref}
              aria-current={!isListView ? 'page' : undefined}
              className={cn(
                'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                !isListView
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:bg-background/50 hover:text-foreground',
              )}
            >
              Grid
            </Link>
            <Link
              href={listHref}
              aria-current={isListView ? 'page' : undefined}
              className={cn(
                'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                isListView
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:bg-background/50 hover:text-foreground',
              )}
            >
              List
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Every change saves as you make it, and doesn&apos;t change the Space&apos;s
          Verification status.
        </p>
      </div>

      {isListView ? (
        <SeatMapListView
          spaceId={space.id}
          zones={zones}
          confirm={confirm}
          baseHref={baseHref}
        />
      ) : (
        <SeatMapBuilder
          spaceId={space.id}
          zones={zones}
          confirm={confirm}
          baseHref={baseHref}
        />
      )}
    </div>
  )
}
