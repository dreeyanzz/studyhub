'use client'

import type * as LeafletType from 'leaflet'
import { useEffect, useRef } from 'react'
import { PRICE_TIER_LABELS } from '@/components/discovery/price-tier-badge'
import type { VerifiedSpaceSearchResult } from '@/lib/data/spaces'
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
 * Creates an SVG map pin DivIcon to avoid broken default PNG asset paths in Next.js bundlers.
 */
function createSvgPin(
  L: typeof LeafletType,
  tier: PriceTier,
  isActive: boolean,
  isHovered: boolean,
) {
  const color = getPinColor(tier)
  const isElevated = isActive || isHovered
  const scale = isActive ? 1.3 : isHovered ? 1.15 : 1.0
  const zIndex = isActive ? 1000 : isHovered ? 900 : 500

  const svg = `
    <div style="transform: scale(${scale}); transform-origin: 50% 100%; transition: transform 0.15s ease-out; z-index: ${zIndex}; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.35));">
        <path d="M17 0C7.611 0 0 7.611 0 17C0 28.5 17 44 17 44C17 44 34 28.5 34 17C34 7.611 26.389 0 17 0Z" fill="${color}" stroke="${isElevated ? '#ffffff' : 'rgba(255,255,255,0.7)'}" stroke-width="${isElevated ? '2.5' : '1.5'}"/>
        <circle cx="17" cy="16" r="8" fill="#ffffff"/>
        <circle cx="17" cy="16" r="5" fill="${color}"/>
      </svg>
    </div>
  `

  return L.divIcon({
    className: 'custom-discovery-pin',
    html: svg,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -42],
  })
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

  // Initialize Leaflet Map once
  useEffect(() => {
    let isMounted = true

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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
    }

    void initMap()

    const currentMarkers = markersRef.current

    return () => {
      isMounted = false
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
      const icon = createSvgPin(L, space.price_tier, isActive, isHovered)

      let marker = currentMarkers.get(space.id)

      if (!marker) {
        marker = L.marker([space.latitude, space.longitude], {
          icon,
          title: space.name,
          riseOnHover: true,
        }).addTo(map)

        // Popup template
        const distanceSnippet =
          space.distance_km !== null
            ? `<div style="font-size: 12px; color: #0284c7; font-weight: 600; margin-top: 2px;">${space.distance_km} km away</div>`
            : ''

        const tierLabel = PRICE_TIER_LABELS[space.price_tier]

        const popupHtml = `
          <div style="font-family: inherit; min-width: 190px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; line-height: 1.2;">
                ${space.name}
              </h4>
              <span style="font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: #f1f5f9; color: #334155;">
                ${tierLabel}
              </span>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.3;">
              ${space.address}
            </div>
            ${distanceSnippet}
            <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
              <a href="/spaces/${space.id}" style="display: inline-block; width: 100%; text-align: center; background: #0284c7; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
                View Space
              </a>
            </div>
          </div>
        `

        marker.bindPopup(popupHtml, {
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
        // Update marker icon and coordinates if changed
        marker.setIcon(icon)
        marker.setLatLng([space.latitude, space.longitude])
      }

      // If this space is currently active, ensure its popup is open
      if (isActive && !marker.isPopupOpen()) {
        marker.openPopup()
      }
    }
  }, [spaces, activeSpaceId, hoveredSpaceId, onSelectSpace, onHoverSpace])

  // Center or pan map when activeSpaceId changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !activeSpaceId) return

    const activeSpace = spaces.find((s) => s.id === activeSpaceId)
    if (activeSpace && activeSpace.latitude !== null && activeSpace.longitude !== null) {
      map.panTo([activeSpace.latitude, activeSpace.longitude], {
        animate: true,
        duration: 0.5,
      })
    }
  }, [activeSpaceId, spaces])

  return (
    <div
      data-testid="discovery-map-container"
      className={className}
      ref={containerRef}
      style={{ minHeight: '360px' }}
      aria-label="Interactive Discovery Map"
      role="region"
    />
  )
}
