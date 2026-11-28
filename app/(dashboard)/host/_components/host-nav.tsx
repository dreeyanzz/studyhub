'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Compass } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const linkClass = cn(
  buttonVariants({ variant: 'ghost' }),
  'h-auto min-h-12 max-w-full shrink rounded-xl px-4 py-2 text-muted-foreground whitespace-normal hover:bg-surface-subtle hover:text-foreground',
)
const currentClass =
  'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:text-primary-foreground'

/**
 * Host portal primary navigation (STORY-05, STORY-17).
 * Marks "Spaces" as current page on /host and current section ("true") on nested Space routes.
 */
export function HostNav() {
  const pathname = usePathname()
  const spacesCurrent =
    pathname === '/host' ? 'page' : pathname.startsWith('/host/') ? 'true' : undefined

  return (
    <nav aria-label="Host portal" className="flex flex-wrap items-center gap-1.5">
      <Link
        href="/host"
        aria-current={spacesCurrent}
        className={cn(linkClass, spacesCurrent && currentClass)}
      >
        <Building2 aria-hidden="true" className="size-4 shrink-0" />
        Spaces
      </Link>
      <Link href="/spaces" className={linkClass}>
        <Compass aria-hidden="true" className="size-4 shrink-0" />
        Discovery map
      </Link>
    </nav>
  )
}
