import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'

interface SpacesLayoutProps {
  children: ReactNode
}

/**
 * Injects Leaflet's stylesheet for the discovery map (STORY-08 design §3, D-012). It
 * renders nothing of its own: STORY-11's Space profile (`/spaces/[spaceId]`) sits under
 * this layout too, so the discovery heading and container live in `page.tsx`.
 */
export default function SpacesLayout({ children }: SpacesLayoutProps) {
  return children
}
