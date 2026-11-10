// STORY-11, TSK-11.2: Host photo grid component (D-031, D-063).
// Displays uploaded photos with previews, metadata, and accessible delete actions.

import Link from 'next/link'
import { Calendar, HardDrive, ImageOff, Trash2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/space/format'

export interface PhotoItem {
  name: string
  url: string
  sizeBytes?: number
  createdAt?: string
}

interface PhotoGridProps {
  spaceId: string
  spaceName: string
  photos: PhotoItem[]
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PhotoGrid({ spaceId, spaceName, photos }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            No Space photos uploaded yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add photos to showcase your study spots, amenities, and seating options to
            Seekers.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Uploaded Photos ({photos.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, index) => (
          <Card key={photo.name} className="overflow-hidden">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                // Design §2/§3: generic alt text, numbered in upload order. No "Photo of":
                // screen readers already say "image" (jsx-a11y/img-redundant-alt).
                alt={`${spaceName}, ${index + 1} of ${photos.length}`}
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                loading="lazy"
              />
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1 text-xs text-muted-foreground">
                {photo.sizeBytes !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{formatBytes(photo.sizeBytes)}</span>
                  </div>
                )}
                {photo.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Uploaded {formatDateTime(photo.createdAt)}</span>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <Link
                  href={`/host/spaces/${spaceId}/photos?remove=${encodeURIComponent(photo.name)}#confirm`}
                  className={buttonVariants({
                    variant: 'destructive',
                    className:
                      'h-12 w-full min-w-12 justify-center px-4 text-sm font-medium',
                  })}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete photo
                  <span className="sr-only">
                    {' '}
                    {index + 1} of {photos.length}
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
