'use client'

import { List, Map as MapIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FilterDrawer } from './filter-drawer'
import { FilterPanel, toggleFilterValue } from './filter-panel'
import { SearchBar } from './search-bar'
import { SpaceCardList } from './space-card-list'
import {
  getManilaMinutesFromDate,
  isSpaceOpen24h,
  isSpaceOpenLate,
  isSpaceOpenNow,
  type VerifiedSpaceSearchResult,
} from '@/lib/data/spaces'
import { resolveCampusCoordinates } from '@/lib/geo/campuses'
import { haversineDistance } from '@/lib/geo/haversine'
import { cn } from '@/lib/utils'
import type {
  DiscoverySearchQuery,
  HoursFilter,
  PriceTier,
  UnitTypeFilter,
} from '@/lib/validation/search'

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

const DEFAULT_CEBU_CENTER: [number, number] = [10.3157, 123.8854]
const DEFAULT_CEBU_ZOOM = 13
const FOCUSED_SEARCH_ZOOM = 15

export function normalizeDiscoveryQuery(
  input?: Partial<DiscoverySearchQuery>,
): DiscoverySearchQuery {
  return {
    q: input?.q?.trim() || undefined,
    lat: input?.lat,
    lng: input?.lng,
    radiusKm: input?.radiusKm ?? 10,
    tags: input?.tags ? [...input.tags] : [],
    price: input?.price ? [...input.price] : [],
    hours: input?.hours ? [...input.hours] : [],
    unitType: input?.unitType ? [...input.unitType] : [],
  }
}

/**
 * Serializes a DiscoverySearchQuery into a URL query string for `/spaces`.
 */
export function buildDiscoveryQueryString(query: DiscoverySearchQuery): string {
  const params = new URLSearchParams()

  if (query.q && query.q.trim().length > 0) {
    params.set('q', query.q.trim())
  }

  if (query.lat !== undefined && query.lng !== undefined) {
    params.set('lat', String(query.lat))
    params.set('lng', String(query.lng))
  }

  if (query.radiusKm !== undefined && query.radiusKm !== 10) {
    params.set('radiusKm', String(query.radiusKm))
  }

  for (const tag of query.tags) {
    params.append('tags', tag)
  }

  for (const tier of query.price) {
    params.append('price', tier)
  }

  for (const hour of query.hours) {
    params.append('hours', hour)
  }

  for (const unit of query.unitType) {
    params.append('unitType', unit)
  }

  return params.toString()
}

/**
 * Resolves the target map center and zoom level from active geolocation or campus search.
 */
export function resolveDiscoveryMapCenter(query: DiscoverySearchQuery): {
  center: [number, number]
  zoom: number
} {
  if (query.lat !== undefined && query.lng !== undefined) {
    return {
      center: [query.lat, query.lng],
      zoom: FOCUSED_SEARCH_ZOOM,
    }
  }

  if (query.q) {
    const campus = resolveCampusCoordinates(query.q)
    if (campus) {
      return {
        center: [campus.latitude, campus.longitude],
        zoom: FOCUSED_SEARCH_ZOOM,
      }
    }
  }

  return {
    center: DEFAULT_CEBU_CENTER,
    zoom: DEFAULT_CEBU_ZOOM,
  }
}

/**
 * Evaluates multi-criteria filters with strict AND logic against a list of verified spaces
 * (STORY-08, FR-1.1, FR-1.2, D-048). Enables instant filter application and restoration
 * without a full page reload.
 */
