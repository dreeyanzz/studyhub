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
 * Server Component rendering the portal header: the Worq link home, the portal
 * navigation (Dashboard, Find a Space), the signed-in user's full name and role
 * badge, and a Log out button that calls STORY-03's signOut Server Action.
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
    <header className="border-b border-border bg-card px-4 py-3 sm:px-6">
      {/* Two groups that wrap onto their own rows on a narrow screen or at 200% text,
          instead of a menu (STORY-02 design §4, SRS §3.2.2). */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'gap-2 px-2 font-heading text-xl font-semibold',
            )}
          >
            <WorqMark className="size-7" />
            Worq
          </Link>
          <SeekerNav />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold break-words text-foreground">
                  {displayName}
                </p>
                <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Seeker portal</p>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
