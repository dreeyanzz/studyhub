import { HostHeader } from './_components/host-header'

/**
 * The Host portal shell (STORY-05 design §3.5, STORY-17): the header, then each page
 * inside the portal's one main landmark. An Administrator may open it too (D-032).
 */
export default function HostLayout({ children }: LayoutProps<'/host'>) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 inline-flex min-h-12 min-w-12 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>
      <HostHeader />
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
