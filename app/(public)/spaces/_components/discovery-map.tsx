'use client'

import type * as LeafletType from 'leaflet'
import { LocateFixed } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PRICE_TIER_LABELS } from '@/components/discovery/price-tier-badge'
import { formatReviewRating } from '@/components/review/review-rating'
import { isSpaceOpen24h, type VerifiedSpaceSearchResult } from '@/lib/data/spaces'
import type { PriceTier } from '@/lib/validation/search'

interface DiscoveryMapProps {
  spaces: VerifiedSpaceSearchResult[]
  activeSpaceId: string | null
  hoveredSpaceId: string | null
  onSelectSpace: (id: string) => void
  onHoverSpace: (id: string | null) => void
  center?: [number, number]
  zoom?: number
  className?: string
}

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854] // Cebu City center (D-012)
const DEFAULT_ZOOM = 13

function getPinColor(tier: PriceTier): string {
  switch (tier) {
    case 'free':
      return '#059669' // emerald-600
    case 'premium':
      return '#7c3aed' // purple-600
    case 'standard':
      return '#d97706' // amber-600
    case 'budget':
    default:
      return '#0284c7' // sky-600
  }
}

/**
 * Creates an SVG map pin DivIcon with a floating dark-green name + rating pill
 * beside the pin (STORY-17).
 */
