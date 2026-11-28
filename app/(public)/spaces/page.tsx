import type { Metadata } from 'next'
import { Compass } from 'lucide-react'

import { DiscoveryShell } from './_components/discovery-shell'
import { getDiscoverySpaces } from '@/lib/data/spaces'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: 'Explore Study Spaces',
  description:
    'Find verified study and co-working spaces in Metro Cebu, on a map or in a list.',
}

// Public Verified Spaces catalog is identical for every visitor (D-055).
// ISR lets `<Link href="/spaces">` prefetch the full route in production while
// Server Actions call `revalidatePath('/spaces')` on every Space, tag, photo,
// seat-map, verification, or review change, with a 60-second safety fallback.
export const revalidate = 60

/**
 * Server Component for /spaces (STORY-08, FR-1.1, FR-1.2, D-055).
 * Reads the public Verified Spaces catalog in a single SQL RPC via a cookie-free
 * Supabase client (enforcing anon RLS) so the page can be cached and prefetched.
 * URL query parameters (`?q=`, `?tags=`, `?price=`, `?hours=`, `?unitType=`) are
 * synchronized on the client in `DiscoveryShell` without blocking SSR or triggering
 * extra server round-trips.
 */
export default async function SpacesPage() {
  const supabase = createPublicClient()
  const spaces = await getDiscoverySpaces(supabase)

  return (
    <div className="discovery-page min-h-[calc(100vh-8rem)] w-full bg-background py-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Compass className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Metro Cebu · Verified Spaces</span>
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              Explore{' '}
              <span className="bg-gradient-to-r from-primary to-forest-mid bg-clip-text text-transparent">
                Study &amp; Co-Working
              </span>{' '}
              Spaces
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Search verified spaces near university campuses and study hubs across Metro
            Cebu.
          </p>
        </header>

        <DiscoveryShell spaces={spaces} />
      </div>
    </div>
  )
}
