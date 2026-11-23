import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Split white-and-photo card shell for /login and /register (STORY-17).
 * Stacks cleanly on mobile and displays a framed study-space photo with
 * floating frosted-glass map callouts on md+ screens.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className="auth-split-card w-full max-w-4xl self-center rounded-3xl bg-card/95 p-3 shadow-[0_24px_70px_-15px_rgba(16,43,32,0.48)] ring-1 ring-white/60 backdrop-blur-md sm:p-4"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col justify-center px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-1 flex justify-center">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'rounded-full px-4 font-heading text-base font-semibold text-primary',
              )}
            >
              Worq
            </Link>
          </div>
          <div className="mb-6 space-y-1.5 text-center">
            <h1
              id="auth-title"
              className="font-heading text-3xl font-semibold tracking-tight text-foreground"
            >
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>

        <div className="relative hidden min-h-[28rem] overflow-hidden rounded-2xl bg-primary md:block">
          <Image
            src="/images/public-landing/library.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 45vw, 0px"
            className="object-cover"
            priority
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#173c2d]/60 via-transparent to-[#173c2d]/20"
          />

          {/* Floating frosted-glass study-space callouts */}
          <div
            aria-hidden="true"
            className="auth-pin-a absolute top-14 left-6 flex flex-col items-start"
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/25 bg-[#173c2d]/60 px-3.5 py-2.5 text-white shadow-lg backdrop-blur-md">
              <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                <MapPin className="size-3.5" />
              </span>
              <div className="leading-tight">
                <p className="text-xs text-white/80">Reading Room</p>
                <p className="text-xs font-semibold">Quiet Study Desk</p>
              </div>
            </div>
            <div className="ml-6 h-8 w-px bg-white/60" />
            <div className="ml-[21px] size-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          </div>

          <div
            aria-hidden="true"
            className="auth-pin-b absolute top-1/2 right-6 flex -translate-y-1/2 flex-col items-end"
          >
            <div className="rounded-2xl border border-white/25 bg-[#173c2d]/60 px-3.5 py-2.5 text-white shadow-lg backdrop-blur-md">
              <p className="text-xs font-semibold">Snap-grid seat map</p>
              <p className="text-xs text-white/80">Pick your exact unit</p>
            </div>
            <div className="mr-6 h-10 w-px bg-white/60" />
            <div className="mr-[21px] size-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          </div>

          <div
            aria-hidden="true"
            className="auth-pin-c absolute bottom-8 left-1/2 flex flex-col items-center"
          >
            <div className="rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-md">
              Worq · Verified Spaces
            </div>
            <div className="h-4 w-px bg-white/80" />
            <div className="size-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          </div>
        </div>
      </div>
    </section>
  )
}
