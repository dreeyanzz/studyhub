import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { SiteHeaderNav } from './site-header-nav'

// Public header stays cookie-free so /spaces keeps ISR caching (STORY-08), while
// SiteHeaderNav checks the Supabase session on the client to show Dashboard,
// role badge, and Log out for signed-in visitors instead of Log in / Sign up.
// An outline, not only the button's box-shadow ring: the shadow fades in over the
// button's 200 ms transition, so a fast Tab shows no ring at first (D-031, D-093).
const headerFocus =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid'

export function SiteHeader() {
  return (
    <header className="z-40 px-3 pt-3 pb-1 sm:sticky sm:top-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/90 bg-white/82 px-3 py-2 shadow-float backdrop-blur-xl sm:px-4">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            headerFocus,
            'h-auto min-h-12 gap-2.5 rounded-xl px-2 py-2 font-heading text-xl font-bold tracking-[-0.03em] whitespace-normal text-foreground hover:bg-surface-subtle sm:text-2xl',
          )}
        >
          <WorqMark className="size-8 shrink-0" />
          Worq
        </Link>

        <SiteHeaderNav />
      </div>
    </header>
  )
}
