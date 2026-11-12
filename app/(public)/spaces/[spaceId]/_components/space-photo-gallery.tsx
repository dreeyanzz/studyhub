'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SpacePhoto {
  name: string
  url: string
}

interface SpacePhotoGalleryProps {
  spaceName: string
  photos: SpacePhoto[]
  className?: string
}

/**
 * Responsive Space Photo Gallery & Carousel (STORY-11, TSK-11.4, FR-1.3, D-031).
 *
 * Implements:
 * - Chronological listing with the first uploaded photo acting as the cover photo.
 * - Next.js Image optimization with domain configuration in next.config.ts.
 * - Desktop hero view with slide counter, next/prev controls, and thumbnail strip.
 * - Mobile/tablet touch-friendly swipeable carousel with 48x48 px touch targets.
 * - Full keyboard navigation (Left/Right arrows on controls & thumbnails).
 * - Declared role="region" and aria-roledescription="carousel" for accessibility.
 * - Graceful fallback card when the space has no uploaded photos.
 */
export function SpacePhotoGallery({
  spaceName,
  photos,
  className,
}: SpacePhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const totalPhotos = photos.length
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const goToNext = useCallback(() => {
    if (totalPhotos <= 1) return
    setCurrentIndex((prev) => (prev + 1) % totalPhotos)
  }, [totalPhotos])

  const goToPrev = useCallback(() => {
    if (totalPhotos <= 1) return
    setCurrentIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos)
  }, [totalPhotos])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (totalPhotos <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    },
    [goToNext, goToPrev, totalPhotos],
  )

  // Empty state fallback when no photos exist
  if (totalPhotos === 0) {
    return (
      <div
        data-testid="space-photos-empty"
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center sm:p-12',
          className,
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          No Space photos uploaded yet
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Photos of this space will appear here once the host uploads them.
        </p>
      </div>
    )
  }

  const safeIndex = currentIndex >= totalPhotos ? 0 : currentIndex
  const currentPhoto = photos[safeIndex] ?? photos[0]
  if (!currentPhoto) {
    return null
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`Photos of ${spaceName}`}
      className={cn('group relative min-w-0 space-y-3 rounded-xl', className)}
    >
      {/* Hero Image Container with Touch Navigation */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted sm:aspect-2/1"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
          touchStartY.current = e.touches[0]?.clientY ?? null
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || touchStartY.current === null) return
          const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
          const endY = e.changedTouches[0]?.clientY ?? touchStartY.current
          const diffX = touchStartX.current - endX
          const diffY = touchStartY.current - endY

          // Only trigger if horizontal swipe is dominant and exceeds 40 px threshold
          if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
            if (diffX > 0) {
              goToNext()
            } else {
              goToPrev()
            }
          }
          touchStartX.current = null
          touchStartY.current = null
        }}
      >
        <Image
          src={currentPhoto.url}
          alt={`Photo of ${spaceName} (${safeIndex + 1} of ${totalPhotos})`}
          fill
          priority={safeIndex === 0}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
          className="object-cover"
        />

        {/* Slide Counter Overlay */}
        <div
          data-testid="carousel-counter"
          aria-live="polite"
          className="absolute top-3 right-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs"
        >
          <span>
            {safeIndex + 1} / {totalPhotos}
          </span>
          <span className="sr-only">
            , Slide {safeIndex + 1} of {totalPhotos}
          </span>
        </div>

        {/* Navigation Controls (D-031: 48x48 px touch targets) */}
        {totalPhotos > 1 && (
          <div className="pointer-events-none absolute inset-x-2 inset-y-0 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrev}
              onKeyDown={handleKeyDown}
              aria-label="Previous slide"
              className="pointer-events-auto inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-xs transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              onKeyDown={handleKeyDown}
              aria-label="Next slide"
              className="pointer-events-auto inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-xs transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail Preview Strip for Desktop & Tablet */}
      {totalPhotos > 1 && (
        <div
          role="group"
          aria-label="Photo thumbnails"
          className="flex min-w-0 gap-2 overflow-x-auto py-1"
        >
          {photos.map((photo, index) => {
            const isSelected = index === safeIndex
            return (
              <button
                key={photo.name}
                type="button"
                onClick={() => setCurrentIndex(index)}
                onKeyDown={handleKeyDown}
                aria-label={`Show photo ${index + 1} of ${totalPhotos}`}
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  isSelected
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
