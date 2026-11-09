import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Explore Study Spaces | Worq',
  description:
    'Discover verified study spaces and co-working hubs in Metro Cebu with interactive map discovery, real-time seat availability, and curated amenity filters.',
}

interface SpacesLayoutProps {
  children: ReactNode
}

/**
 * Discovery layout wrapper injecting Leaflet stylesheet and full-width container (STORY-08, D-012).
 */
export default function SpacesLayout({ children }: SpacesLayoutProps) {
  return (
    <div className="discovery-page min-h-[calc(100vh-8rem)] w-full py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Explore Study & Co-Working Spaces
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search verified spaces near university campuses and study hubs across Metro
            Cebu.
          </p>
        </header>

        {children}
      </div>
    </div>
  )
}
