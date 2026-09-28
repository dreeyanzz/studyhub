import { SiteFooter } from './_components/site-footer'
import { SiteHeader } from './_components/site-header'

// The public shell (STORY-02 design §3): the skip link is the first focusable
// element, and moves focus to the main content.
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 inline-flex min-h-12 min-w-12 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground outline-none focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
