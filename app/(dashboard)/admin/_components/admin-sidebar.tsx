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
import { WorqMark } from '@/components/brand/worq-mark'
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
      if (event.altKey || !(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'b') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }
      event.preventDefault()
      setIsCollapsed((prev) => !prev)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col justify-between overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,padding] duration-200 ease-in-out motion-reduce:transition-none lg:flex',
        isCollapsed ? 'w-20 p-3' : 'w-72 p-5',
      )}
    >
      <div className="space-y-4">
        {/* Brand & Identity + Persistent Collapse Toggle (keeps focus on toggle) */}
        <div
          className={cn(
            'flex items-center border-b border-sidebar-border pb-4',
            isCollapsed ? 'flex-col gap-2.5' : 'justify-between gap-2',
          )}
        >
          <Link
            href="/admin"
            aria-label={isCollapsed ? 'Worq Administrator home' : undefined}
            title={isCollapsed ? 'Worq Administrator home' : undefined}
            className={cn(
              'flex min-h-12 min-w-12 items-center rounded-xl transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brass focus-visible:outline-none',
              isCollapsed ? 'justify-center p-1' : 'gap-2.5 px-1.5 py-1',
            )}
          >
            <div
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-background shadow-2xs"
            >
              <WorqMark className="size-8" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 font-heading text-xl font-bold tracking-[-0.03em] text-white">
                  Worq
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-brass px-2.5 py-0.5 text-[10px] font-bold text-brass-foreground uppercase"
                  >
                    Administrator
                  </Badge>
                </div>
                <p className="text-xs text-white/70">Administrator Console</p>
              </div>
            )}
          </Link>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-white/15 bg-white/8 text-white shadow-2xs transition-all duration-200 hover:border-brass/60 hover:bg-white/15 hover:text-white active:scale-95"
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={
              isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4.5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Administrator Profile */}
        {isCollapsed ? (
          <div
            className="flex justify-center py-1"
            title={`${displayName} (Administrator)`}
          >
            <div className="relative">
              <div
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-xl border border-brass/30 bg-brass/20 font-mono text-xs font-bold text-brass"
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar bg-emerald-400"
                aria-hidden="true"
              />
            </div>
            <span className="sr-only">{displayName} (Administrator)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/6 p-2.5">
            <div className="relative">
              <div className="flex size-9 items-center justify-center rounded-lg border border-brass/30 bg-brass/20 font-mono text-xs font-bold text-brass">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar bg-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{displayName}</p>
              <p className="text-xs text-white/70">Administrator</p>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav aria-label="Administrator navigation" className="space-y-1.5">
          {!isCollapsed && (
            <p className="mb-2 px-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-brass uppercase">
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
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-semibold',
              isVerification
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-xs'
                : 'text-white/85 hover:bg-sidebar-accent hover:text-white',
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
                <span
                  className={cn(
                    'absolute -top-1.5 -right-2 flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 font-mono text-[11px] leading-none font-bold shadow-2xs',
                    isVerification
                      ? 'bg-sidebar text-brass ring-2 ring-brass'
                      : 'bg-brass text-brass-foreground',
                  )}
                >
                  {pendingCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums',
                  isVerification
                    ? 'bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground'
                    : 'bg-white/12 text-white',
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
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-semibold',
              isModeration
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-xs'
                : 'text-white/85 hover:bg-sidebar-accent hover:text-white',
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
                : 'min-h-[48px] justify-between px-3 py-2.5 text-xs font-semibold',
              isPayments
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-xs'
                : 'text-white/85 hover:bg-sidebar-accent hover:text-white',
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
          <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Shield className="size-4 text-brass" aria-hidden="true" />
              <span>Verification Standards</span>
            </div>
            <p className="text-xs text-white/75">
              Verification criteria before public map publish:
            </p>

            <ul className="space-y-2.5 text-xs text-white/90">
              <li className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brass/20 font-mono text-[11px] font-bold text-brass">
                  1
                </span>
                <div>
                  <strong className="font-semibold text-white">Campus vicinity:</strong>
                  <p className="text-xs font-normal text-white/75">
                    Physical location accessible near recognized student hubs.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brass/20 font-mono text-[11px] font-bold text-brass">
                  2
                </span>
                <div>
                  <strong className="font-semibold text-white">Operating hours:</strong>
                  <p className="text-xs font-normal text-white/75">
                    Valid daily schedule &amp; operating times.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brass/20 font-mono text-[11px] font-bold text-brass">
                  3
                </span>
                <div>
                  <strong className="font-semibold text-white">Space profile:</strong>
                  <p className="text-xs font-normal text-white/75">
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
            <p className="mb-1 px-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-brass uppercase">
              Shortcuts
            </p>
          )}
          <Link
            href="/spaces"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center rounded-xl text-xs font-semibold text-white/85 transition hover:bg-sidebar-accent hover:text-white',
              isCollapsed
                ? 'size-12 justify-center'
                : 'min-h-[48px] justify-between px-3 py-2',
            )}
            title="View Discovery Map"
            aria-label="View Discovery Map (opens in new tab)"
          >
            <span className="flex items-center gap-2">
              <MapPin
                className={cn('text-brass', isCollapsed ? 'size-5' : 'size-3.5')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>View Discovery Map</span>}
            </span>
            {!isCollapsed && (
              <ArrowUpRight className="size-3.5 text-white/60" aria-hidden="true" />
            )}
          </Link>
        </div>
      </div>

      {/* Log Out Footer */}
      <div className="border-t border-sidebar-border pt-3">
        <form action={signOut}>
          <Button
            variant="outline"
            type="submit"
            className={cn(
              'rounded-xl border-white/20 bg-white/6 text-xs font-semibold text-white hover:border-red-400/60 hover:bg-red-500/20 hover:text-white active:scale-[0.98]',
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
