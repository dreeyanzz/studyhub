import type { ReactNode } from 'react'
import { SeekerHeader } from './_components/seeker-header'

/**
 * SeekerLayout component (STORY-04).
 * Protected dashboard shell layout wrapping Seeker pages with SeekerHeader.
 */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SeekerHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
