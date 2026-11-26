import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { updateSpace } from '@/app/(dashboard)/host/actions'
import { SpaceForm } from '@/app/(dashboard)/host/_components/space-form'
import { SpaceSubNav } from '../_components/space-sub-nav'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { parseIntervalToMinutes } from '@/lib/validation/reservation'
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
    .select(
      'id, name, description, address, opens_at, closes_at, max_wait_window, latitude, longitude, price_tier, status',
    )
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()
  if (!space) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link
                href="/host"
                className="inline-flex min-h-12 min-w-12 items-center underline-offset-4 hover:underline"
              >
                Your Spaces
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li className="wrap-anywhere">
              {space.name}
              <span aria-hidden="true"> /</span>
            </li>
            <li aria-current="page">Edit Space</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Edit Space
            </h1>
            {/* V6 and V4 (STORY-20 design §3, D-079). The form also warns before such a
                save, and this line says it even without JavaScript. */}
            <p className="text-sm wrap-anywhere text-muted-foreground">
              {space.status === 'verified'
                ? "Changing this Space's name, address, or map pin sends it back to Pending verification. Other edits keep it Verified."
                : `Saving changes to ${space.name} doesn't change its Verification status.`}
            </p>
          </div>
          <Link
            href="/host"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-auto min-h-12 max-w-full min-w-12 shrink px-4 py-2 text-sm font-medium whitespace-normal',
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Spaces
          </Link>
        </div>
      </div>
      <SpaceSubNav spaceId={space.id} current="edit" />
      <Card className="max-w-2xl">
        <CardContent>
          <SpaceForm
            mode="edit"
            action={updateSpace}
            spaceId={space.id}
            spaceStatus={space.status}
            initialValues={{
              name: space.name,
              description: space.description ?? '',
              address: space.address,
              // Postgres returns HH:mm:ss, and a time input takes HH:mm.
              opensAt: space.opens_at.slice(0, 5),
              closesAt: space.closes_at.slice(0, 5),
              maxWaitWindowMinutes: String(parseIntervalToMinutes(space.max_wait_window)),
              // A Space with no pin shows two empty fields (STORY-08 design §3).
              latitude: space.latitude === null ? '' : String(space.latitude),
              longitude: space.longitude === null ? '' : String(space.longitude),
              priceTier: space.price_tier,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
