import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The shell around /login and /register: a way home, then the form.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-2">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'px-2 font-heading text-2xl font-semibold',
            )}
          >
            Worq
          </Link>
        </div>
      </header>
      <main id="main-content" className="flex flex-1 justify-center px-4 py-12">
        {children}
      </main>
    </>
  )
}
