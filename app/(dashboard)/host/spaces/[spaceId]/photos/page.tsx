// STORY-11, TSK-11.2: Host photo management page (D-010, D-055, D-063).
// Owner-scoped route allowing hosts to upload and delete photos for their Space.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { statusBadges } from '@/app/(dashboard)/host/_components/space-list'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { spaceIdSchema } from '@/lib/validation/space'

import { ConfirmPhotoRemoval } from './_components/confirm-photo-removal'
import { PhotoGrid, type PhotoItem } from './_components/photo-grid'
import { PhotoUploadForm } from './_components/photo-upload-form'

export const metadata: Metadata = {
  title: 'Space Photos',
}

interface PageProps {
  params: Promise<{ spaceId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SpacePhotosPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?returnUrl=%2Fhost')
  }

  // A malformed id is never sent to Postgres (D-055)
  const spaceIdParsed = spaceIdSchema.safeParse((await params).spaceId)
  if (!spaceIdParsed.success) {
    notFound()
  }

  const spaceId = spaceIdParsed.data

  // Owner-scoped check: other hosts or admins receive notFound() (matches STORY-05 & STORY-07)
  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, status')
    .eq('id', spaceId)
    .eq('host_id', user.id)
    .maybeSingle()

  if (!space) {
    notFound()
  }

  const query = await searchParams
  const removeTarget = typeof query.remove === 'string' ? query.remove : undefined

  // Read existing photos from storage bucket in chronological order
  const { data: storageFiles } = await supabase.storage
    .from('space-photos')
    .list(space.id, {
      sortBy: { column: 'created_at', order: 'asc' },
    })

  const photos: PhotoItem[] = (storageFiles ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from('space-photos').getPublicUrl(`${space.id}/${f.name}`)
        .data.publicUrl,
      sizeBytes:
        typeof f.metadata?.size === 'number'
          ? f.metadata.size
          : typeof (f as { size?: number }).size === 'number'
            ? (f as { size?: number }).size
            : undefined,
      createdAt: f.created_at ?? undefined,
    }))

  // A name that isn't in this Space's folder is ignored, so a stale link shows the grid.
  const removeIndex = removeTarget ? photos.findIndex((p) => p.name === removeTarget) : -1
  const photoToRemove = removeIndex >= 0 ? photos[removeIndex] : undefined

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
            <li aria-current="page" className="wrap-anywhere">
              {space.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Space Photos
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
            // Wraps at 200% text, so the page never scrolls sideways at 360 px (§3).
            // cn() lets these win over the button's shrink-0 and whitespace-nowrap.
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

      {photoToRemove && (
        <ConfirmPhotoRemoval
          spaceId={space.id}
          spaceName={space.name}
          fileName={photoToRemove.name}
          photoUrl={photoToRemove.url}
          position={removeIndex + 1}
          total={photos.length}
        />
      )}

      <PhotoUploadForm spaceId={space.id} />

      <PhotoGrid spaceId={space.id} spaceName={space.name} photos={photos} />
    </div>
  )
}
