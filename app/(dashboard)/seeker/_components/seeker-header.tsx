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
    <header className="border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="Worq home"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 max-w-full shrink gap-2 px-2 py-2 font-heading text-xl font-semibold whitespace-normal',
            )}
          >
            <WorqMark className="size-7" />
            Worq
          </Link>
          <SeekerNav />
        </div>

        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold wrap-anywhere text-foreground">
                  {displayName}
                </p>
                <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Seeker Portal</p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              variant="ghost"
              size="default"
              type="submit"
              className="h-auto min-h-12 max-w-full shrink rounded-full px-4 py-2 whitespace-normal"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
