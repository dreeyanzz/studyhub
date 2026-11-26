'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ADMIN_NAV_LINKS = [
  {
    href: '/admin',
    label: 'Verification Queue',
    isActive: (pathname: string) => pathname === '/admin',
  },
  {
    href: '/admin/moderation',
    label: 'Moderation',
    isActive: (pathname: string) => pathname.startsWith('/admin/moderation'),
  },
  {
    href: '/admin/payments',
    label: 'Payments',
    isActive: (pathname: string) => pathname.startsWith('/admin/payments'),
  },
] as const

/**
 * Administration portal navigation (STORY-14 design §3 Screen 1, TSK-14.3, TSK-14.4).
 * Uses `usePathname()` so `aria-current="page"` sits strictly on the active route.
 */
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Administration portal" className="flex flex-wrap items-center gap-2">
      {ADMIN_NAV_LINKS.map((item) => {
        const active = item.isActive(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 min-w-12 py-2 whitespace-normal aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
