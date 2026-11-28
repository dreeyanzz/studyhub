'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { signOut } from '@/app/(auth)/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { dashboardFor, type UserRole } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// An outline, not only the button's box-shadow ring: the shadow fades in over the
// button's 200 ms transition, so a fast Tab shows no ring at first (D-031, D-093).
const headerFocus =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid'

const roleLabels: Record<UserRole, string> = {
  seeker: 'Seeker',
  host: 'Host',
  admin: 'Administrator',
}

export type HeaderViewer =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'unconfirmed' }
  | { status: 'confirmed'; role: UserRole; displayName: string }

const navPillClass = cn(
  buttonVariants({ variant: 'ghost' }),
  headerFocus,
  'h-auto min-h-12 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xs sm:px-3.5',
)

const activePillClass = 'bg-card font-semibold text-foreground shadow-2xs'

export async function fetchHeaderViewer(
  supabase: ReturnType<typeof createClient>,
): Promise<HeaderViewer> {
  // Fast local cookie check first: signed-out visitors resolve immediately without
  // waiting on a network round-trip, while signed-in sessions still verify via getUser().
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { status: 'guest' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'guest' }

  // Role and role_confirmed come from profiles, never user_metadata (D-095).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, role_confirmed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return { status: 'guest' }
  if (!profile.role_confirmed) return { status: 'unconfirmed' }

  return {
    status: 'confirmed',
    role: profile.role,
    displayName: profile.full_name || user.email || 'Your account',
  }
}

function PublicMainNav({ isSpaces }: { isSpaces: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-subtle/90 p-1"
    >
      <Link
        href="/spaces"
        aria-current={isSpaces ? 'page' : undefined}
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          headerFocus,
          'h-auto min-h-12 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-normal text-foreground hover:bg-card hover:shadow-2xs sm:px-4',
          isSpaces && activePillClass,
        )}
      >
        Find a Space
      </Link>
      <Link
        href="/#how-it-works"
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          headerFocus,
          'hidden h-auto min-h-12 rounded-lg px-3.5 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xs md:inline-flex',
        )}
      >
        How it works
      </Link>
      <Link
        href="/for-hosts"
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          headerFocus,
          'h-auto min-h-12 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xs sm:px-3.5',
        )}
      >
        For Hosts
      </Link>
    </nav>
  )
}

export function SiteHeaderNavView({
  viewer,
  pathname,
}: {
  viewer: HeaderViewer
  pathname: string | null
}) {
  const isSpaces = pathname === '/spaces' || Boolean(pathname?.startsWith('/spaces/'))

  if (viewer.status === 'confirmed') {
    const dashboardHref = dashboardFor(viewer.role)

    return (
      <>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-subtle/90 p-1"
        >
          <Link href={dashboardHref} className={navPillClass}>
            Dashboard
          </Link>
          {viewer.role === 'seeker' && (
            <Link href="/seeker/reservations" className={navPillClass}>
              My reservations
            </Link>
          )}
          <Link
            href="/spaces"
            aria-current={isSpaces ? 'page' : undefined}
            className={cn(navPillClass, isSpaces && activePillClass)}
          >
            Find a Space
          </Link>
        </nav>

        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-forest-mid text-xs font-bold text-white shadow-2xs"
            >
              {viewer.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold wrap-anywhere text-foreground">
              {viewer.displayName}
            </span>
            <Badge variant="secondary">{roleLabels[viewer.role]}</Badge>
          </div>
          <form action={signOut}>
            <Button
              variant="outline"
              size="default"
              type="submit"
              className={cn(
                headerFocus,
                'h-auto min-h-12 max-w-full shrink rounded-xl border-border bg-card px-4 py-2 whitespace-normal hover:border-primary/40 hover:bg-surface-subtle',
              )}
            >
              Log out
            </Button>
          </form>
        </div>
      </>
    )
  }

  if (viewer.status === 'unconfirmed') {
    return (
      <>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-subtle/90 p-1"
        >
          <Link
            href="/spaces"
            aria-current={isSpaces ? 'page' : undefined}
            className={cn(navPillClass, isSpaces && activePillClass)}
          >
            Find a Space
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href="/choose-role"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              headerFocus,
              'h-auto min-h-12 rounded-xl border-border bg-card px-4 py-2.5 text-sm font-semibold whitespace-normal text-foreground hover:border-primary/40 hover:bg-surface-subtle',
            )}
          >
            Finish sign-up
          </Link>
          <form action={signOut}>
            <Button
              variant="outline"
              size="default"
              type="submit"
              className={cn(
                headerFocus,
                'h-auto min-h-12 max-w-full shrink rounded-xl border-border bg-card px-4 py-2 whitespace-normal hover:border-primary/40 hover:bg-surface-subtle',
              )}
            >
              Log out
            </Button>
          </form>
        </div>
      </>
    )
  }

  if (viewer.status === 'loading') {
    return (
      <>
        <PublicMainNav isSpaces={isSpaces} />
        <div aria-hidden="true" className="flex items-center gap-1.5 sm:gap-2">
          <div className="h-12 w-20 rounded-xl bg-surface-subtle/80 motion-safe:animate-pulse" />
          <div className="h-12 w-24 rounded-xl bg-surface-subtle/80 motion-safe:animate-pulse" />
        </div>
      </>
    )
  }

  return (
    <>
      <PublicMainNav isSpaces={isSpaces} />

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            headerFocus,
            'h-auto min-h-12 min-w-12 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-normal text-foreground hover:bg-surface-subtle sm:px-4',
          )}
        >
          Log in
        </Link>
        <Link
          href="/register"
          className={cn(
            buttonVariants(),
            headerFocus,
            'h-auto min-h-12 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-4 py-2.5 text-sm font-semibold whitespace-normal text-white shadow-sm hover:from-primary-hover hover:to-forest-deep sm:px-5',
          )}
        >
          Sign up
        </Link>
      </div>
    </>
  )
}

/**
 * Client-side session-aware nav & actions for `SiteHeader`.
 *
 * Keeping the session check on the client lets `SiteHeader` and `PublicLayout`
 * stay cookie-free so `/spaces` (`export const revalidate = 60`) keeps its ISR
 * static cache and `<Link href="/spaces">` prefetching (STORY-08), while starting
 * in `'loading'` avoids flashing Log in / Sign up for signed-in visitors.
 */
export function SiteHeaderNav() {
  const pathname = usePathname()
  const [viewer, setViewer] = useState<HeaderViewer>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    async function syncViewer(supabase: ReturnType<typeof createClient>) {
      try {
        const nextViewer = await fetchHeaderViewer(supabase)
        if (active) setViewer(nextViewer)
      } catch {
        if (active) setViewer({ status: 'guest' })
      }
    }

    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) {
            if (active) setViewer({ status: 'guest' })
            return
          }
          void syncViewer(supabase)
        })
        if (!active) {
          subscription.unsubscribe()
          return
        }
        unsubscribe = () => subscription.unsubscribe()
        await syncViewer(supabase)
      } catch {
        // Missing env vars in unit tests: show guest links.
        if (active) setViewer({ status: 'guest' })
      }
    }

    void init()

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  return <SiteHeaderNavView viewer={viewer} pathname={pathname} />
}
