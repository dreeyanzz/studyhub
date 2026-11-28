import type { ReactNode } from 'react'
import { SeekerHeader } from './_components/seeker-header'

/**
 * SeekerLayout component (STORY-04).
 * Protected dashboard shell layout wrapping Seeker pages with SeekerHeader.
 */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background bg-[radial-gradient(ellipse_65%_32%_at_15%_0%,rgba(167,212,155,0.22),transparent_65%),radial-gradient(ellipse_55%_30%_at_85%_0%,rgba(231,203,131,0.18),transparent_65%)] text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 inline-flex min-h-12 min-w-12 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>
      <SeekerHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        {children}
      </main>
    </div>
  )
}
