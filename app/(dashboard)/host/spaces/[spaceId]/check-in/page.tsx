import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { spaceIdSchema } from '@/lib/validation/space'

import { SpaceSubNav } from '../_components/space-sub-nav'
import { CheckInShell } from './_components/check-in-shell'

export const metadata: Metadata = {
  title: 'Check-In Desk',
}

/**
 * Host Check-in Portal page (`/host/spaces/[spaceId]/check-in`, STORY-10 design §3, D-060).
 *
 * Enforces signed-in session and Space ownership (`host_id = auth.uid()`) before rendering.
 * Malformed IDs, missing Spaces, or another Host's Space render `notFound()`.
 */
export default async function HostCheckInPage({
  params,
}: PageProps<'/host/spaces/[spaceId]/check-in'>) {
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

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()

  if (!space) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              {/* A 48 x 48 px target, not just the text (SRS §3.2.2, #377). */}
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
            <li aria-current="page">Check-in desk</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {space.name} Check-in desk
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verify arrival booking codes scoped exclusively to this Space.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/host/spaces/${space.id}/occupancy`}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-auto min-h-12 max-w-full px-4 py-2 text-center whitespace-normal',
              )}
            >
              Occupancy
            </Link>
            <Link
              href="/host"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-auto min-h-12 max-w-full gap-2 px-4 py-2 text-center whitespace-normal',
              )}
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              Back to Spaces
            </Link>
          </div>
        </div>
      </div>

      <SpaceSubNav spaceId={space.id} current="check-in" />

      <CheckInShell spaceId={space.id} spaceName={space.name} />
    </div>
  )
}
