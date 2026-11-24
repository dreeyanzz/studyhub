import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, ShieldCheck } from 'lucide-react'

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
    <header className="animate-fade-in-down sticky top-0 z-20 border-b border-border/80 bg-card/95 px-4 py-3.5 shadow-2xs backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <div
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary font-bold text-secondary-foreground shadow-2xs ring-2 ring-primary/20"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span
              className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold tracking-tight wrap-anywhere text-foreground">
                {displayName}
              </p>
              <Badge
                variant="secondary"
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                Administrator
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Admin Console · Worq
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label="Administration portal">
            <Link
              href="/admin"
              aria-current="page"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'min-h-[48px] min-w-[48px] gap-2 rounded-xl font-medium transition-all duration-200 hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground aria-[current=page]:shadow-2xs',
              )}
            >
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Verification Queue</span>
            </Link>
          </nav>
          <form action={signOut}>
            <Button
              variant="outline"
              type="submit"
              className="min-h-[48px] min-w-[48px] gap-2 rounded-xl border-border/80 font-medium transition-all duration-200 hover:border-destructive/40 hover:bg-muted hover:text-destructive active:scale-[0.98]"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
