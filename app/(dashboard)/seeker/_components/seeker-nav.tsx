'use client'

// The Seeker portal's navigation (STORY-17, TSK-17.5). Before it, the portal header
// had only Log out, and the dashboard hid its Find a Space card while the Seeker held
// a unit, so the portal had no way out but the browser's back button.
//
// "My reservations" joins this list when STORY-16 builds /seeker/reservations
// (TSK-16.3); it is left out until then rather than linking to a missing page.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * How the Dashboard link marks itself: "page" on /seeker itself, "true" on a page
 * inside it (a hold page), so a screen reader hears where the Seeker is.
 */
export function dashboardCurrent(pathname: string): 'page' | 'true' | undefined {
  if (pathname === '/seeker') return 'page'
  if (pathname.startsWith('/seeker/')) return 'true'
  return undefined
}

const linkClass = cn(buttonVariants({ variant: 'ghost' }), 'rounded-full px-4')
const currentClass = 'bg-secondary text-secondary-foreground'

export function SeekerNav() {
  const pathname = usePathname()
  const current = dashboardCurrent(pathname)

  return (
    <nav aria-label="Seeker portal" className="flex flex-wrap items-center gap-1">
      <Link
        href="/seeker"
        aria-current={current}
        className={cn(linkClass, current && currentClass)}
      >
        <LayoutDashboard aria-hidden="true" className="size-4" />
        Dashboard
      </Link>
      <Link href="/spaces" className={linkClass}>
        <Search aria-hidden="true" className="size-4" />
        Find a Space
      </Link>
    </nav>
  )
}
