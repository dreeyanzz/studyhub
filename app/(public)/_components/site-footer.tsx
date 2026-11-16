import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="max-w-sm space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-heading text-2xl font-semibold text-foreground"
            >
              <svg
                width="32"
                height="32"
                viewBox="6 4 20 26"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="size-8 shrink-0"
              >
                <path
                  d="M11 28 C11 26.2 13 25.5 16 25.5 C19 25.5 21 26.2 21 28 Z"
                  fill="#173c2d"
                />
                <rect x="9.5" y="27.5" width="13" height="2" rx="1" fill="#b79248" />
                <path
                  d="M16 25.5 L16 19 L12.5 12 L15 8"
                  stroke="#b79248"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="19" r="1.4" fill="#b79248" />
                <rect x="14" y="5.5" width="4" height="2.6" rx="1" fill="#b79248" />
                <path
                  d="M11 7.5 C11 6.7 21 6.7 21 7.5 L23.5 13.5 C23.7 14.2 23.1 14.6 22.3 14.6 L9.7 14.6 C8.9 14.6 8.3 14.2 8.5 13.5 Z"
                  fill="#215c3f"
                />
                <path
                  d="M9 14.3 H23"
                  stroke="#e7cb83"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <line
                  x1="21.5"
                  y1="14.5"
                  x2="21.5"
                  y2="19.5"
                  stroke="#b79248"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="21.5" cy="20.5" r="1.4" fill="#b79248" />
              </svg>
              Worq
            </Link>
            <p className="text-sm text-muted-foreground">
              Find a study or co-working Space and hold an open seat now.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:gap-12">
            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-bold tracking-wider text-primary uppercase">
                Explore
              </p>
              <Link
                href="/spaces"
                className={buttonVariants({
                  variant: 'link',
                  className: 'justify-start',
                })}
              >
                Explore Spaces
              </Link>
              <Link
                href="/#how-it-works"
                className={buttonVariants({
                  variant: 'link',
                  className: 'justify-start',
                })}
              >
                How it works
              </Link>
              <Link
                href="/#for-hosts"
                className={buttonVariants({
                  variant: 'link',
                  className: 'justify-start',
                })}
              >
                For Hosts
              </Link>
            </div>

            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-bold tracking-wider text-primary uppercase">
                Account
              </p>
              <Link
                href="/login"
                className={buttonVariants({
                  variant: 'link',
                  className: 'justify-start',
                })}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={buttonVariants({
                  variant: 'link',
                  className: 'justify-start',
                })}
              >
                Sign up
              </Link>
            </div>
          </nav>
        </div>

        {/* Honest about payments (D-005) and about who keeps availability current (D-002). */}
        <div className="flex flex-col justify-between gap-2 border-t border-border pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            Payments run in sandbox mode, so no real money moves. Each Host updates their
            own Space&apos;s availability.
          </p>
          <p className="shrink-0 font-medium text-foreground">Worq</p>
        </div>
      </div>
    </footer>
  )
}
