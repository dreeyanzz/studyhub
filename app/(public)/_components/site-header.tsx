import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everyone sees Log in and Sign up in Sprint 1: the public pages read no session
// (STORY-02 design §4, §8). The links wrap on small screens instead of a menu.
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'gap-2 px-2 font-heading text-2xl font-semibold',
          )}
        >
          <svg
            width="36"
            height="36"
            viewBox="6 4 20 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="size-9 shrink-0"
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
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          <Link href="/spaces" className={buttonVariants({ variant: 'ghost' })}>
            Discover
          </Link>
          <Link href="/#for-hosts" className={buttonVariants({ variant: 'ghost' })}>
            Be a Host
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
