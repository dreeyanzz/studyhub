'use client'

// The Seeker portal's navigation (STORY-17, TSK-17.5). Before it, the portal header
// had only Log out, and the dashboard hid its Find a Space card while the Seeker held
// a unit, so the portal had no way out but the browser's back button.
//
// "My reservations" links to the reservation history that STORY-16 built at
// /seeker/reservations (#433). The hold pages under /seeker/reservations/[id] belong to
// My reservations, not to Dashboard, so each link is "current" on its own pages only.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { History, LayoutDashboard, Search } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RESERVATIONS_PATH = '/seeker/reservations'

function isReservationsPath(pathname: string): boolean {
  return pathname === RESERVATIONS_PATH || pathname.startsWith(`${RESERVATIONS_PATH}/`)
}

/**
 * How the Dashboard link marks itself: "page" on /seeker itself, "true" on any other
 * page inside it, so a screen reader hears where the Seeker is. The reservation
 * history and the hold pages under it belong to My reservations, so Dashboard stays
 * unmarked there.
 */
export function dashboardCurrent(pathname: string): 'page' | 'true' | undefined {
  if (pathname === '/seeker') return 'page'
  if (isReservationsPath(pathname)) return undefined
  if (pathname.startsWith('/seeker/')) return 'true'
  return undefined
}

/**
 * How the My reservations link marks itself: "page" on the history page, "true" on a
 * hold page under it.
 */
export function reservationsCurrent(pathname: string): 'page' | 'true' | undefined {
  if (pathname === RESERVATIONS_PATH) return 'page'
  if (pathname.startsWith(`${RESERVATIONS_PATH}/`)) return 'true'
  return undefined
}

// min-h-12 min-w-12: a 48 x 48 px target (SRS §3.2.2).
const linkClass = cn(
  buttonVariants({ variant: 'ghost' }),
  'min-h-12 min-w-12 rounded-full px-4',
)
const currentClass = 'bg-secondary text-secondary-foreground'

export function SeekerNav() {
  const pathname = usePathname()
  const dashboard = dashboardCurrent(pathname)
  const reservations = reservationsCurrent(pathname)

  return (
    <nav aria-label="Seeker portal" className="flex flex-wrap items-center gap-1">
      <Link
        href="/seeker"
        aria-current={dashboard}
        className={cn(linkClass, dashboard && currentClass)}
      >
        <LayoutDashboard aria-hidden="true" className="size-4" />
        Dashboard
      </Link>
      <Link
        href={RESERVATIONS_PATH}
        aria-current={reservations}
        className={cn(linkClass, reservations && currentClass)}
      >
        <History aria-hidden="true" className="size-4" />
        My reservations
      </Link>
      <Link href="/spaces" className={linkClass}>
        <Search aria-hidden="true" className="size-4" />
        Find a Space
      </Link>
    </nav>
  )
}
