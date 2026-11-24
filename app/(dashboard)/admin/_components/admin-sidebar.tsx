'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  CreditCard,
  LogOut,
  MapPin,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ShieldCheck,
} from 'lucide-react'

import { signOut } from '@/app/(auth)/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  displayName: string
  pendingCount: number
}

/**
 * Unified Administrator Navigation & Context Sidebar (STORY-17).
 * Open by default when an administrator logs in. Can be collapsed into
 * a sleek icon-only rail at any time to maximize screen space.
 */
export function AdminSidebar({ displayName, pendingCount }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  const isVerification = pathname === '/admin'
  const isModeration = pathname.startsWith('/admin/moderation')
  const isPayments = pathname.startsWith('/admin/payments')

  // Global power-user keyboard shortcut (Ctrl+B / Cmd+B) to toggle the sidebar
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setIsCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col justify-between overflow-y-auto border-r border-border/80 bg-card transition-[width,padding] duration-200 ease-in-out lg:flex',
        isCollapsed ? 'w-20 p-3' : 'w-72 p-5',
      )}
    >
      <div className="space-y-4">
        {/* Brand & Identity + Collapse Toggle */}
        <div
          className={cn(
            'flex items-center border-b border-border/60 pb-3.5',
            isCollapsed ? 'flex-col gap-2.5' : 'justify-between gap-2',
          )}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-2xs"
              >
                W
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCollapsed(false)}
                className="min-h-[48px] min-w-[48px] rounded-xl border border-border/80 bg-background/90 text-foreground/80 shadow-2xs transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="size-4.5" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-2xs"
                >
                  W
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground">
                    Worq
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase"
                    >
                      Admin
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Administrator Console
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                className="min-h-[48px] min-w-[48px] rounded-xl border border-border/80 bg-background/90 text-foreground/80 shadow-2xs transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>

        {/* Administrator Profile */}
        {isCollapsed ? (
          <div
            className="flex justify-center py-1"
            title={`${displayName} (Administrator)`}
            aria-label={`${displayName} (Administrator)`}
          >
            <div className="relative">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30"
                aria-hidden="true"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background p-2.5 shadow-2xs">
            <div className="relative">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
              <p className="text-xs font-medium text-muted-foreground">Administrator</p>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav aria-label="Administrator navigation" className="space-y-1.5">
          {!isCollapsed && (
            <p className="mb-2 px-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Management Portals
            </p>
          )}

          {/* Space Verification Link */}
          <Link
            href="/admin"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-bold',
              isVerification
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={
              isCollapsed ? `Space Verification (${pendingCount} pending)` : undefined
            }
            aria-label={
              isCollapsed ? `Space Verification (${pendingCount} pending)` : undefined
            }
            aria-current={isVerification ? 'page' : undefined}
          >
            <div className="relative flex items-center gap-2.5">
              <ShieldCheck
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Space Verification</span>}
              {isCollapsed && pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-2xs">
                  {pendingCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  isVerification
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                {pendingCount}
              </span>
            )}
          </Link>

          {/* Review Moderation Link */}
          <Link
            href="/admin/moderation"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-bold',
              isModeration
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={isCollapsed ? 'Review Moderation' : undefined}
            aria-label={isCollapsed ? 'Review Moderation' : undefined}
            aria-current={isModeration ? 'page' : undefined}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Review Moderation</span>}
            </div>
          </Link>

          {/* Payments & Refunds Link */}
          <Link
            href="/admin/payments"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-bold',
              isPayments
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={isCollapsed ? 'Payments & Refunds' : undefined}
            aria-label={isCollapsed ? 'Payments & Refunds' : undefined}
            aria-current={isPayments ? 'page' : undefined}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Payments & Refunds</span>}
            </div>
          </Link>
        </nav>

        {/* Verification Checklist (Shown when expanded on /admin) */}
        {!isCollapsed && isVerification && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Shield className="size-4 text-primary" aria-hidden="true" />
                <span>Verification Standards</span>
              </div>
              <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                FR-5.1
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Verification criteria before public map publish:
            </p>

            <ul className="space-y-2.5 text-xs text-foreground">
              <li className="flex items-start gap-2.5">
                <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  1
                </span>
                <div>
                  <strong className="font-bold text-foreground">Campus vicinity:</strong>
                  <p className="text-xs font-normal text-muted-foreground">
                    Physical location accessible near recognized student hubs.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  2
                </span>
                <div>
                  <strong className="font-bold text-foreground">Operating hours:</strong>
                  <p className="text-xs font-normal text-muted-foreground">
                    Valid daily schedule & operating times.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  3
                </span>
                <div>
                  <strong className="font-bold text-foreground">Space profile:</strong>
                  <p className="text-xs font-normal text-muted-foreground">
                    Legitimate Space name, address, and host details.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        )}

        {/* Shortcuts */}
        <div className="space-y-1 pt-1">
          {!isCollapsed && (
            <p className="mb-1 px-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Shortcuts
            </p>
          )}
          <Link
            href="/spaces"
            target="_blank"
            className={cn(
              'flex items-center rounded-xl text-xs font-semibold text-foreground transition hover:bg-muted',
              isCollapsed
                ? 'size-12 justify-center'
                : 'min-h-[48px] justify-between px-3 py-2',
            )}
            title="View Discovery Map"
            aria-label="View Discovery Map (opens in new tab)"
          >
            <span className="flex items-center gap-2">
              <MapPin
                className={cn('text-primary', isCollapsed ? 'size-5' : 'size-3.5')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>View Discovery Map</span>}
            </span>
            {!isCollapsed && (
              <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden="true" />
            )}
          </Link>
        </div>
      </div>

      {/* Log Out Footer */}
      <div className="border-t border-border/60 pt-3">
        <form action={signOut}>
          <Button
            variant="outline"
            type="submit"
            className={cn(
              'rounded-xl border-border/80 text-xs font-semibold text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive active:scale-[0.98]',
              isCollapsed
                ? 'size-12 justify-center p-0'
                : 'min-h-[48px] w-full justify-center gap-2',
            )}
            title={isCollapsed ? 'Log out' : undefined}
            aria-label={isCollapsed ? 'Log out' : undefined}
          >
            <LogOut
              className={cn('shrink-0', isCollapsed ? 'size-4.5' : 'size-3.5')}
              aria-hidden="true"
            />
            {!isCollapsed && <span>Log out</span>}
          </Button>
        </form>
      </div>
    </aside>
  )
}
