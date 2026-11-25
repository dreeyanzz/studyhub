import type { Metadata } from 'next'
import { Compass } from 'lucide-react'

import { DiscoveryShell } from './_components/discovery-shell'
import { searchVerifiedSpaces } from '@/lib/data/spaces'
import { createClient } from '@/lib/supabase/server'
import { discoverySearchQuerySchema } from '@/lib/validation/search'

export const metadata: Metadata = {
  title: 'Explore Study Spaces',
  description:
    'Find verified study and co-working spaces in Metro Cebu, on a map or in a list.',
}

interface SpacesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Server Component for /spaces (STORY-08, FR-1.1, FR-1.2, D-055).
 * Reads search parameters from URL, executes strictly verified spaces query,
 * and renders the synchronized map and list discovery shell.
 */
export default async function SpacesPage(props: SpacesPageProps) {
  const searchParams = await props.searchParams
  const parsedQuery = discoverySearchQuerySchema.safeParse(searchParams)
  const initialQuery = parsedQuery.success ? parsedQuery.data : undefined
  const supabase = await createClient()
  const spaces = await searchVerifiedSpaces(supabase, searchParams)

  return (
    <div className="discovery-page min-h-[calc(100vh-8rem)] w-full bg-background py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
            <Compass className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Discover Spaces</span>
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Explore Study & Co-Working Spaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Search verified spaces near university campuses and study hubs across Metro
            Cebu.
          </p>
        </header>

        <DiscoveryShell spaces={spaces} initialQuery={initialQuery} />
      </div>
    </div>
  )
}
