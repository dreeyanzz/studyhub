import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { updateSpace } from '@/app/(dashboard)/host/actions'
import { SpaceForm } from '@/app/(dashboard)/host/_components/space-form'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

export const metadata: Metadata = { title: 'Edit Space' }

/**
 * Edit one of the signed-in Host's own Spaces (STORY-05 design §1.3 and §3.1). A
 * malformed id, a missing Space and another Host's Space all get the same not-found
 * page, so the page never confirms that someone else's Space exists.
 */
export default async function EditSpacePage({
  params,
}: PageProps<'/host/spaces/[spaceId]/edit'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The layout's check does not stop this page from rendering (see /host).
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // A malformed id is never sent to Postgres (design §2.4).
  const spaceId = spaceIdSchema.safeParse((await params).spaceId)
  if (!spaceId.success) notFound()

  // Owner-scoped as well as by RLS, so an Administrator (D-032) cannot open another
  // Host's Space here either.
  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, description, address, opens_at, closes_at')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()
  if (!space) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Edit Space
        </h1>
        <p className="text-sm wrap-anywhere text-muted-foreground">
          Saving changes to {space.name} doesn&apos;t change its Verification status.
        </p>
      </div>
      <Card>
        <CardContent>
          <SpaceForm
            mode="edit"
            action={updateSpace}
            spaceId={space.id}
            initialValues={{
              name: space.name,
              description: space.description ?? '',
              address: space.address,
              // Postgres returns HH:mm:ss, and a time input takes HH:mm.
              opensAt: space.opens_at.slice(0, 5),
              closesAt: space.closes_at.slice(0, 5),
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
