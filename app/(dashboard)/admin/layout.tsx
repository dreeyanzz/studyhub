import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AdminHeader } from './_components/admin-header'

export const metadata: Metadata = {
  title: 'Space Verification',
}

/**
 * The Administration portal shell layout (STORY-15 design §3): the header,
 * then each page inside the portal's main landmark.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AdminHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