export function filterSpacesClientSide(
  spaces: VerifiedSpaceSearchResult[],
  query: DiscoverySearchQuery,
  now: Date = new Date(),
): VerifiedSpaceSearchResult[] {
  let centerLat = query.lat
  let centerLng = query.lng
  let searchRadius = query.radiusKm ?? 10
  let textFilter = query.q?.trim()
  let isGeoSearch = centerLat !== undefined && centerLng !== undefined

  if (!isGeoSearch && textFilter) {
    const campus = resolveCampusCoordinates(textFilter)
    if (campus) {
      centerLat = campus.latitude
      centerLng = campus.longitude
      searchRadius = campus.radiusKm
      isGeoSearch = true
      textFilter = undefined
    }
  }

  const currentManilaMinutes = getManilaMinutesFromDate(now)
  const results: VerifiedSpaceSearchResult[] = []

  for (const space of spaces) {
    // 1. Strict AND curated amenity tags
    if (query.tags.length > 0) {
      const spaceTagIds = new Set(space.curated_tags.map((t) => t.id))
      const matchesAllTags = query.tags.every((tagId) => spaceTagIds.has(tagId))
      if (!matchesAllTags) continue
    }

    // 2. Price tier filter
    if (query.price.length > 0 && !query.price.includes(space.price_tier)) {
      continue
    }

    // 3. Dynamic operating hours filter (Asia/Manila UTC+8, D-048)
    if (query.hours.length > 0) {
      let matchesAllHours = true
      for (const hourCrit of query.hours) {
        if (
          hourCrit === 'open_now' &&
          !isSpaceOpenNow(space.opens_at, space.closes_at, currentManilaMinutes)
        ) {
          matchesAllHours = false
          break
        }
        if (
          hourCrit === 'open_late' &&
          !isSpaceOpenLate(space.opens_at, space.closes_at)
        ) {
          matchesAllHours = false
          break
        }
        if (hourCrit === 'open_24h' && !isSpaceOpen24h(space.opens_at, space.closes_at)) {
          matchesAllHours = false
          break
        }
      }
      if (!matchesAllHours) continue
    }

    // 4. Text fallback on name or address when not a recognized campus
    if (textFilter) {
      const needle = textFilter.toLowerCase()
      const matchesName = space.name.toLowerCase().includes(needle)
      const matchesAddress = space.address.toLowerCase().includes(needle)
      if (!matchesName && !matchesAddress) continue
    }

    // 5. Haversine distance & radius filtering
    let distanceKm = space.distance_km
    if (centerLat !== undefined && centerLng !== undefined) {
      if (space.latitude === null || space.longitude === null) {
        if (isGeoSearch) continue
      } else {
        const dist = haversineDistance(
          centerLat,
          centerLng,
          space.latitude,
          space.longitude,
        )
        if (isGeoSearch && dist > searchRadius) {
          continue
        }
        distanceKm = Math.round(dist * 10) / 10
      }
    }

    results.push({
      ...space,
      distance_km: distanceKm,
    })
  }

  if (isGeoSearch) {
    results.sort((a, b) => {
      if (a.distance_km === null) return 1
      if (b.distance_km === null) return -1
      return a.distance_km - b.distance_km
    })
  }

  return results
}

/**
 * Bridges client-side URL updates to Next.js App Router when mounted inside a route.
 * Skipped during isolated `renderToStaticMarkup` unit tests where AppRouterContext is absent.
 */
function DiscoveryRouterBridge({
  pathname,
  navigateRef,
}: {
  pathname: string
  navigateRef: React.RefObject<((queryString: string) => void) | null>
}) {
  const router = useRouter()

  useEffect(() => {
    navigateRef.current = (queryString: string) => {
      const nextHref = queryString ? `${pathname}?${queryString}` : pathname
      router.push(nextHref, { scroll: false })
    }
    return () => {
      navigateRef.current = null
    }
  }, [pathname, router, navigateRef])

  return null
}

export interface DiscoveryShellProps {
  spaces: VerifiedSpaceSearchResult[]
  initialQuery?: Partial<DiscoverySearchQuery>
  onQueryChange?: (nextQuery: DiscoverySearchQuery, queryString: string) => void
  className?: string
}

/**
 * DiscoveryShell coordinates the search bar, multi-criteria curated filter panel,
 * mobile filter drawer, and responsive split-screen layout between the space card list
 * and interactive Leaflet map (STORY-08, FR-1.1, FR-1.2, D-003, D-012, D-031).
 */
