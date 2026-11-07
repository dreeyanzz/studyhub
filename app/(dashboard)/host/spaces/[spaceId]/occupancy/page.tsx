import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { getSeatMap } from '@/lib/data/seat-map'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

import { OccupancyHeader } from './_components/occupancy-header'
import { OccupancyView } from './_components/occupancy-view'

export const metadata: Metadata = {
  title: 'Space Occupancy',
}

/**
 * Server Component page for Host live occupancy control (STORY-12 design §3, FR-3.2, D-051).
 *
 * Checks authenticated Host session and loads the owner-scoped Space and seat map.
 * Unauthorized visitors or requests for non-existent spaces receive a 404 notFound().
 */
export default async function OccupancyPage({
  params,
}: {
  params: Promise<{ spaceId: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?returnUrl=%2Fhost')
  }

  const { spaceId: rawSpaceId } = await params
  const spaceId = spaceIdSchema.safeParse(rawSpaceId)
  if (!spaceId.success) {
    notFound()
  }

  // Owner-scoped query so another Host or an Administrator cannot open this Space here (N13)
  const { data: space } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()

  if (!space) {
    notFound()
  }

  const zones = await getSeatMap(supabase, space.id)

  return (
    <div className="space-y-8">
      <OccupancyHeader space={space} zones={zones} />
      <OccupancyView space={space} initialZones={zones} />
    </div>
  )
}
