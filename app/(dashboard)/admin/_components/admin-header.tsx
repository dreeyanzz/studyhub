import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { WorqMark } from '@/components/brand/worq-mark'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { dashboardFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { AdminNav } from './admin-nav'

/**
 * The Administration portal header (STORY-15 design §3, STORY-14 design §3 Screen 1):
 * the signed-in Administrator's name from their profiles row, an Administrator badge,
 * the portal navigation (`AdminNav`), and a Log out button.
 */
export async function AdminHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // proxy.ts already routes visitors who are not signed in to /login; this is a backstop.
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

  return (
    <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin"
            aria-label="Worq home"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 max-w-full shrink gap-2 px-2 py-2 font-heading text-xl font-semibold whitespace-normal',
            )}
          >
            <WorqMark className="size-7" />
            Worq
          </Link>
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold wrap-anywhere text-foreground">
                {displayName}
              </p>
              <Badge variant="secondary">Administrator</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Admin portal</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminNav />
          <form action={signOut}>
            <Button
              variant="outline"
              type="submit"
              className="h-auto min-h-12 min-w-12 py-2 whitespace-normal"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