function createSvgPin(
  L: typeof LeafletType,
  space: Pick<
    VerifiedSpaceSearchResult,
    'name' | 'price_tier' | 'avg_overall' | 'review_count'
  >,
  isActive: boolean,
  isHovered: boolean,
) {
  const color = getPinColor(space.price_tier)
  const isElevated = isActive || isHovered
  const scale = isActive ? 1.15 : isHovered ? 1.08 : 1.0
  const zIndex = isActive ? 1000 : isHovered ? 900 : 500
  const ratingText =
    space.review_count > 0 && space.avg_overall !== null
      ? `${space.avg_overall.toFixed(1)} ★`
      : 'New'
  const pillBg = isActive ? '#f0c95c' : '#153528'
  const pillText = isActive ? '#173c2d' : '#ffffff'
  const pillStarColor = isActive ? '#173c2d' : '#f0c95c'
  const pillBorder = isElevated ? '#ffffff' : 'rgba(255,255,255,0.22)'

  const svg = `
    <div style="position: relative; width: 48px; height: 48px; transform: scale(${scale}); transform-origin: 24px 46px; transition: transform 0.15s ease-out; z-index: ${zIndex}; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.35));">
        <path d="M17 0C7.611 0 0 7.611 0 17C0 28.5 17 44 17 44C17 44 34 28.5 34 17C34 7.611 26.389 0 17 0Z" fill="${color}" stroke="${isElevated ? '#ffffff' : 'rgba(255,255,255,0.7)'}" stroke-width="${isElevated ? '2.5' : '1.5'}"/>
        <circle cx="17" cy="16" r="8" fill="#ffffff"/>
        <circle cx="17" cy="16" r="5" fill="${color}"/>
      </svg>
      <div style="position: absolute; left: 42px; top: 4px; display: inline-flex; flex-direction: column; gap: 1px; max-width: 160px; padding: 4px 9px; border-radius: 10px; background: ${pillBg}; color: ${pillText}; border: 1.5px solid ${pillBorder}; box-shadow: 0 4px 12px rgba(0,0,0,0.28); backdrop-filter: blur(6px); pointer-events: auto;">
        <span style="font-size: 11px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(space.name)}</span>
        <span style="font-size: 10px; font-weight: 600; line-height: 1.2; color: ${pillStarColor}; white-space: nowrap;">${escapeHtml(ratingText)}</span>
      </div>
    </div>
  `

  return L.divIcon({
    className: 'custom-discovery-pin',
    html: svg,
    iconSize: [48, 48],
    iconAnchor: [24, 46],
    popupAnchor: [0, -44],
  })
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for HTML, so a Host's name or address can never become markup. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

/**
 * The pin popup's HTML. Leaflet inserts it as markup, so every value from the database
 * is escaped: Hosts write a Space's name and address. Colors are the app's tokens, so the
 * text meets 4.5:1 (D-031).
 */
export function buildPopupHtml(
  space: Pick<
    VerifiedSpaceSearchResult,
    | 'id'
    | 'name'
    | 'address'
    | 'price_tier'
    | 'distance_km'
    | 'curated_tags'
    | 'review_count'
    | 'avg_overall'
  > & { opens_at?: string; closes_at?: string },
): string {
  const rating = formatReviewRating(space.avg_overall, space.review_count)
  const ratingHtml = `<div style="font-size: 12px; color: ${rating.hasReviews ? 'var(--foreground)' : 'var(--muted-foreground)'}; font-weight: ${rating.hasReviews ? '600' : '400'}; margin-top: 4px;">${escapeHtml(rating.text)}</div>`
  const distance =
    space.distance_km !== null
      ? `<div style="font-size: 12px; color: var(--primary); font-weight: 600; margin-top: 2px;">${escapeHtml(String(space.distance_km))} km away</div>`
      : ''
  const hours =
    space.opens_at && space.closes_at
      ? `<div style="font-size: 11px; color: var(--muted-foreground); margin-top: 2px;">Hours: ${escapeHtml(
          isSpaceOpen24h(space.opens_at, space.closes_at)
            ? 'Open 24 Hours'
            : `${space.opens_at.slice(0, 5)} - ${space.closes_at.slice(0, 5)}`,
        )}</div>`
      : ''
  const tags =
    space.curated_tags.length > 0
      ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${space.curated_tags
          .map(
            (tag) =>
              `<span style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--border); background: var(--secondary); color: var(--secondary-foreground);">${escapeHtml(tag.label)}</span>`,
          )
          .join('')}</div>`
      : ''
  return `
    <div style="font-family: inherit; min-width: 210px; padding: 2px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <h3 style="margin: 0; font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: var(--foreground); line-height: 1.25;">${escapeHtml(space.name)}</h3>
        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: var(--secondary); color: var(--secondary-foreground); white-space: nowrap;">${escapeHtml(PRICE_TIER_LABELS[space.price_tier])}</span>
      </div>
      <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 4px; line-height: 1.35;">${escapeHtml(space.address)}</div>
      ${hours}
      ${ratingHtml}
      ${distance}
      ${tags}
      <div style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;">
        <a href="/spaces/${encodeURIComponent(space.id)}" style="display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; text-align: center; background: #f0c95c; color: #173c2d; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-decoration: none;">View Space</a>
      </div>
    </div>
  `
}

/**
 * DiscoveryMap provides the interactive Leaflet discovery map view (STORY-08, FR-1.1, D-012).
 * Rendered exclusively on the client with dynamic import (ssr: false).
 */
export default function DiscoveryMap({
  spaces,
  activeSpaceId,
  hoveredSpaceId,
  onSelectSpace,
  onHoverSpace,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = 'h-full w-full',
}: DiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletType.Map | null>(null)
  const leafletModuleRef = useRef<typeof LeafletType | null>(null)
  const markersRef = useRef<Map<string, LeafletType.Marker>>(new Map())
  const prevActiveSpaceIdRef = useRef<string | null>(null)
  const prevViewRef = useRef<{ lat: number; lng: number; zoom: number }>({
    lat: center[0],
    lng: center[1],
    zoom,
  })
  // Leaflet loads asynchronously, after the first render. Setting this once the map
  // exists re-runs the marker and pan effects, which return early until then.
  const [mapReady, setMapReady] = useState(false)

  // Initialize Leaflet Map once
  useEffect(() => {
    let isMounted = true
    let resizeObserver: ResizeObserver | null = null

    async function initMap() {
      if (!containerRef.current || mapRef.current) return

      const L = await import('leaflet')
      if (!isMounted || !containerRef.current || mapRef.current) return

      leafletModuleRef.current = L

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
      })

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // On a phone the map starts hidden behind the list (0 × 0), and Leaflet only
      // measures its container when told to. Re-measure whenever the box changes size.
      resizeObserver = new ResizeObserver(() => map.invalidateSize())
      resizeObserver.observe(containerRef.current)

      mapRef.current = map
      setMapReady(true)
    }

    void initMap()

    const currentMarkers = markersRef.current

    return () => {
      isMounted = false
      resizeObserver?.disconnect()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      currentMarkers.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync Markers and Popups when spaces, activeSpaceId, or hoveredSpaceId changes
  useEffect(() => {
    const map = mapRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return

    const currentMarkers = markersRef.current

    // Remove obsolete markers
    const newSpaceIds = new Set(spaces.map((s) => s.id))
    for (const [id, marker] of currentMarkers.entries()) {
      if (!newSpaceIds.has(id)) {
        marker.remove()
        currentMarkers.delete(id)
      }
    }

    // Add or update markers for spaces with coordinates
    for (const space of spaces) {
      if (space.latitude === null || space.longitude === null) continue

      const isActive = space.id === activeSpaceId
      const isHovered = space.id === hoveredSpaceId
      const icon = createSvgPin(L, space, isActive, isHovered)

      let marker = currentMarkers.get(space.id)

      if (!marker) {
        marker = L.marker([space.latitude, space.longitude], {
          icon,
          title: space.name,
          riseOnHover: true,
        }).addTo(map)

        marker.bindPopup(buildPopupHtml(space), {
          closeButton: true,
          offset: [0, -10],
        })

        marker.on('click', () => {
          onSelectSpace(space.id)
        })

        marker.on('mouseover', () => {
          onHoverSpace(space.id)
        })

        marker.on('mouseout', () => {
          onHoverSpace(null)
        })

        currentMarkers.set(space.id, marker)
      } else {
        // Update marker icon, coordinates, and popup content if changed
        marker.setIcon(icon)
        marker.setLatLng([space.latitude, space.longitude])
        marker.setPopupContent(buildPopupHtml(space))
      }
    }
  }, [mapReady, spaces, activeSpaceId, hoveredSpaceId, onSelectSpace, onHoverSpace])

  // Open popup and pan map only when activeSpaceId changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!activeSpaceId) {
      prevActiveSpaceIdRef.current = null
      return
    }

    if (prevActiveSpaceIdRef.current === activeSpaceId) return
    prevActiveSpaceIdRef.current = activeSpaceId

    const marker = markersRef.current.get(activeSpaceId)
    if (marker && !marker.isPopupOpen()) {
      marker.openPopup()
    }

    const activeSpace = spaces.find((s) => s.id === activeSpaceId)
    if (activeSpace && activeSpace.latitude !== null && activeSpace.longitude !== null) {
      map.panTo([activeSpace.latitude, activeSpace.longitude], {
        animate: true,
        duration: 0.5,
      })
    }
  }, [mapReady, activeSpaceId, spaces])

  // Re-center map when search center or geolocation coordinates change (STORY-08, FR-1.1)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const [lat, lng] = center
    const prev = prevViewRef.current
    if (prev.lat === lat && prev.lng === lng && prev.zoom === zoom) return

    prevViewRef.current = { lat, lng, zoom }
    map.setView([lat, lng], zoom, { animate: true })
  }, [mapReady, center, zoom])

  const spacesWithCoords = spaces.filter(
    (s): s is VerifiedSpaceSearchResult & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null,
  )

  function handleFitAll() {
    const map = mapRef.current
    const L = leafletModuleRef.current
    if (!map || !L || spacesWithCoords.length === 0) return
    const first = spacesWithCoords[0]
    if (spacesWithCoords.length === 1 && first) {
      map.setView([first.latitude, first.longitude], 15, {
        animate: true,
      })
      return
    }
    const bounds = L.latLngBounds(
      spacesWithCoords.map((s) => [s.latitude, s.longitude] as [number, number]),
    )
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true })
  }

  return (
    <div className="relative h-full w-full">
      <div
        data-testid="discovery-map-container"
        className={className}
        ref={containerRef}
        style={{ minHeight: '360px' }}
      />

      {spacesWithCoords.length > 0 ? (
        <button
          type="button"
          onClick={handleFitAll}
          className="absolute top-3 right-3 z-[400] inline-flex min-h-12 min-w-12 items-center gap-1.5 rounded-full border border-border/80 bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-md backdrop-blur-md transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <LocateFixed className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>Fit all spaces</span>
        </button>
      ) : (
        spaces.length > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-3 right-3 z-[400] max-w-[calc(100%-4.5rem)] rounded-2xl border border-border/80 bg-card/95 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md"
          >
            No map coordinates set for these spaces yet
          </div>
        )
      )}

      <div
        aria-label="Map pin price tiers"
        className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-border/70 bg-card/92 px-3.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md"
      >
        {(
          [
            ['free', 'Free'],
            ['budget', 'Budget'],
            ['standard', 'Standard'],
            ['premium', 'Premium'],
          ] as const
        ).map(([tier, label]) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full border border-white shadow-2xs"
              style={{ backgroundColor: getPinColor(tier) }}
            />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
