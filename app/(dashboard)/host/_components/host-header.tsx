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
 * The Host portal header (STORY-05 design §3.5, STORY-17): Worq brand mark, portal
 * navigation, the signed-in person's name and role from their own profiles row, and
 * a Log out button that calls STORY-03's signOut Server Action.
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
          <nav aria-label="Host portal" className="flex flex-wrap items-center gap-1.5">
            {/* Every Host page belongs to Spaces, the portal's primary section. */}
            <Link
              href="/host"
              aria-current="page"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'h-auto min-h-12 max-w-full shrink rounded-full px-4 py-2 whitespace-normal aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground',
              )}
            >
              Spaces
            </Link>
            <Link
              href="/spaces"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'h-auto min-h-12 max-w-full shrink rounded-full px-4 py-2 whitespace-normal',
              )}
            >
              Discovery map
            </Link>
          </nav>
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
              <p className="text-xs text-muted-foreground">Host Portal</p>
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
