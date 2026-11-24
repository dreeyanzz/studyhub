import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { statusBadges } from '@/app/(dashboard)/host/_components/space-list'
import { Badge } from '@/components/ui/badge'
import { getSeatMap } from '@/lib/data/seat-map'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

import { cn } from '@/lib/utils'

import { buildViewHref, findRemovalTarget } from './_components/seat-map-helpers'
import { SeatMapBuilder } from './_components/seat-map-builder'
import { SeatMapListView } from './_components/seat-map-list-view'

export const metadata: Metadata = { title: 'Seat map' }

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
          {/* Each link is at least 48×48 px, like every control (D-031). */}
          <div
            role="group"
            aria-label="View switcher"
            className="inline-flex rounded-lg border border-input bg-muted p-1 text-muted-foreground"
          >
            <Link
              href={gridHref}
              aria-current={!isListView ? 'page' : undefined}
              className={cn(
                'inline-flex h-12 min-w-12 items-center justify-center rounded-md px-4 text-sm font-medium ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
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
                'inline-flex h-12 min-w-12 items-center justify-center rounded-md px-4 text-sm font-medium ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
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
