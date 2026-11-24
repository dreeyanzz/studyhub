import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { dashboardFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { PaymentsView } from './_components/payments-view'
import { ReviewModerationView } from './_components/review-moderation-view'
import { VerificationQueue, type PendingSpace } from './_components/verification-queue'

export const metadata: Metadata = {
  title: 'Space Verification',
}

interface AdminPageProps {
  searchParams?: Promise<{ tab?: string }>
}

/**
 * The Administration portal dashboard page (STORY-15, STORY-17).
 * Supports switchable tabs for Space Verification (default), Review Moderation,
 * and Payments & Sandbox Refunds.
 * Enforces Administrator role check before rendering queues.
 */
export default async function AdminPage({ searchParams }: AdminPageProps) {
  const query = searchParams ? await searchParams : {}
  const activeTab = typeof query.tab === 'string' ? query.tab : 'verification'

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

  if (activeTab === 'moderation') {
    return <ReviewModerationView />
  }

  if (activeTab === 'payments') {
    return <PaymentsView />
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Space Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Review pending Spaces. Approved Spaces become immediately visible in public
            search.
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
