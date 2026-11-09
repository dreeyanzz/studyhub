'use client'

import { List, Map as MapIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { SpaceCardList } from './space-card-list'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import { cn } from '@/lib/utils'

// Dynamic import for Leaflet map with SSR disabled to prevent `window is not defined` errors (D-012)
const DiscoveryMap = dynamic(() => import('./discovery-map'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="discovery-map-loading"
      className="flex h-full w-full animate-pulse items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground"
    >
      <div className="flex flex-col items-center gap-2">
        <MapIcon className="size-8 text-muted-foreground/50" />
        <span className="text-sm font-medium">Loading discovery map...</span>
      </div>
    </div>
  ),
})

interface DiscoveryShellProps {
  spaces: VerifiedSpaceSearchResult[]
  className?: string
}

/**
 * DiscoveryShell coordinates the responsive split-screen layout between
 * the space card list and interactive Leaflet map (STORY-08, FR-1.1, D-003, D-012).
 */
export function DiscoveryShell({ spaces, className }: DiscoveryShellProps) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const handleSelectSpace = (id: string) => {
    setActiveSpaceId(id)
  }

  const handleHoverSpace = (id: string | null) => {
    setHoveredSpaceId(id)
  }

  const toggleMobileView = () => {
    setMobileView((prev) => (prev === 'list' ? 'map' : 'list'))
  }

  return (
    <div className={cn('relative w-full', className)} data-testid="discovery-shell">
      {/* Main Split-Screen Container (Desktop >= 1024px) / Toggled Container (Mobile < 1024px) */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
        {/* Left Pane: Synchronized Space Card List */}
        <section
          aria-label="Study spaces list"
          className={cn(
            'w-full lg:w-[48%] xl:w-[45%]',
            mobileView === 'map' ? 'hidden lg:block' : 'block',
          )}
        >
          <SpaceCardList
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            hoveredSpaceId={hoveredSpaceId}
            onSelectSpace={handleSelectSpace}
            onHoverSpace={handleHoverSpace}
          />
        </section>

        {/* Right Pane: Sticky Leaflet Map */}
        <section
          aria-label="Discovery map"
          className={cn(
            'w-full lg:sticky lg:top-20 lg:w-[52%] xl:w-[55%]',
            mobileView === 'list' ? 'hidden lg:block' : 'block',
          )}
        >
          <div className="h-[calc(100vh-14rem)] min-h-[450px] w-full overflow-hidden rounded-2xl border border-border shadow-xs">
            <DiscoveryMap
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              hoveredSpaceId={hoveredSpaceId}
              onSelectSpace={handleSelectSpace}
              onHoverSpace={handleHoverSpace}
            />
          </div>
        </section>
      </div>

      {/* Floating Mobile Toggle Button (Visible only on < 1024px, D-031 48px touch target) */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          type="button"
          onClick={toggleMobileView}
          data-testid="mobile-view-toggle"
          aria-label={mobileView === 'list' ? 'Show map view' : 'Show list view'}
          className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {mobileView === 'list' ? (
            <>
              <MapIcon className="size-4" aria-hidden="true" />
              <span>Map view</span>
            </>
          ) : (
            <>
              <List className="size-4" aria-hidden="true" />
              <span>List view</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
