'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  LogOut,
  MapPin,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ShieldCheck,
  Sparkles,
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
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'verification'

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
                data-tour="sidebar-toggle"
                className="size-9 rounded-xl border border-border/80 bg-background/90 text-foreground/80 shadow-2xs transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
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
                  <h1 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground">
                    Worq
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase"
                    >
                      Admin
                    </Badge>
                  </h1>
                  <p className="text-xs font-medium text-foreground/80">
                    Operations & Trust Platform
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                data-tour="sidebar-toggle"
                className="size-8.5 rounded-xl border border-border/80 bg-background/90 text-foreground/80 shadow-2xs transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
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
            title={`${displayName} (Platform Administrator)`}
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
              <p className="text-xs font-medium text-foreground/80">
                Platform Administrator
              </p>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav aria-label="Administrator console" className="space-y-1.5">
          {!isCollapsed && (
            <p className="mb-2 px-2 text-xs font-bold tracking-wider text-foreground/75 uppercase">
              Management Portals
            </p>
          )}

          {/* Space Verification Tab */}
          <Link
            href="/admin"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'justify-between px-3 py-2.5 text-xs font-bold',
              activeTab === 'verification'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={
              isCollapsed ? `Space Verification (${pendingCount} pending)` : undefined
            }
            aria-current={activeTab === 'verification' ? 'page' : undefined}
          >
            <div className="relative flex items-center gap-2.5">
              <ShieldCheck
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Space Verification</span>}
              {isCollapsed && pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex size-4.5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-2xs">
                  {pendingCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  activeTab === 'verification'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-foreground',
                )}
              >
                {pendingCount}
              </span>
            )}
          </Link>

          {/* Review Moderation Tab */}
          <Link
            href="/admin?tab=moderation"
            data-tour="moderation-tab"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'justify-between px-3 py-2.5 text-xs font-bold',
              activeTab === 'moderation'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={isCollapsed ? 'Review Moderation (0 reported)' : undefined}
            aria-current={activeTab === 'moderation' ? 'page' : undefined}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Review Moderation</span>}
            </div>
            {!isCollapsed && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  activeTab === 'moderation'
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-foreground/80',
                )}
              >
                0
              </span>
            )}
          </Link>

          {/* Payments & Refunds Tab */}
          <Link
            href="/admin?tab=payments"
            data-tour="payments-tab"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              isCollapsed
                ? 'size-12 justify-center'
                : 'justify-between px-3 py-2.5 text-xs font-bold',
              activeTab === 'payments'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-muted hover:text-foreground',
            )}
            title={isCollapsed ? 'Payments & Refunds Ledger' : undefined}
            aria-current={activeTab === 'payments' ? 'page' : undefined}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard
                className={cn('shrink-0', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Payments & Refunds</span>}
            </div>
            {!isCollapsed && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  activeTab === 'payments'
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-foreground/80',
                )}
              >
                Ledger
              </span>
            )}
          </Link>
        </nav>

        {/* Dynamic Contextual Playbook Widget (Shown when expanded) */}
        {!isCollapsed && (
          <>
            {activeTab === 'verification' && (
              <div
                className="animate-fade-in space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs"
                data-tour="verification-checklist"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Shield className="size-4 text-primary" aria-hidden="true" />
                    <span>Verification Checklist</span>
                  </div>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                    Standards
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground/80">
                  Requirements before public map approval:
                </p>

                <ul className="space-y-2.5 text-xs text-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                      1
                    </span>
                    <div>
                      <strong className="font-bold text-foreground">
                        Campus vicinity:
                      </strong>
                      <p className="text-xs font-normal text-foreground/80">
                        Physical location near recognized Cebu university hubs.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                      2
                    </span>
                    <div>
                      <strong className="font-bold text-foreground">
                        Operating hours:
                      </strong>
                      <p className="text-xs font-normal text-foreground/80">
                        Valid schedule & midnight-crossing format.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                      3
                    </span>
                    <div>
                      <strong className="font-bold text-foreground">Seat layout:</strong>
                      <p className="text-xs font-normal text-foreground/80">
                        At least 1 active bookable zone or seat set up.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                      4
                    </span>
                    <div>
                      <strong className="font-bold text-foreground">Host profile:</strong>
                      <p className="text-xs font-normal text-foreground/80">
                        Authentic profile details registered.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'moderation' && (
              <div className="animate-fade-in space-y-3 rounded-2xl border border-amber-300/80 bg-amber-50/70 p-4 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950 dark:text-amber-200">
                    <AlertTriangle
                      className="size-4 text-amber-700 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <span>Community Standards</span>
                  </div>
                  <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-950 uppercase dark:bg-amber-900/80 dark:text-amber-200">
                    Policy
                  </span>
                </div>
                <p className="text-xs font-semibold text-amber-950/90 dark:text-amber-200">
                  Remove or hide reviews containing:
                </p>

                <ul className="space-y-2.5 text-xs text-amber-950 dark:text-amber-100">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-amber-300 font-bold text-amber-950 dark:bg-amber-800 dark:text-amber-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-amber-950 dark:text-amber-100">
                        Harassment & Hate Speech:
                      </strong>
                      <p className="text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
                        Targeted attacks or toxic remarks against hosts.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-amber-300 font-bold text-amber-950 dark:bg-amber-800 dark:text-amber-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-amber-950 dark:text-amber-100">
                        Commercial Spam:
                      </strong>
                      <p className="text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
                        Advertisements or competitor sabotage.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-amber-300 font-bold text-amber-950 dark:bg-amber-800 dark:text-amber-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-amber-950 dark:text-amber-100">
                        Off-Topic Content:
                      </strong>
                      <p className="text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
                        Complaints unrelated to the actual study experience.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="animate-fade-in space-y-3 rounded-2xl border border-sky-300/80 bg-sky-50/70 p-4 shadow-2xs dark:border-sky-700/60 dark:bg-sky-950/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-950 dark:text-sky-200">
                    <CreditCard
                      className="size-4 text-sky-700 dark:text-sky-400"
                      aria-hidden="true"
                    />
                    <span>Refund Eligibility</span>
                  </div>
                  <span className="rounded bg-sky-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-950 uppercase dark:bg-sky-900/80 dark:text-sky-200">
                    Disputes
                  </span>
                </div>
                <p className="text-xs font-semibold text-sky-950/90 dark:text-sky-200">
                  Valid grounds for issuing refunds:
                </p>

                <ul className="space-y-2.5 text-xs text-sky-950 dark:text-sky-100">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-sky-300 font-bold text-sky-950 dark:bg-sky-800 dark:text-sky-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-sky-950 dark:text-sky-100">
                        Facility Emergency:
                      </strong>
                      <p className="text-xs font-medium text-sky-900/90 dark:text-sky-200/90">
                        Power outage, Wi-Fi failure, or emergency closure.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-sky-300 font-bold text-sky-950 dark:bg-sky-800 dark:text-sky-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-sky-950 dark:text-sky-100">
                        Host Overbooking:
                      </strong>
                      <p className="text-xs font-medium text-sky-900/90 dark:text-sky-200/90">
                        Seat could not be honoured upon seeker arrival.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-sky-300 font-bold text-sky-950 dark:bg-sky-800 dark:text-sky-200">
                      •
                    </span>
                    <div>
                      <strong className="font-bold text-sky-950 dark:text-sky-100">
                        System Desync:
                      </strong>
                      <p className="text-xs font-medium text-sky-900/90 dark:text-sky-200/90">
                        Duplicate charge or gateway timeout confirmation.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {/* Platform Policy Note */}
            <div className="animate-fade-in space-y-1.5 rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ShieldCheck
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>Platform Policy Note</span>
              </div>
              <p className="text-xs leading-relaxed text-foreground/80">
                Unverified venues remain strictly private to the host. Seekers can only
                discover venues once an administrator issues approval.
              </p>
            </div>
          </>
        )}

        {/* Quick Tour Launcher Button */}
        <div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('worq:open-admin-tour'))}
            className={cn(
              'flex cursor-pointer items-center rounded-xl border border-primary/25 bg-primary/5 text-xs font-semibold text-primary transition hover:bg-primary/10',
              isCollapsed
                ? 'size-12 justify-center p-0'
                : 'w-full justify-between px-3 py-2.5 shadow-2xs',
            )}
            title="Interactive Onboarding Guide"
          >
            <span className="flex items-center gap-2">
              <Sparkles
                className={cn('shrink-0 text-primary', isCollapsed ? 'size-5' : 'size-4')}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Quick Admin Guide</span>}
            </span>
            {!isCollapsed && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                Tour
              </span>
            )}
          </button>
        </div>

        {/* Shortcuts & Live Tools */}
        <div className="space-y-1 pt-1">
          {!isCollapsed && (
            <p className="mb-1 px-2 text-xs font-bold tracking-wider text-foreground/75 uppercase">
              Live Shortcuts
            </p>
          )}
          <Link
            href="/spaces"
            target="_blank"
            className={cn(
              'flex items-center rounded-xl text-xs font-semibold text-foreground transition hover:bg-muted',
              isCollapsed ? 'size-12 justify-center' : 'justify-between px-3 py-2',
            )}
            title="View Discovery Map"
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
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground/80">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>Payment Gateway Ready</span>
            </div>
          )}
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
                : 'min-h-[44px] w-full justify-center gap-2',
            )}
            title={isCollapsed ? 'Log out' : undefined}
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
