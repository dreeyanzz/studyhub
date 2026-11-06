import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { dashboardFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

/**
 * The Administration portal header (STORY-15 design §3): the signed-in
 * Administrator's name from their profiles row, an Administrator badge,
 * the Verification Queue link, and a Log out button.
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
          <nav aria-label="Administration portal">
            <Link
              href="/admin"
              aria-current="page"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'min-h-[48px] min-w-[48px] aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground',
              )}
            >
              Verification Queue
            </Link>
          </nav>
          <form action={signOut}>
            <Button variant="outline" type="submit" className="min-h-[48px] min-w-[48px]">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
