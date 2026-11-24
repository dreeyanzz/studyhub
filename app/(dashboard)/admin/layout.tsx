import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { dashboardFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { AdminMobileHeader } from './_components/admin-mobile-header'
import { AdminSidebar } from './_components/admin-sidebar'

export const metadata: Metadata = {
  title: 'Space Verification',
}

/**
 * The Administration portal shell layout (STORY-15, STORY-17).
 * Renders the unified Left Sidebar on desktop and the mobile top bar on mobile/tablet,
 * providing persistent navigation, live counters, and contextual playbooks.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    redirect(profile ? dashboardFor(profile.role) : '/login')
  }

  const displayName = profile.full_name || 'Administrator'

  // Count pending spaces for the live queue badge
  const { count } = await supabase
    .from('spaces')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const pendingCount = count ?? 0

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      <AdminSidebar displayName={displayName} pendingCount={pendingCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader displayName={displayName} pendingCount={pendingCount} />
        <main className="w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
