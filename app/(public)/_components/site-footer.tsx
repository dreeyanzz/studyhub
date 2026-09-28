import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
        <nav aria-label="Footer" className="-ml-4 flex flex-wrap gap-x-2">
          <Link href="/#how-it-works" className={buttonVariants({ variant: 'link' })}>
            How it works
          </Link>
          <Link href="/#for-hosts" className={buttonVariants({ variant: 'link' })}>
            For Hosts
          </Link>
        </nav>
        {/* Honest about payments (D-005) and about who keeps availability current (D-002). */}
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          <li>Payments run in sandbox mode, so no real money moves.</li>
          <li>Each Host updates their own Space&apos;s availability.</li>
        </ul>
        <p className="text-sm text-muted-foreground">Worq</p>
      </div>
    </footer>
  )
}
