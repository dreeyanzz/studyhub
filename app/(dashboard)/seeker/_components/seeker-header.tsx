import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { WorqMark } from '@/components/brand/worq-mark'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { SeekerNav } from './seeker-nav'

// An Administrator may open this portal too (D-032), so the badge shows the real role.
const roleLabels = { seeker: 'Seeker', host: 'Host', admin: 'Administrator' } as const

/**
 * SeekerHeader component (STORY-04, STORY-17).
 * Server Component rendering header shell with Worq branding, Seeker portal
 * navigation (Dashboard, Find a Space), the signed-in user's full name, role
 * badge, and a Log out button.
 */
export async function SeekerHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // proxy.ts already sends visitors who are not signed in to /login; this is a backstop.
  if (!user) redirect('/login?returnUrl=%2Fseeker')

  // The name comes from the user's own profiles row, which the profile form edits
  // (STORY-04 design §1), never from user_metadata.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) redirect('/login')
  // Sign-up always sets full_name; an account made another way may have none.
  const displayName = profile.full_name || user.email || 'Your account'

  return (
    <header className="z-40 px-3 pt-3 pb-1 sm:px-6 lg:sticky lg:top-0 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/90 bg-white/82 px-4 py-2 shadow-float backdrop-blur-xl">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/seeker"
            aria-label="Worq home"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 max-w-full shrink gap-2.5 rounded-xl px-2 py-2 font-heading text-xl font-bold tracking-[-0.03em] whitespace-normal hover:bg-surface-subtle',
            )}
          >
            <WorqMark className="size-7" />
            Worq
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <SeekerNav />
        </div>

        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-forest-mid text-xs font-bold text-white shadow-2xs"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold wrap-anywhere text-foreground sm:text-base">
                  {displayName}
                </p>
                <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Seeker Portal</p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              variant="outline"
              size="default"
              type="submit"
              className="h-auto min-h-12 max-w-full shrink rounded-xl border-border bg-card px-4 py-2 whitespace-normal hover:border-primary/40 hover:bg-surface-subtle"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
