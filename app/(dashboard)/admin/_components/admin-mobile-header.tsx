'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CreditCard, LogOut, MessageSquare, ShieldCheck } from 'lucide-react'

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
 * Preserves 48x48 px touch targets and accessible navigation across all 3 portals.
 */
export function AdminMobileHeader({ displayName, pendingCount }: AdminMobileHeaderProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'verification'

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 px-4 py-3 shadow-2xs backdrop-blur-md lg:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
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
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                Admin
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Admin Console · Worq</p>
          </div>
        </div>

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

      {/* Mobile Tab Bar */}
      <nav
        aria-label="Mobile admin navigation"
        className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5"
      >
        <Link
          href="/admin"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            activeTab === 'verification'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-current={activeTab === 'verification' ? 'page' : undefined}
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Verification ({pendingCount})</span>
        </Link>

        <Link
          href="/admin?tab=moderation"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            activeTab === 'moderation'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-current={activeTab === 'moderation' ? 'page' : undefined}
        >
          <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Moderation (0)</span>
        </Link>

        <Link
          href="/admin?tab=payments"
          className={cn(
            'flex min-h-[48px] min-w-[48px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
            activeTab === 'payments'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-current={activeTab === 'payments' ? 'page' : undefined}
        >
          <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Payments</span>
        </Link>
      </nav>
    </header>
  )
}
