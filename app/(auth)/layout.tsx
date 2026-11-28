import Link from 'next/link'

import { WorqMark } from '@/components/brand/worq-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import './auth.css'

// Luminous botanical aurora canvas around /login, /register and /choose-role.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen flex-col bg-background bg-[radial-gradient(ellipse_60%_45%_at_18%_12%,rgba(167,212,155,0.3),transparent_70%),radial-gradient(ellipse_55%_45%_at_84%_14%,rgba(231,203,131,0.26),transparent_70%),radial-gradient(ellipse_50%_45%_at_50%_92%,rgba(33,92,63,0.1),transparent_70%)]">
      <a
        href="#main-content"
        className="sr-only z-50 inline-flex min-h-12 min-w-12 items-center rounded-xl bg-primary px-4 font-medium text-primary-foreground outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 px-3 pt-3 pb-1 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/90 bg-white/82 px-4 py-2 shadow-float backdrop-blur-xl">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'gap-2.5 rounded-xl px-2 font-heading text-xl font-bold tracking-[-0.03em] hover:bg-surface-subtle sm:text-2xl',
            )}
          >
            <WorqMark className="size-8" />
            Worq
          </Link>
          <Link
            href="/spaces"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-xl border-border bg-card px-5 text-sm font-semibold shadow-2xs hover:border-primary/40 hover:bg-surface-subtle',
            )}
          >
            Find a Space
          </Link>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-start px-4 py-6 outline-none sm:px-6 md:justify-center md:py-5"
      >
        {children}
      </main>
    </div>
  )
}
