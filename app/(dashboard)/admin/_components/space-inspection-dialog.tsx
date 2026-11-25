'use client'

import { useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  ImageOff,
  MapPin,
  User,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime, formatOpeningHours } from '@/lib/space/format'
import type { VerificationCardItem } from './verification-card'

interface SpaceInspectionDialogProps {
  space: VerificationCardItem | null
  isOpen: boolean
  onClose: () => void
  onApprove: (space: VerificationCardItem) => Promise<void>
  onReject: (space: VerificationCardItem) => Promise<void>
}

/**
 * Split Inspection Modal (STORY-15, FR-5.1, STORY-17).
 * Built with the accessible Dialog primitive (focus trap, Escape, aria-modal).
 * Displays real Space attributes (vicinity, hours, host, description, photos)
 * without fabricated capacity or mock amenities.
 */
export function SpaceInspectionDialog({
  space,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: SpaceInspectionDialogProps) {
  if (!space) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-3xl border-border/80 bg-card p-0 shadow-2xl sm:max-w-4xl"
        showCloseButton={true}
      >
        <SpaceInspectionDossier
          key={space.id}
          space={space}
          onClose={onClose}
          onApprove={onApprove}
          onReject={onReject}
        />
      </DialogContent>
    </Dialog>
  )
}

function SpaceInspectionDossier({
  space,
  onClose,
  onApprove,
  onReject,
}: {
  space: VerificationCardItem
  onClose: () => void
  onApprove: (space: VerificationCardItem) => Promise<void>
  onReject: (space: VerificationCardItem) => Promise<void>
}) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)

  const photos = space.photos ?? []
  const totalPhotos = photos.length
  const hasMultiplePhotos = totalPhotos > 1
  const hostDisplay = space.host_name?.trim() || 'Unnamed Host'
  const currentPhotoUrl = totalPhotos > 0 ? photos[photoIndex] : null

  function handleNextPhoto(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!hasMultiplePhotos) return
    setPhotoIndex((prev) => (prev + 1) % totalPhotos)
  }

  function handlePrevPhoto(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!hasMultiplePhotos) return
    setPhotoIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos)
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      await onApprove(space)
      onClose()
    } finally {
      setIsApproving(false)
    }
  }

  async function handleReject() {
    setIsRejecting(true)
    try {
      await onReject(space)
      onClose()
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="flex max-h-[90vh] flex-col overflow-hidden lg:grid lg:grid-cols-12">
      {/* Left Column (Col 5): Photo Section */}
      <div className="relative flex min-h-[240px] flex-col justify-between overflow-hidden bg-muted/40 sm:min-h-[300px] lg:col-span-5 lg:min-h-[520px]">
        {totalPhotos > 0 && currentPhotoUrl ? (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-foreground/90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentPhotoUrl}
              src={currentPhotoUrl}
              alt={`${space.name} (${photoIndex + 1} of ${totalPhotos})`}
              className="h-full w-full object-cover transition-all duration-300"
            />

            <div className="absolute top-4 left-4 z-20">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                <ImageIcon className="size-3.5 text-primary" aria-hidden="true" />
                <span>
                  Photo {photoIndex + 1} of {totalPhotos}
                </span>
              </span>
            </div>

            {hasMultiplePhotos && (
              <>
                <button
                  type="button"
                  onClick={handlePrevPhoto}
                  className="absolute left-3 z-20 flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-md transition-all hover:bg-background active:scale-95"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPhoto}
                  className="absolute right-3 z-20 flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-md transition-all hover:bg-background active:scale-95"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-2xs">
              <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-bold text-foreground">No photos attached</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              No photos are currently attached to this Space listing. Review the physical
              details and operating schedule on the right.
            </p>
          </div>
        )}
      </div>

      {/* Right Column (Col 7): Space Dossier */}
      <div className="flex flex-1 flex-col overflow-hidden bg-card lg:col-span-7">
        <DialogHeader className="border-b border-border/80 bg-muted/20 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {space.name}
            </DialogTitle>
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            >
              Pending Verification
            </Badge>
          </div>
          <DialogDescription className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="wrap-anywhere">{space.address}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
          {/* Physical Address & External Maps Check */}
          <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                <span>Physical Address & Vicinity</span>
              </div>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(space.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <span>Open in OpenStreetMap</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Verify that the physical address corresponds to an accessible location near
              student hubs.
            </p>
          </div>

          {/* Operating Schedule & Host Info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Clock className="size-3.5 text-primary" aria-hidden="true" />
                <span>Operating Hours</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {formatOpeningHours(space.opens_at, space.closes_at)}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <User className="size-3.5 text-primary" aria-hidden="true" />
                <span>Host</span>
              </div>
              <p className="mt-1 text-xs font-semibold wrap-anywhere text-foreground">
                {hostDisplay}
              </p>
            </div>
          </div>

          {/* Submission Timestamp */}
          <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Calendar className="size-3.5 text-primary" aria-hidden="true" />
              <span>Submitted for Review</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-foreground">
              <time dateTime={space.created_at}>{formatDateTime(space.created_at)}</time>
            </p>
          </div>

          {/* Space Description */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Host Description
            </p>
            <p className="mt-1 text-xs leading-relaxed wrap-anywhere text-foreground italic">
              &ldquo;{space.description || 'No description provided by the host.'}&rdquo;
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] min-w-[48px] gap-2 rounded-xl border-destructive/40 bg-destructive/5 px-4 text-xs font-semibold text-destructive hover:bg-destructive/15"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
          >
            <XCircle className="size-4" aria-hidden="true" />
            <span>{isRejecting ? 'Rejecting...' : 'Reject Space'}</span>
          </Button>

          <Button
            type="button"
            className="min-h-[48px] min-w-[48px] gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            <span>{isApproving ? 'Approving...' : 'Approve & Publish'}</span>
          </Button>
        </DialogFooter>
      </div>
    </div>
  )
}
