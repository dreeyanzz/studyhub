import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { createSpace } from './actions'
import { SpaceForm } from './_components/space-form'
import { SpaceList } from './_components/space-list'

export const metadata: Metadata = { title: 'Manage Spaces' }

// The Server Actions redirect here with one of these three values after a save
// (STORY-05 design §2.6). Anything else in the query string is ignored, so the page
// never echoes text someone put in a link.
function noticeText(notice: string | string[] | undefined) {
  switch (notice) {
    case 'created':
      return 'Space created. It is pending verification.'
    case 'updated':
      return 'Space changes saved.'
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

  // RLS decides which rows come back; host_id = user.id keeps the list to the
  // caller's own Spaces even for an Administrator, who may open /host (D-032) and
  // whom RLS lets read every Space (design §1.1 and §2.7).
  const { data: spaces, error } = await supabase
    .from('spaces')
    .select('id, name, description, address, opens_at, closes_at, status, updated_at')
    .eq('host_id', user.id)
    .order('updated_at', { ascending: false })
    .order('name', { ascending: true })

  const notice = noticeText((await searchParams).notice)

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Manage Spaces
        </h1>
        <p className="text-sm text-muted-foreground">
          New Spaces start Pending verification. Seekers can&apos;t see a Space until an
          Administrator verifies it.
        </p>
      </div>

      {notice ? (
        <Alert role="status">
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      ) : null}

      <section aria-labelledby="create-space-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="create-space-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Create a Space
          </h2>
          <p className="text-sm text-muted-foreground">
            Give it a name, an address, an optional description, and the hours it opens
            every day.
          </p>
        </div>
        <Card className="max-w-2xl">
          <CardContent>
            <SpaceForm mode="create" action={createSpace} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="your-spaces-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="your-spaces-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Your Spaces
          </h2>
          {spaces && spaces.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {spaces.length === 1 ? '1 Space' : `${spaces.length} Spaces`}
            </p>
          ) : null}
        </div>
        {error || !spaces ? (
          // Never the raw Supabase error (design §4.2).
          <Alert variant="destructive">
            <AlertDescription>
              We could not load your Spaces. Refresh the page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <SpaceList spaces={spaces} />
        )}
      </section>
    </div>
  )
}
