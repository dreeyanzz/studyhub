import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-sm min-w-0 space-y-3">
            <Link
              href="/"
              className="inline-flex min-h-12 min-w-12 items-center gap-2 font-heading text-2xl font-semibold tracking-tight text-foreground focus-visible:rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <WorqMark className="size-8" />
              Worq
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Discover Verified study and co-working Spaces across Metro Cebu and hold an
              open seat now.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex min-w-0 flex-wrap gap-x-10 gap-y-6 sm:gap-x-14"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="px-3 font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Explore
              </p>
              <Link
                href="/spaces"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                Find a Space
              </Link>
              <Link
                href="/#how-it-works"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                How it works
              </Link>
              <Link
                href="/for-hosts"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                For Hosts
              </Link>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <p className="px-3 font-mono text-xs font-semibold tracking-widest text-primary uppercase">
                Account
              </p>
              <Link
                href="/login"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                Sign up
              </Link>
              <Link
                href="/privacy"
                className={buttonVariants({
                  variant: 'link',
                  className:
                    'h-auto min-h-12 justify-start py-3 text-left whitespace-normal',
                })}
              >
                Privacy policy
              </Link>
            </div>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>&copy; 2026 Worq</p>
        </div>
      </div>
    </footer>
  )
}
