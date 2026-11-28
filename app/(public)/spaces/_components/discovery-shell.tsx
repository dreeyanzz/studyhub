'use client'

import { List, Map as MapIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterDrawer } from './filter-drawer'
import { FilterPanel, toggleFilterValue } from './filter-panel'
import { SearchBar } from './search-bar'
import { SpaceCardList } from './space-card-list'
import type { MapFocusRequest } from './discovery-map'
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
import {
  discoverySearchQuerySchema,
  type DiscoverySearchQuery,
  type HoursFilter,
  type PriceTier,
  type UnitTypeFilter,
} from '@/lib/validation/search'

/**
 * The next card-click focus request for the discovery map: always a new `seq`, so the
 * map re-centres even when the same card is clicked twice (FR-1.1).
 */
export function nextMapFocus(
  prev: MapFocusRequest | null,
  spaceId: string,
): MapFocusRequest {
  return { spaceId, seq: (prev?.seq ?? 0) + 1 }
}

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
 * Parses URLSearchParams into a normalized DiscoverySearchQuery, supporting both
 * repeated keys (`?tags=a&tags=b`) and comma-separated values (`?tags=a,b`).
 */
export function parseDiscoverySearchParams(
  searchParams: Pick<URLSearchParams, 'keys' | 'getAll'>,
): DiscoverySearchQuery {
  const raw: Record<string, string | string[]> = {}
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    raw[key] = values.length > 1 ? values : (values[0] ?? '')
  }

  const parsed = discoverySearchQuerySchema.safeParse(raw)
  return parsed.success ? normalizeDiscoveryQuery(parsed.data) : normalizeDiscoveryQuery()
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

    // 2b. Unit / room type inventory filter (FR-1.2)
    if (query.unitType.length > 0) {
      const spaceUnitTypes = space.unit_types ?? []
      const matchesUnitType = query.unitType.some((ut) => spaceUnitTypes.includes(ut))
      if (!matchesUnitType) continue
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

export type DiscoverySortOption = 'default' | 'open_now' | 'rating' | 'nearest'

/**
 * Sorts already-filtered Spaces according to the Seeker's chosen sort order (STORY-17).
 * Preserves relative order on ties.
 */
export function sortSpacesClientSide(
  spaces: VerifiedSpaceSearchResult[],
  sortBy: DiscoverySortOption,
  now: Date = new Date(),
): VerifiedSpaceSearchResult[] {
  if (sortBy === 'default' || spaces.length <= 1) {
    return spaces
  }

  const sorted = [...spaces]

  if (sortBy === 'open_now') {
    const currentManilaMinutes = getManilaMinutesFromDate(now)
    sorted.sort((a, b) => {
      const aOpen = isSpaceOpenNow(a.opens_at, a.closes_at, currentManilaMinutes) ? 1 : 0
      const bOpen = isSpaceOpenNow(b.opens_at, b.closes_at, currentManilaMinutes) ? 1 : 0
      return bOpen - aOpen
    })
    return sorted
  }

  if (sortBy === 'rating') {
    sorted.sort((a, b) => {
      const aRating = a.avg_overall ?? -1
      const bRating = b.avg_overall ?? -1
      if (bRating !== aRating) return bRating - aRating
      return b.review_count - a.review_count
    })
    return sorted
  }

  // sortBy === 'nearest'
  sorted.sort((a, b) => {
    const aDist = a.distance_km ?? Number.POSITIVE_INFINITY
    const bDist = b.distance_km ?? Number.POSITIVE_INFINITY
    return aDist - bDist
  })
  return sorted
}

/**
 * Synchronizes URL query parameters with DiscoveryShell state on the client without
 * triggering server round-trips on every filter click (STORY-08, Next.js 16 History API).
 *
 * Mounted inside its own `<Suspense fallback={null}>` boundary so `useSearchParams()`
 * never opts the surrounding `DiscoveryShell` out of static/ISR prerendering, and
 * skipped during isolated `renderToStaticMarkup` unit tests where AppRouterContext is absent.
 */
function DiscoveryUrlSync({
  pathname,
  lastWrittenQsRef,
  navigateRef,
  onSyncFromUrl,
}: {
  pathname: string
  lastWrittenQsRef: React.RefObject<string | null>
  navigateRef: React.RefObject<((queryString: string) => void) | null>
  onSyncFromUrl: (nextQuery: DiscoverySearchQuery) => void
}) {
  const searchParams = useSearchParams()
  const currentQs = searchParams.toString()

  useEffect(() => {
    navigateRef.current = (queryString: string) => {
      const nextHref = queryString ? `${pathname}?${queryString}` : pathname
      lastWrittenQsRef.current = queryString
      window.history.replaceState(null, '', nextHref)
    }
    return () => {
      navigateRef.current = null
    }
  }, [pathname, navigateRef, lastWrittenQsRef])

  useEffect(() => {
    // First mount with no query string: initial state is already empty, nothing to sync.
    if (lastWrittenQsRef.current === null && currentQs === '') {
      lastWrittenQsRef.current = ''
      return
    }
    // Ignore updates triggered by our own `window.history.replaceState`.
    if (lastWrittenQsRef.current === currentQs) {
      return
    }
    lastWrittenQsRef.current = currentQs
    onSyncFromUrl(parseDiscoverySearchParams(new URLSearchParams(currentQs)))
  }, [currentQs, lastWrittenQsRef, onSyncFromUrl])

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
  const lastWrittenQsRef = useRef<string | null>(null)

  const [query, setQuery] = useState<DiscoverySearchQuery>(() =>
    normalizeDiscoveryQuery(initialQuery),
  )
  const handleSyncFromUrl = useCallback((nextQuery: DiscoverySearchQuery) => {
    setQuery(nextQuery)
  }, [])
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<MapFocusRequest | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [sortBy, setSortBy] = useState<DiscoverySortOption>('default')

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
    () => sortSpacesClientSide(filterSpacesClientSide(spaces, query), sortBy),
    [spaces, query, sortBy],
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

  // A card click selects the Space and asks the map to fly to its pin and zoom in.
  // A new seq each time re-centres even when the same card is clicked twice (FR-1.1).
  const handleSelectSpaceFromCard = (id: string) => {
    setActiveSpaceId(id)
    setMapFocus((prev) => nextMapFocus(prev, id))
  }

  const handleHoverSpace = (id: string | null) => {
    setHoveredSpaceId(id)
  }

  const toggleMobileView = () => {
    setMobileView((prev) => (prev === 'list' ? 'map' : 'list'))
  }

  return (
    <div
      className={cn('relative w-full pb-24 lg:pb-0', className)}
      data-testid="discovery-shell"
    >
      {pathname !== null && (
        <Suspense fallback={null}>
          <DiscoveryUrlSync
            pathname={pathname}
            lastWrittenQsRef={lastWrittenQsRef}
            navigateRef={navigateRef}
            onSyncFromUrl={handleSyncFromUrl}
          />
        </Suspense>
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
          {displayedSpaces.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
              <label
                htmlFor="discovery-sort"
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Sort by
              </label>
              <select
                id="discovery-sort"
                data-testid="discovery-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as DiscoverySortOption)}
                className="min-h-12 max-w-full min-w-12 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="default">Recommended</option>
                <option value="open_now">Open now first</option>
                <option value="rating">Highest rated</option>
                <option value="nearest">Nearest</option>
              </select>
            </div>
          )}
          <SpaceCardList
            spaces={displayedSpaces}
            activeSpaceId={activeSpaceId}
            hoveredSpaceId={hoveredSpaceId}
            onSelectSpace={handleSelectSpaceFromCard}
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
          <div className="h-[calc(100vh-11rem)] min-h-[460px] w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[0_8px_30px_-12px_rgba(23,60,45,0.18)]">
            <DiscoveryMap
              spaces={displayedSpaces}
              activeSpaceId={activeSpaceId}
              hoveredSpaceId={hoveredSpaceId}
              onSelectSpace={handleSelectSpace}
              onHoverSpace={handleHoverSpace}
              focusRequest={mapFocus}
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
