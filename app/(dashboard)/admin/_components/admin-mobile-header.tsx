'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  CreditCard,
  LogOut,
  MapPin,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'

import { signOut } from '@/app/(auth)/actions'
import { WorqMark } from '@/components/brand/worq-mark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AdminMobileHeaderProps {
  displayName: string
  pendingCount: number
}

/**
 * Mobile-responsive top navigation header for Administrators on viewports < 1024px.
 * Preserves 48x48 px touch targets and accessible navigation across Administrator routes.
 */
export function AdminMobileHeader({ displayName, pendingCount }: AdminMobileHeaderProps) {
  const pathname = usePathname()

  const isVerification = pathname === '/admin'
  const isModeration = pathname.startsWith('/admin/moderation')
  const isPayments = pathname.startsWith('/admin/payments')

  return (
    <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground shadow-xs lg:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="flex min-h-[48px] min-w-[48px] items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brass focus-visible:outline-none"
        >
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10"
          >
            <WorqMark className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-heading text-lg font-bold tracking-[-0.03em] text-white">
                Worq
              </p>
              <Badge
                variant="secondary"
                className="rounded-full bg-brass px-2 py-0.5 text-[10px] font-bold text-brass-foreground uppercase"
              >
                Administrator
              </Badge>
            </div>
            <p className="truncate text-xs text-white/75">{displayName}</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/spaces"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Discovery Map (opens in new tab)"
            title="View Discovery Map"
            className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3.5 text-xs font-semibold text-white transition hover:border-brass/60 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-brass focus-visible:outline-none"
          >
            <MapPin className="size-3.5 text-brass" aria-hidden="true" />
            <span className="hidden sm:inline">Map</span>
            <ArrowUpRight className="size-3 text-white/75" aria-hidden="true" />
          </Link>

          <form action={signOut}>
            <Button
              variant="outline"
              type="submit"
              className="min-h-[48px] min-w-[48px] gap-1.5 rounded-full border-white/20 bg-white/8 px-4 text-xs font-semibold text-white hover:border-red-400/60 hover:bg-red-500/20 hover:text-white active:scale-[0.98]"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>Log out</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <nav
        aria-label="Mobile administrator navigation"
        className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      >
        <Link
          href="/admin"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition',
            isVerification
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-2xs'
              : 'border border-white/15 bg-white/6 text-white/85 hover:bg-sidebar-accent hover:text-white',
          )}
          aria-current={isVerification ? 'page' : undefined}
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Verification ({pendingCount})</span>
        </Link>

        <Link
          href="/admin/moderation"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition',
            isModeration
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-2xs'
              : 'border border-white/15 bg-white/6 text-white/85 hover:bg-sidebar-accent hover:text-white',
          )}
          aria-current={isModeration ? 'page' : undefined}
        >
          <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Moderation</span>
        </Link>

        <Link
          href="/admin/payments"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition',
            isPayments
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-2xs'
              : 'border border-white/15 bg-white/6 text-white/85 hover:bg-sidebar-accent hover:text-white',
          )}
          aria-current={isPayments ? 'page' : undefined}
        >
          <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Payments</span>
        </Link>
      </nav>
    </header>
  )
}