export function DiscoveryShell({
  spaces,
  initialQuery,
  onQueryChange,
  className,
}: DiscoveryShellProps) {
  const pathname = usePathname()
  const navigateRef = useRef<((queryString: string) => void) | null>(null)

  const [query, setQuery] = useState<DiscoverySearchQuery>(() =>
    normalizeDiscoveryQuery(initialQuery),
  )
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const applyNextQuery = (nextQuery: DiscoverySearchQuery) => {
    setQuery(nextQuery)
    const qs = buildDiscoveryQueryString(nextQuery)
    onQueryChange?.(nextQuery, qs)
    navigateRef.current?.(qs)
  }

  const handleSearchChange = (q: string) => {
    applyNextQuery({
      ...query,
      q: q.trim() || undefined,
      // When user explicitly searches by campus/text, clear GPS coordinate override
      lat: undefined,
      lng: undefined,
    })
  }

  const handleLocationSelect = (lat: number, lng: number) => {
    applyNextQuery({
      ...query,
      lat,
      lng,
    })
  }

  const handleClearLocation = () => {
    applyNextQuery({
      ...query,
      lat: undefined,
      lng: undefined,
    })
  }

  const handleToggleTag = (tagId: string) => {
    applyNextQuery({
      ...query,
      tags: toggleFilterValue(query.tags, tagId),
    })
  }

  const handleTogglePrice = (tier: PriceTier) => {
    applyNextQuery({
      ...query,
      price: toggleFilterValue(query.price, tier),
    })
  }

  const handleToggleHours = (hours: HoursFilter) => {
    applyNextQuery({
      ...query,
      hours: toggleFilterValue(query.hours, hours),
    })
  }

  const handleToggleUnitType = (unitType: UnitTypeFilter) => {
    applyNextQuery({
      ...query,
      unitType: toggleFilterValue(query.unitType, unitType),
    })
  }

  const handleClearAllFilters = () => {
    applyNextQuery({
      q: undefined,
      lat: undefined,
      lng: undefined,
      radiusKm: 10,
      tags: [],
      price: [],
      hours: [],
      unitType: [],
    })
  }

  const displayedSpaces = useMemo(
    () => filterSpacesClientSide(spaces, query),
    [spaces, query],
  )

  const { center: mapCenter, zoom: mapZoom } = useMemo(
    () => resolveDiscoveryMapCenter(query),
    [query],
  )

  const activeFilters = useMemo(
    () => ({
      tags: query.tags,
      price: query.price,
      hours: query.hours,
      unitType: query.unitType,
    }),
    [query.tags, query.price, query.hours, query.unitType],
  )

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
      {pathname !== null && (
        <DiscoveryRouterBridge pathname={pathname} navigateRef={navigateRef} />
      )}

      {/* Search Header: Text Search, Quick Campus Chips & Geolocation Trigger */}
      <SearchBar
        key={query.q ?? ''}
        query={query.q ?? ''}
        lat={query.lat}
        lng={query.lng}
        onSearchChange={handleSearchChange}
        onLocationSelect={handleLocationSelect}
        onClearLocation={handleClearLocation}
        className="mb-4"
      />

      {/* Desktop Filter Panel (>= 1024px) */}
      <div className="mb-6 hidden lg:block">
        <FilterPanel
          filters={activeFilters}
          onToggleTag={handleToggleTag}
          onTogglePrice={handleTogglePrice}
          onToggleHours={handleToggleHours}
          onToggleUnitType={handleToggleUnitType}
          onClearAll={handleClearAllFilters}
        />
      </div>

      {/* Mobile Filter Drawer Trigger & Bottom Sheet (< 1024px) */}
      <FilterDrawer
        filters={activeFilters}
        resultCount={displayedSpaces.length}
        onToggleTag={handleToggleTag}
        onTogglePrice={handleTogglePrice}
        onToggleHours={handleToggleHours}
        onToggleUnitType={handleToggleUnitType}
        onClearAll={handleClearAllFilters}
        className="mb-4"
      />

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
            spaces={displayedSpaces}
            activeSpaceId={activeSpaceId}
            hoveredSpaceId={hoveredSpaceId}
            onSelectSpace={handleSelectSpace}
            onHoverSpace={handleHoverSpace}
            onClearFilters={handleClearAllFilters}
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
              spaces={displayedSpaces}
              activeSpaceId={activeSpaceId}
              hoveredSpaceId={hoveredSpaceId}
              onSelectSpace={handleSelectSpace}
              onHoverSpace={handleHoverSpace}
              center={mapCenter}
              zoom={mapZoom}
            />
          </div>
        </section>
      </div>

      {/* Floating Mobile Toggle Button (Visible only on < 1024px, D-031 48px touch target) */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        {/* Screen reader polite announcement for mobile view mode (§3 Accessibility).
            In map view the list, and its own result count, are hidden, so this one says
            the count, and announces it again when a filter changes it. */}
        <div aria-live="polite" className="sr-only">
          {mobileView === 'list'
            ? 'Showing list view'
            : `Showing map view, ${displayedSpaces.length} study ${
                displayedSpaces.length === 1 ? 'space' : 'spaces'
              } found`}
        </div>

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
