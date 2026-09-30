import { HostHeader } from './_components/host-header'

/**
 * The Host portal shell (STORY-05 design §3.5): the header, then each page inside
 * the portal's one main landmark. An Administrator may open it too (D-032).
 */
export default function HostLayout({ children }: LayoutProps<'/host'>) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HostHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
