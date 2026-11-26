import { HostHeader } from './_components/host-header'

/**
 * The Host portal shell (STORY-05 design §3.5, STORY-17): the header, then each page
 * inside the portal's one main landmark. An Administrator may open it too (D-032).
 */
export default function HostLayout({ children }: LayoutProps<'/host'>) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
      <HostHeader />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  )
}
