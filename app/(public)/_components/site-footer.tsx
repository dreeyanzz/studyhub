import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'

/**
 * Airy luminous pearl-white studio footer (STORY-02, STORY-17).
 * Honest about sandbox payments (D-005) and preserves Find a Space discovery entry (FR-1.1).
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-border bg-card text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 pb-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-2.5 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <WorqMark className="size-8" />
              <span>Worq</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Discover verified study and co-working Spaces across Metro Cebu, inspect
              Host-updated seat maps, and hold an open seat before you commute.
            </p>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              <span>Metro Cebu · Verified Spaces</span>
            </p>
          </div>

          {/* Explore */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Explore
            </p>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href="/spaces"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Find a Space
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/#for-hosts"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  For Hosts
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Account
            </p>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Sign up
                </Link>
              </li>
              <li>
                <Link
                  href="/register?role=host"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Become a Host
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Trust
            </p>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="inline-flex min-h-12 items-center font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Every listed Space is reviewed and verified by an Administrator before it
              appears on the map.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="rounded-full bg-surface-subtle px-3.5 py-1.5 font-medium text-foreground">
            Reservation fees run in sandbox mode, so no real money moves.
          </p>
          <p>Worq · Study &amp; Co-Working Discovery</p>
        </div>
      </div>
    </footer>
  )
}
