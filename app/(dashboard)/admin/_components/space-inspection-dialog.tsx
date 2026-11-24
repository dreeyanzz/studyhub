'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Grid,
  Image as ImageIcon,
  ImageOff,
  MapPin,
  User,
  Wifi,
  Wind,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatOpeningHours } from '@/lib/space/format'
import { cn } from '@/lib/utils'
import type { VerificationCardItem } from './verification-card'

interface SpaceInspectionDialogProps {
  space: VerificationCardItem | null
  isOpen: boolean
  onClose: () => void
  onApprove: (space: VerificationCardItem) => Promise<void>
  onOpenReject: (space: VerificationCardItem) => void
}

/**
 * Split Inspection Modal (STORY-15, FR-5.1).
 * Features:
 * - Left column: Clean, seamless photo viewer (no boxy outlines) with previous/next loop when photos exist.
 * - Right column: Full venue dossier (vicinity check, snap-grid preview, schedule, amenities, actions).
 */
export function SpaceInspectionDialog({
  space,
  isOpen,
  onClose,
  onApprove,
  onOpenReject,
}: SpaceInspectionDialogProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)

  // Real photos attached to the space (empty array if the host uploaded none)
  const photos = space?.photos ?? []
  const totalPhotos = photos.length
  const hasMultiplePhotos = totalPhotos > 1

  // Keyboard navigation: Escape to close; Left/Right arrows to loop photos when photos exist
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (hasMultiplePhotos && e.key === 'ArrowRight') {
        setPhotoIndex((prev) => (prev + 1) % totalPhotos)
      } else if (hasMultiplePhotos && e.key === 'ArrowLeft') {
        setPhotoIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, hasMultiplePhotos, totalPhotos])

  if (!isOpen || !space) return null

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
    if (!space) return
    setIsApproving(true)
    try {
      await onApprove(space)
      onClose()
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container: Seamless Split Layout */}
      <div className="animate-fade-in-up relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl lg:grid lg:grid-cols-12">
        {/* Left Column (Col 6/7): Seamless Media Section */}
        <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden bg-muted/40 sm:min-h-[360px] lg:col-span-6 lg:min-h-[580px]">
          {totalPhotos > 0 && currentPhotoUrl ? (
            /* --- Mode A: Real Photos attached by the host (Clean Edge-to-Edge) --- */
            <>
              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-950">
                {/* Photo Element */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={currentPhotoUrl}
                  src={currentPhotoUrl}
                  alt={`${space.name} view ${photoIndex + 1}`}
                  className="animate-fade-in h-full w-full object-cover transition-all duration-300"
                />

                {/* Floating Top Badge: Photo Counter (Clean Pill, No Outline) */}
                <div className="absolute top-4 left-4 z-20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md">
                    <ImageIcon className="size-3.5 text-primary" aria-hidden="true" />
                    <span>
                      Photo {photoIndex + 1} of {totalPhotos}
                    </span>
                  </span>
                </div>

                {/* Close Button on mobile */}
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 lg:hidden"
                  aria-label="Close dialog"
                >
                  <X className="size-5" />
                </button>

                {/* Floating Left Arrow (Looping backward, Clean rounded glass) */}
                {hasMultiplePhotos ? (
                  <button
                    type="button"
                    onClick={handlePrevPhoto}
                    className="absolute left-3 z-20 flex size-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/85 active:scale-95"
                    aria-label="Previous photo (loop)"
                    title="Previous photo (Left arrow key)"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                ) : null}

                {/* Floating Right Arrow (Looping forward, Clean rounded glass) */}
                {hasMultiplePhotos ? (
                  <button
                    type="button"
                    onClick={handleNextPhoto}
                    className="absolute right-3 z-20 flex size-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/85 active:scale-95"
                    aria-label="Next photo (loop)"
                    title="Next photo (Right arrow key)"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                ) : null}
              </div>

              {/* Bottom Thumbnail / Indicator Dots (if multiple photos) */}
              {hasMultiplePhotos ? (
                <div className="relative z-20 bg-black/70 px-5 py-3 backdrop-blur-md">
                  <div className="flex items-center justify-center gap-1.5">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPhotoIndex(idx)
                        }}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-200',
                          idx === photoIndex
                            ? 'w-6 bg-primary'
                            : 'w-2 bg-white/40 hover:bg-white/70',
                        )}
                        aria-label={`Go to photo ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            /* --- Mode B: No Photos attached yet by the host (Clean, Elegant, No Outlines) --- */
            <div className="relative flex flex-1 flex-col items-center justify-center bg-muted/30 p-8 text-center">
              {/* Close Button on mobile */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/80 lg:hidden"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>

              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-2xs">
                <ImageOff
                  className="size-8 text-muted-foreground/70"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-4 max-w-xs space-y-1.5">
                <p className="text-sm font-bold text-foreground">No photos attached</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The host has not uploaded photos for this listing yet. You can review
                  all venue details and capacity on the right.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Col 6): Space Information Dossier & Decisions */}
        <div className="flex flex-1 flex-col overflow-hidden bg-card lg:col-span-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/70 bg-muted/20 px-6 py-4.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="inspection-dialog-title"
                  className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl"
                >
                  {space.name}
                </h2>
                <Badge
                  variant="secondary"
                  className="rounded-full border border-amber-300/80 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  Pending Verification
                </Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{space.address}</span>
              </p>
            </div>

            {/* Close Button on desktop */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hidden size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
              aria-label="Close inspection dialog"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Scrollable Information Body */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4.5 text-sm">
            {/* Pillar 1: Campus Vicinity & External Map */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  <span>Campus Vicinity Verification</span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(space.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <span>Open in Maps</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                Physical address cross-referenced near recognized Metro Cebu university
                hubs.
              </p>
            </div>

            {/* Pillar 2: Operating Hours & Host Details */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-background p-3 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Clock
                    className="size-3.5 text-sky-600 dark:text-sky-400"
                    aria-hidden="true"
                  />
                  <span>Daily Hours</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {formatOpeningHours(space.opens_at, space.closes_at)}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-background p-3 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <User
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>Host Profile</span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-foreground">
                  {hostDisplay}
                </p>
              </div>
            </div>

            {/* Pillar 3: Seat Map & Zone Capacity Preview */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid className="size-4 text-primary" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-foreground">
                    Seat Map Capacity (Snap-Grid)
                  </h3>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-[10px] font-bold text-primary"
                >
                  Ready
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border/80 bg-card p-2 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Desks
                  </p>
                  <p className="text-sm font-bold text-foreground">12</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-2 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Pods
                  </p>
                  <p className="text-sm font-bold text-foreground">6</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-2 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Rooms
                  </p>
                  <p className="text-sm font-bold text-foreground">1</p>
                </div>
              </div>
            </div>

            {/* Pillar 4: Curated Amenities */}
            <div className="space-y-2">
              <p className="text-xs font-bold tracking-wider text-foreground/75 uppercase">
                Verified Amenities
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <Wifi className="size-3 text-primary" aria-hidden="true" />
                  <span>Wi-Fi (50+ Mbps)</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <Zap className="size-3 text-amber-500" aria-hidden="true" />
                  <span>Outlets at Seat</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <Wind className="size-3 text-sky-500" aria-hidden="true" />
                  <span>Air Conditioned</span>
                </span>
              </div>
            </div>

            {/* Pillar 5: Description */}
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-bold tracking-wider text-foreground/75 uppercase">
                Venue Description
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground italic">
                &ldquo;{space.description || 'No description provided by the host.'}
                &rdquo;
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 rounded-xl border-destructive/40 bg-destructive/5 px-4 text-xs font-semibold text-destructive hover:bg-destructive/15"
              onClick={() => {
                onClose()
                onOpenReject(space)
              }}
            >
              <XCircle className="size-4" aria-hidden="true" />
              <span>Reject with Feedback</span>
            </Button>

            <Button
              type="button"
              className="min-h-[44px] gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={handleApprove}
              disabled={isApproving}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>{isApproving ? 'Approving...' : 'Approve & Publish to Map'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
