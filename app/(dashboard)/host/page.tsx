import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, CheckCircle2, Clock, Plus } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { createSpace } from './actions'
import { SpaceForm } from './_components/space-form'
import { SpaceList, type SpaceSetupStatus } from './_components/space-list'

export const metadata: Metadata = { title: 'Manage Spaces' }

// The Server Actions redirect here with one of these values after a save (STORY-05
// design §2.6, STORY-20 design §3). Anything else in the query string is ignored, so
// the page never echoes text someone put in a link.
function noticeText(notice: string | string[] | undefined) {
  switch (notice) {
    case 'created':
      return 'Space created. It is pending verification.'
    case 'updated':
      return 'Space changes saved.'
    // V6: a Verified Space's name, address or map pin changed (D-079).
    case 'reverify':
      return 'Space changes saved. It is back to Pending verification until an Administrator reviews it.'
    // V8 (D-084).
    case 'resubmitted':
      return 'Space resubmitted for verification.'
    case 'deleted':
      return 'Space deleted.'
    default:
      return null
  }
}

/**
 * The Host portal home (STORY-05 design §3.2): a success notice after a save, the
 * create section, and the signed-in person's own Spaces.
 */
export default async function HostPage({ searchParams }: PageProps<'/host'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The layout's check does not stop this page from rendering, so the page checks
  // too. proxy.ts only routes people (D-010).
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // Only Hosts may insert a Space (STORY-01's insert policy), but an Administrator may
  // open /host too (D-032). So the page reads the caller's role from their own profiles
  // row, never user_metadata (STORY-03 design §2), and offers the create form to Hosts
  // only (#145).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const canCreate = profile?.role === 'host'

  // RLS decides which rows come back; host_id = user.id keeps the list to the
  // caller's own Spaces even for an Administrator, who may open /host (D-032) and
  // whom RLS lets read every Space (design §1.1 and §2.7).
  const { data: spaces, error } = await supabase
    .from('spaces')
    .select(
      'id, name, description, address, opens_at, closes_at, status, status_reason, updated_at',
    )
    .eq('host_id', user.id)
    .order('updated_at', { ascending: false })
    .order('name', { ascending: true })

  const notice = noticeText((await searchParams).notice)
  const hasSpaces = Boolean(spaces && spaces.length > 0)

  const setupBySpaceId: Record<string, SpaceSetupStatus> = {}
  if (spaces && spaces.length > 0) {
    const spaceIds = spaces.map((s) => s.id)
    const [unitsRes, curatedRes, customRes, photoLists] = await Promise.all([
      supabase.from('units').select('space_id').in('space_id', spaceIds),
      supabase.from('space_curated_tags').select('space_id').in('space_id', spaceIds),
      supabase.from('space_custom_tags').select('space_id').in('space_id', spaceIds),
      Promise.all(
        spaceIds.map((id) =>
          supabase.storage.from('space-photos').list(id, { limit: 5 }),
        ),
      ),
    ])

    const unitSpaceIds = new Set((unitsRes.data ?? []).map((r) => r.space_id))
    const tagSpaceIds = new Set([
      ...(curatedRes.data ?? []).map((r) => r.space_id),
      ...(customRes.data ?? []).map((r) => r.space_id),
    ])

    spaces.forEach((s, index) => {
      const files = photoLists[index]?.data ?? []
      const hasPhotos = files.some((f) => Boolean(f.name) && !f.name.startsWith('.'))
      setupBySpaceId[s.id] = {
        hasUnits: unitSpaceIds.has(s.id),
        hasPhotos,
        hasTags: tagSpaceIds.has(s.id),
      }
    })
  }

  const verifiedCount = spaces?.filter((s) => s.status === 'verified').length ?? 0
  const pendingCount = spaces?.filter((s) => s.status === 'pending').length ?? 0

  const createSpaceSection = (
    <section aria-labelledby="create-space-heading" className="space-y-4">
      <div className="space-y-1">
        <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          Add a location
        </p>
        <h2
          id="create-space-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground"
        >
          Create a Space
        </h2>
        {canCreate ? (
          <p className="text-sm text-muted-foreground">
            Give it a name, an address, an optional description, and the hours it opens
            every day.
          </p>
        ) : null}
      </div>
      {canCreate ? (
        <Card className="max-w-3xl rounded-2xl border-border bg-card shadow-card">
          <CardContent className="pt-6">
            <SpaceForm mode="create" action={createSpace} />
          </CardContent>
        </Card>
      ) : (
        // A Card, not an Alert: the note is part of the page, not news to announce.
        <Card className="max-w-3xl rounded-2xl border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-medium">
              Only Hosts create Spaces
            </CardTitle>
            <CardDescription>
              Your account can open the Host portal, but creating a Space needs a Host
              account.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </section>
  )

  const yourSpacesSection = (
    <section aria-labelledby="your-spaces-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            Your portfolio
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2
              id="your-spaces-heading"
              className="font-heading text-2xl font-medium tracking-tight text-foreground"
            >
              Your Spaces
            </h2>
            {spaces && spaces.length > 0 ? (
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {spaces.length === 1 ? '1 Space' : `${spaces.length} Spaces`}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {error || !spaces ? (
        // Never the raw Supabase error (design §4.2).
        <Alert variant="destructive" className="rounded-2xl shadow-xs">
          <AlertDescription>
            We could not load your Spaces. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <SpaceList
          spaces={spaces}
          canCreate={canCreate}
          setupBySpaceId={setupBySpaceId}
        />
      )}
    </section>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1.5">
          <p className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
            Host Portal
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
            Manage Spaces
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            New Spaces start Pending verification. Seekers can&apos;t see a Space until an
            Administrator verifies it.
          </p>
        </div>
        {hasSpaces && canCreate ? (
          <Link
            href="#create-space-heading"
            className={cn(
              buttonVariants({ variant: 'brass' }),
              'h-auto min-h-12 max-w-full gap-2 rounded-xl px-6 py-2.5 font-bold whitespace-normal shadow-sm',
            )}
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Create a Space
          </Link>
        ) : null}
      </div>

      {hasSpaces && spaces ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex min-w-0 items-center gap-4 rounded-3xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold wrap-anywhere text-muted-foreground">
                Total Spaces
              </p>
              <p className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {spaces.length}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-4 rounded-3xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold wrap-anywhere text-muted-foreground">
                Verified
              </p>
              <p className="font-heading text-3xl font-bold tracking-tight text-primary tabular-nums">
                {verifiedCount}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-4 rounded-3xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brass-soft text-brass-foreground">
              <Clock className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold wrap-anywhere text-muted-foreground">
                Pending verification
              </p>
              <p className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <Alert
          role="status"
          className="rounded-2xl border-primary/30 bg-secondary/50 shadow-xs"
        >
          <AlertTitle className="font-semibold text-foreground">{notice}</AlertTitle>
        </Alert>
      ) : null}

      {hasSpaces ? (
        <>
          {yourSpacesSection}
          {createSpaceSection}
        </>
      ) : (
        <>
          {createSpaceSection}
          {yourSpacesSection}
        </>
      )}
    </div>
  )
}
