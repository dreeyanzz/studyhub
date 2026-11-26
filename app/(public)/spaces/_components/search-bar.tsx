'use client'

import { LocateFixed, Loader2, MapPin, Search, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { CEBU_CAMPUSES, resolveCampusCoordinates } from '@/lib/geo/campuses'
import { cn } from '@/lib/utils'

export interface QuickCampusChip {
  id: string
  label: string
  query: string
}

/**
 * Curated quick-select campus chips for the discovery search header (STORY-08 §3, FR-1.1).
 */
export const QUICK_CAMPUS_CHIPS: readonly QuickCampusChip[] = [
  { id: 'usc-tc', label: 'USC TC', query: 'USC TC' },
  { id: 'usc-main', label: 'USC Main', query: 'USC Main' },
  { id: 'cit-u', label: 'CIT-U', query: 'CIT-U' },
  { id: 'up-cebu', label: 'UP Cebu', query: 'UP Cebu' },
  { id: 'uc-main', label: 'UC Main', query: 'UC Main' },
  { id: 'usjr-main', label: 'USJ-R', query: 'USJ-R' },
] as const

export interface SearchBarProps {
  query: string
  lat?: number
  lng?: number
  onSearchChange: (q: string) => void
  onLocationSelect: (lat: number, lng: number) => void
  onClearLocation?: () => void
  className?: string
}

/**
 * SearchBar provides campus/text search, quick Metro Cebu campus chips,
 * and W3C Geolocation trigger for map discovery (STORY-08, FR-1.1, D-031).
 */
export function SearchBar({
  query,
  lat,
  lng,
  onSearchChange,
  onLocationSelect,
  onClearLocation,
  className,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(query)
  const [isLocating, setIsLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const hasUserLocation = lat !== undefined && lng !== undefined
  const matchedCampus = inputValue.trim()
    ? resolveCampusCoordinates(inputValue)
    : query.trim()
      ? resolveCampusCoordinates(query)
      : null

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setGeoError(null)
    onSearchChange(inputValue.trim())
  }

  const handleClearInput = () => {
    setInputValue('')
    setGeoError(null)
    onSearchChange('')
  }

  const handleCampusChipClick = (chip: QuickCampusChip) => {
    setGeoError(null)
    const isCurrentlyActive = matchedCampus?.id === chip.id && !hasUserLocation
    const nextQuery = isCurrentlyActive ? '' : chip.query
    setInputValue(nextQuery)
    onSearchChange(nextQuery)
  }

  const handleUseMyLocation = () => {
    setGeoError(null)

    if (hasUserLocation && onClearLocation) {
      onClearLocation()
      return
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        const nextLat = Number(position.coords.latitude.toFixed(6))
        const nextLng = Number(position.coords.longitude.toFixed(6))
        onLocationSelect(nextLat, nextLng)
      },
      (err) => {
        setIsLocating(false)
        if (err.code === 1) {
          setGeoError(
            'Location permission denied. Search by campus or area name instead.',
          )
        } else {
          setGeoError('Unable to retrieve your current location. Please try again.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }

  return (
    <div
      data-testid="discovery-search-bar"
      className={cn('mx-auto max-w-4xl space-y-4', className)}
    >
      {/* Floating centered pill search bar + location pill */}
      <div className="flex flex-col items-stretch justify-center gap-2.5 md:flex-row md:items-center">
        {/* Search Input Form inside an airy floating white pill */}
        <form
          role="search"
          aria-label="Search study spaces"
          onSubmit={handleSubmit}
          // Wraps, so at 200% text the Search button drops under the field instead of
          // running off the screen (SRS §3.2.2: no horizontal scrolling from 360 px).
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-3xl border border-border/70 bg-card p-1.5 shadow-[0_12px_30px_-14px_rgba(23,60,45,0.16)] transition-shadow focus-within:border-primary/50 focus-within:shadow-[0_14px_34px_-14px_rgba(33,92,63,0.22)] sm:rounded-full"
        >
          <div className="relative min-w-0 flex-1 basis-48">
            <label htmlFor="discovery-search-input" className="sr-only">
              Search by campus, city, or space name
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="discovery-search-input"
              data-testid="discovery-search-input"
              type="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Campus, city, or space name..."
              maxLength={100}
              className="min-h-12 w-full rounded-full bg-transparent pr-12 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
            {inputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClearInput}
                data-testid="clear-search-button"
                aria-label="Clear search query"
                className="absolute top-1/2 right-0 inline-flex min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            data-testid="search-submit-button"
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-[#f0c95c] px-6 py-2.5 text-sm font-semibold text-foreground shadow-xs transition-all duration-200 hover:bg-[#e5ba45] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
          >
            Search
          </button>
        </form>

        {/* W3C Geolocation Trigger Button (D-031: 48x48px minimum target) */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          aria-pressed={hasUserLocation}
          data-testid="use-my-location-button"
          className={cn(
            'inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium shadow-2xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:opacity-60',
            hasUserLocation
              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border-border/70 bg-card text-foreground hover:border-primary/40 hover:bg-secondary/60',
          )}
        >
          {isLocating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="size-4" aria-hidden="true" />
          )}
          <span>
            {isLocating
              ? 'Locating...'
              : hasUserLocation
                ? 'Using my location'
                : 'Use my location'}
          </span>
        </button>
      </div>

      {/* Centered floating Quick Campus Pills (Metro Cebu Campus Dictionary, FR-1.1) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MapPin className="size-3.5 text-primary" aria-hidden="true" />
          <span>Quick campuses:</span>
        </span>
        <div
          role="group"
          aria-label="Quick campus search"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {QUICK_CAMPUS_CHIPS.map((chip) => {
            const isActive = matchedCampus?.id === chip.id && !hasUserLocation
            const campusInfo = CEBU_CAMPUSES.find((c) => c.id === chip.id)
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isActive}
                title={campusInfo?.name ?? chip.label}
                data-testid={`campus-chip-${chip.id}`}
                onClick={() => handleCampusChipClick(chip)}
                className={cn(
                  'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border px-4 py-1.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                  isActive
                    ? 'border-foreground bg-foreground text-background shadow-sm'
                    : 'border-border/60 bg-card/95 text-foreground shadow-2xs hover:border-primary/40 hover:bg-secondary/70',
                )}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Campus Resolution / Geolocation Status Feedback */}
      {(matchedCampus || hasUserLocation || geoError) && (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-center gap-2 text-xs"
        >
          {hasUserLocation && (
            <span
              data-testid="active-location-banner"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary"
            >
              <LocateFixed className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Showing spaces near your coordinates ({lat?.toFixed(4)}, {lng?.toFixed(4)}
                )
              </span>
            </span>
          )}
          {!hasUserLocation && matchedCampus && (
            <span
              data-testid="active-campus-banner"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/80 px-3 py-1 font-medium text-secondary-foreground"
            >
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Campus match: {matchedCampus.name} (within {matchedCampus.radiusKm} km)
              </span>
            </span>
          )}
          {geoError && (
            <span
              role="status"
              data-testid="geolocation-error"
              className="font-medium text-destructive"
            >
              {geoError}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
