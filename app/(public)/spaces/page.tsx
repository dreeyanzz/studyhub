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
  const rawSpaces = await searchVerifiedSpaces(supabase, searchParams)

  const spaces = await Promise.all(
    rawSpaces.map(async (space) => {
      try {
        const { data: files } = await supabase.storage
          .from('space-photos')
          .list(space.id, {
            limit: 2,
            sortBy: { column: 'created_at', order: 'asc' },
          })
        const firstPhoto = (files ?? []).find((f) => f.name && !f.name.startsWith('.'))
        if (!firstPhoto) {
          return { ...space, cover_photo_url: null }
        }
        const coverUrl = supabase.storage
          .from('space-photos')
          .getPublicUrl(`${space.id}/${firstPhoto.name}`).data.publicUrl
        return { ...space, cover_photo_url: coverUrl }
      } catch {
        return { ...space, cover_photo_url: null }
      }
    }),
  )

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

        <DiscoveryShell spaces={spaces} initialQuery={initialQuery} />
      </div>
    </div>
  )
}
