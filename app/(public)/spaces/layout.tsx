import 'leaflet/dist/leaflet.css'
import './leaflet-overrides.css'
import type { ReactNode } from 'react'

interface SpacesLayoutProps {
  children: ReactNode
}

/**
 * Injects Leaflet's stylesheet for the discovery map (STORY-08 design §3, D-012), and
 * the overrides that make its zoom buttons 48×48 px (D-031). It
 * renders nothing of its own: STORY-11's Space profile (`/spaces/[spaceId]`) sits under
 * this layout too, so the discovery heading and container live in `page.tsx`.
 */
export default function SpacesLayout({ children }: SpacesLayoutProps) {
  return children
}
