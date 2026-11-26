import type { ReactNode } from 'react'
import { SeekerHeader } from './_components/seeker-header'

/**
 * SeekerLayout component (STORY-04).
 * Protected dashboard shell layout wrapping Seeker pages with SeekerHeader.
 */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
      <SeekerHeader />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  )
}
