import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everyone sees Log in and Sign up: the public pages read no session (STORY-02
// design §4, §8, STORY-03 design §8). Find a Space leads to the discovery map,
// and links wrap cleanly at 360 px and 200% text zoom.
export function SiteHeader() {
  return (
    <header className="z-40 px-3 pt-3 pb-1 sm:sticky sm:top-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/90 bg-white/82 px-3 py-2 shadow-float backdrop-blur-xl sm:px-4">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'h-auto min-h-12 gap-2.5 rounded-xl px-2 py-2 font-heading text-xl font-bold tracking-[-0.03em] whitespace-normal text-foreground hover:bg-surface-subtle sm:text-2xl',
          )}
        >
          <WorqMark className="size-8 shrink-0" />
          Worq
        </Link>

        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-subtle/90 p-1"
        >
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-normal text-foreground hover:bg-card hover:shadow-2xs sm:px-4',
            )}
          >
            Find a Space
          </Link>
          <Link
            href="/#how-it-works"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'hidden h-auto min-h-12 rounded-lg px-3.5 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xs md:inline-flex',
            )}
          >
            How it works
          </Link>
          <Link
            href="/for-hosts"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-normal text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xs sm:px-3.5',
            )}
          >
            For Hosts
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-normal text-foreground hover:bg-surface-subtle sm:px-4',
            )}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants(),
              'h-auto min-h-12 rounded-xl bg-gradient-to-r from-primary to-forest-mid px-4 py-2.5 text-sm font-semibold whitespace-normal text-white shadow-sm hover:from-primary-hover hover:to-forest-deep sm:px-5',
            )}
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  )
}
