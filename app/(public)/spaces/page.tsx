import { DiscoveryShell } from './_components/discovery-shell'
import { searchVerifiedSpaces } from '@/lib/data/spaces'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const spaces = await searchVerifiedSpaces(supabase, searchParams)

  return <DiscoveryShell spaces={spaces} />
}
