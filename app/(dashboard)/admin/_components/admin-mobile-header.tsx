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
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 px-4 py-3 shadow-2xs backdrop-blur-md lg:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="flex min-h-[48px] min-w-[48px] items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <div className="relative">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span
              className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
              <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
                Administrator
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Administrator Console</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/spaces"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Discovery Map (opens in new tab)"
            title="View Discovery Map"
            className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <MapPin className="size-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Map</span>
            <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden="true" />
          </Link>

          <form action={signOut}>
            <Button
              variant="outline"
              type="submit"
              className="min-h-[48px] min-w-[48px] gap-1.5 rounded-xl border-border/80 text-xs font-semibold hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive active:scale-[0.98]"
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
        className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      >
        <Link
          href="/admin"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            isVerification
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-current={isVerification ? 'page' : undefined}
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Verification ({pendingCount})</span>
        </Link>

        <Link
          href="/admin/moderation"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            isModeration
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-current={isModeration ? 'page' : undefined}
        >
          <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Moderation</span>
        </Link>

        <Link
          href="/admin/payments"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            isPayments
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
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
