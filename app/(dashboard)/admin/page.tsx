import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { dashboardFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { VerificationQueue, type PendingSpace } from './_components/verification-queue'

export const metadata: Metadata = {
  title: 'Space Verification',
}

/**
 * The Administration Space Verification portal (STORY-15 design §3).
 * Loads Pending Spaces oldest-first joined with profiles(full_name).
 * Enforces Administrator role check before rendering the verification queue.
 */
export default async function AdminPage() {
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

  // Load Pending spaces oldest-first embedding profiles(full_name) (Task #224, FR-5.1)
  const { data: spaces, error } = await supabase
    .from('spaces')
    .select(
      'id, name, description, address, opens_at, closes_at, status, created_at, updated_at, host_id, profiles(full_name)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Space Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Review pending Spaces. Approved Spaces become immediately visible in public
            search.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Error loading queue</AlertTitle>
          <AlertDescription>
            We could not load the verification queue. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const pendingSpaces: PendingSpace[] = (spaces ?? []).map((space) => ({
    id: space.id,
    name: space.name,
    description: space.description,
    address: space.address,
    opens_at: space.opens_at,
    closes_at: space.closes_at,
    status: space.status,
    created_at: space.created_at,
    updated_at: space.updated_at,
    host_name: space.profiles?.full_name ?? null,
  }))

  return <VerificationQueue initialSpaces={pendingSpaces} />
}
