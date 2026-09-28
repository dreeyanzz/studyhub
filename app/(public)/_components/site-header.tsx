import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everyone sees Log in and Sign up in Sprint 1: the public pages read no session
// (STORY-02 design §4, §8). The links wrap on small screens instead of a menu.
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'px-2 font-heading text-2xl font-semibold',
          )}
        >
          Worq
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          <Link href="/#how-it-works" className={buttonVariants({ variant: 'ghost' })}>
            How it works
          </Link>
          <Link href="/#for-hosts" className={buttonVariants({ variant: 'ghost' })}>
            For Hosts
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  )
}
