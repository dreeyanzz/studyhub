import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { dashboardFor } from '@/lib/auth/role-guard'
import { getVerificationSpaces } from '@/lib/data/verification'
import { createClient } from '@/lib/supabase/server'
import { verificationQueueTabSchema } from '@/lib/validation/verification'
import { VerificationQueue } from './_components/verification-queue'

export const metadata: Metadata = {
  title: 'Space Verification',
}

/**
 * The Administration portal dashboard page (STORY-15, STORY-17, STORY-20 design §3).
 * Checks the Administrator role, reads `?tab` (Pending, Verified, Rejected or Taken
 * down, Pending when missing or unknown) and loads that list with its lists of changes.
 */
export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    redirect(profile ? dashboardFor(profile.role) : '/login')
  }

  const tab = verificationQueueTabSchema.parse((await searchParams).tab)
  const result = await getVerificationSpaces(supabase, tab)

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Space Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Review Pending Spaces, inspect changes, take Verified Spaces down, or undo
            past decisions.
          </p>
        </div>
        <Alert
          variant="destructive"
          className="rounded-2xl border-destructive/30 shadow-xs"
        >
          <AlertTitle className="font-semibold">Error loading queue</AlertTitle>
          <AlertDescription className="text-sm">
            We could not load the verification queue. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Keyed by tab, so switching lists starts with that list's own state.
  return <VerificationQueue key={tab} tab={tab} initialSpaces={result.spaces} />
}
