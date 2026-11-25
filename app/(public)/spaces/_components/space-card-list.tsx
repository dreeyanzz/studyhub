'use client'

import { SearchX } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { SpaceCard } from '@/components/discovery/space-card'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import { cn } from '@/lib/utils'

interface SpaceCardListProps {
  spaces: VerifiedSpaceSearchResult[]
  activeSpaceId: string | null
  hoveredSpaceId: string | null
  onSelectSpace: (id: string) => void
  onHoverSpace: (id: string | null) => void
  onClearFilters?: () => void
  className?: string
}

/**
 * SpaceCardList renders the scrollable list of matching study spaces (STORY-08, FR-1.1, D-003).
 * Synchronizes scroll and highlight state with map selection.
 */
export function SpaceCardList({
  spaces,
  activeSpaceId,
  hoveredSpaceId,
  onSelectSpace,
  onHoverSpace,
  onClearFilters,
  className,
}: SpaceCardListProps) {
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  // "Reset all filters" disappears once results come back, so move focus to the list,
  // which stays mounted, instead of letting it drop to the top of the page (TSK-08.6).
  const handleResetFilters = () => {
    onClearFilters?.()
    listRef.current?.focus()
  }

  // Scroll active card into view when selected on map
  useEffect(() => {
    if (activeSpaceId) {
      const el = itemRefs.current.get(activeSpaceId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [activeSpaceId])

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className={cn('outline-none', className)}
      data-testid="space-card-list"
    >
      {/* Screen Reader polite announcement (always mounted so empty transitions are announced) */}
      <div aria-live="polite" className="sr-only">
        {spaces.length} study {spaces.length === 1 ? 'space' : 'spaces'} found
      </div>

      {spaces.length === 0 ? (
        <div
          data-testid="seeker-search-no-results"
          className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="size-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold text-foreground">
            No study spaces found matching your criteria.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Try expanding your search area or clearing some filters.
          </p>
          <div className="mt-6">
            {onClearFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                data-testid="reset-all-filters-button"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Reset all filters
              </button>
            ) : (
              <Link
                href="/spaces"
                data-testid="reset-all-filters-button"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Reset all filters
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Result Count Header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">{spaces.length}</span>{' '}
              {spaces.length === 1 ? 'space' : 'spaces'}
            </p>
          </div>

          {/* Card Feed */}
          <div className="flex flex-col gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                ref={(node) => {
                  if (node) {
                    itemRefs.current.set(space.id, node)
                  } else {
                    itemRefs.current.delete(space.id)
                  }
                }}
              >
                <SpaceCard
                  space={space}
                  isActive={space.id === activeSpaceId}
                  isHovered={space.id === hoveredSpaceId}
                  onSelect={onSelectSpace}
                  onHover={onHoverSpace}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
