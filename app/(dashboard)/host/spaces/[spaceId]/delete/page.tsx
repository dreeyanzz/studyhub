import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { DeleteSpaceForm } from '@/app/(dashboard)/host/_components/delete-space-form'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { spaceIdSchema } from '@/lib/validation/space'

export const metadata: Metadata = { title: 'Delete Space' }

/**
 * Confirm deleting one of the signed-in Host's own Spaces (STORY-05 design §1.4 and
 * §3.4). Opening this page only reads; a link, a prefetch or a crawler can never
 * delete anything. A malformed id, a missing Space and another Host's Space all get
 * the same not-found page.
 */
export default async function DeleteSpacePage({
  params,
}: PageProps<'/host/spaces/[spaceId]/delete'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The layout's check does not stop this page from rendering (see /host).
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // A malformed id is never sent to Postgres (design §2.4).
  const spaceId = spaceIdSchema.safeParse((await params).spaceId)
  if (!spaceId.success) notFound()

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('id', spaceId.data)
    .eq('host_id', user.id)
    .maybeSingle()
  if (!space) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            href="/host"
            className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-full border border-border/80 bg-card px-4 text-sm font-medium text-foreground shadow-2xs transition-colors hover:border-primary/45 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Back to Spaces</span>
          </Link>
        </nav>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Delete Space
        </h1>
      </div>
      <Card className="rounded-3xl border-destructive/30 shadow-card">
        <CardContent className="space-y-5 pt-6">
          <p className="text-base wrap-anywhere">
            You&apos;re about to permanently delete <strong>{space.name}</strong>. This
            can&apos;t be undone.
          </p>
          <DeleteSpaceForm spaceId={space.id} />
        </CardContent>
      </Card>
    </div>
  )
}
