import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everyone sees Log in and Sign up: the public pages read no session (STORY-02
// design §4, §8, STORY-03 design §8). The links wrap on small screens instead of a
// menu. Find a Space leads to the discovery map.
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-10">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'gap-2 px-2 font-heading text-2xl font-semibold',
          )}
        >
          <WorqMark />
          Worq
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          <Link href="/spaces" className={buttonVariants({ variant: 'ghost' })}>
            Find a Space
          </Link>
          <Link
            href="/#how-it-works"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            How it works
          </Link>
          <Link
            href="/#for-hosts"
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
          >
            Be a Host
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
            Log in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants(), 'hidden sm:inline-flex')}
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  )
}
