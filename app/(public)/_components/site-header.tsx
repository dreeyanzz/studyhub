import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everyone sees Log in and Sign up: the public pages read no session (STORY-02
// design §4, §8, STORY-03 design §8). Links wrap cleanly at 360 px and 200% text
// zoom without a collapsed menu, and both Seekers ("Find a Space") and Hosts
// ("For Hosts") keep a clear, equal-access entry point from the top bar (STORY-17).
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-xs">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'h-auto min-h-12 gap-2 px-2 py-2 font-heading text-2xl font-semibold tracking-tight whitespace-normal',
          )}
        >
          <WorqMark />
          Worq
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 py-2.5 whitespace-normal',
            )}
          >
            Find a Space
          </Link>
          <Link
            href="/for-hosts"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-12 py-2.5 whitespace-normal',
            )}
          >
            For Hosts
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-auto min-h-12 py-2.5 whitespace-normal',
            )}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants(), 'h-auto min-h-12 py-2.5 whitespace-normal')}
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  )
}
