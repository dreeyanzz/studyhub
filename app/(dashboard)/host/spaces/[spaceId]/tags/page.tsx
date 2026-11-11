import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { statusBadges } from '@/app/(dashboard)/host/_components/space-list'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { spaceIdSchema } from '@/lib/validation/space'

import { TagForm } from './_components/tag-form'

export const metadata: Metadata = { title: 'Amenities & Tags' }

/**
 * The Host's tagging page: step H8 of the Host setup journey (STORY-08 design §3,
 * D-006). A malformed id, a missing Space and another Host's Space all get the same
 * not-found page, as on the edit page (STORY-05 design §1.3).
 */
export default async function SpaceTagsPage({
  params,
}: PageProps<'/host/spaces/[spaceId]/tags'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The layout's check does not stop this page from rendering (see /host).
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // A malformed id is never sent to Postgres (STORY-05 design §2.4).
  const spaceId = spaceIdSchema.safeParse((await params).spaceId)
  if (!spaceId.success) notFound()

  // Owner-scoped as well as by RLS, so an Administrator (D-032) cannot open another
  // Host's Space here either.
  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, status')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()
  if (!space) notFound()

  const [catalogResult, curatedResult, customResult] = await Promise.all([
    supabase
      .from('curated_tags')
      .select('id, category, label, description')
      .order('category')
      .order('display_order'),
    supabase.from('space_curated_tags').select('tag_id').eq('space_id', space.id),
    supabase
      .from('space_custom_tags')
      .select('name')
      .eq('space_id', space.id)
      .order('created_at'),
  ])
  const loadFailed =
    Boolean(catalogResult.error || curatedResult.error || customResult.error) ||
    !catalogResult.data

  const status = statusBadges[space.status]

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
            <li className="wrap-anywhere">
              {space.name}
              <span aria-hidden="true"> /</span>
            </li>
            <li aria-current="page">Amenities &amp; Tags</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Amenities &amp; Tags
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-base font-medium wrap-anywhere text-foreground">
                {space.name}
              </p>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>
          <Link
            href="/host"
            // Wraps at 200% text, so the page never scrolls sideways at 360 px.
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-auto min-h-12 max-w-full min-w-12 shrink px-4 py-2 text-sm font-medium whitespace-normal',
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Spaces
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Saving tags doesn&apos;t change your Space&apos;s Verification status.
        </p>
      </div>

      {loadFailed ? (
        // Never the raw Supabase error (STORY-05 design §4.2).
        <Alert variant="destructive">
          <AlertDescription>
            We could not load this Space&apos;s tags. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <TagForm
          spaceId={space.id}
          catalog={catalogResult.data ?? []}
          initialCuratedTagIds={(curatedResult.data ?? []).map((row) => row.tag_id)}
          initialCustomTagNames={(customResult.data ?? []).map((row) => row.name)}
        />
      )}
    </div>
  )
}
