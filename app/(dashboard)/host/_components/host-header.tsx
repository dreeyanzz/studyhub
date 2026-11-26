import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/(auth)/actions'
import { WorqMark } from '@/components/brand/worq-mark'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

// An Administrator may open this portal too (D-032), so the badge shows the real role.
const roleLabels = { seeker: 'Seeker', host: 'Host', admin: 'Administrator' } as const

/**
 * The Host portal header (STORY-05 design §3.5): the signed-in person's name and
 * role from their own profiles row, the Spaces link, and a Log out button that
 * calls STORY-03's signOut Server Action.
 */
export async function HostHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // proxy.ts already sends visitors who are not signed in to /login; this is a backstop.
  if (!user) redirect('/login?returnUrl=%2Fhost')

  // The name and role come from the user's own profiles row, never from
  // user_metadata, which a user can rewrite (STORY-03 design §2).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  // Without their own row there is no identity to trust (design §4.2).
  if (!profile) redirect('/login')
  // Sign-up always sets full_name; an account made another way may have none.
  const displayName = profile.full_name || 'Host portal'

  return (
    <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/host"
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
              <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Host portal</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Host portal">
            {/* Every Host page belongs to Spaces, the portal's only section so far. */}
            <Link
              href="/host"
              aria-current="page"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground',
              )}
            >
              Spaces
            </Link>
          </nav>
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
