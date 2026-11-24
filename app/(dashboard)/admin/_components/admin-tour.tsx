'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TourStep {
  target: string
  fallbackTarget?: string
  preferredPlacement: 'right' | 'bottom' | 'left' | 'top'
  title: string
  badge: string
  description: string
  criticalNote: string
  icon: typeof Building2
  iconColor: string
  iconBg: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="verification-queue"]',
    preferredPlacement: 'bottom',
    title: 'Pending Queue & Live Map Publishing',
    badge: 'Step 1 of 5',
    description:
      'Newly submitted study spaces arrive here in Pending status. Approving instantly publishes coordinates to the public discovery map for seekers.',
    criticalNote: 'Critical: Unverified spaces remain hidden until approved.',
    icon: Building2,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
  },
  {
    target: '[data-tour="inspection-card"]',
    fallbackTarget: '[data-tour="verification-queue"]',
    preferredPlacement: 'bottom',
    title: 'Inspection & Structured Rejection',
    badge: 'Step 2 of 5',
    description:
      'Click any space to inspect campus vicinity, hours, and snap-grid capacity. If standards fail, reject with structured feedback so hosts can resubmit.',
    criticalNote: 'Actionable: Hosts see structured notes to fix their listing.',
    icon: Eye,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-500/10',
  },
  {
    target: '[data-tour="verification-checklist"]',
    fallbackTarget: '[data-tour="sidebar-toggle"]',
    preferredPlacement: 'right',
    title: '4 Pillars of Space Verification',
    badge: 'Step 3 of 5',
    description:
      'Always cross-check physical campus proximity near recognized Cebu university hubs, valid closing schedules (including late-night hours), and bookable seat layout.',
    criticalNote: 'Guarantees seekers never arrive at an unready venue.',
    icon: ShieldCheck,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    target: '[data-tour="moderation-tab"]',
    preferredPlacement: 'right',
    title: 'Anti-Fraud Review Moderation',
    badge: 'Step 4 of 5',
    description:
      'Triage reported reviews backed by physical QR check-in proof. If a reviewer never scanned in at the venue desk, their review lacks stay verification and can be hidden.',
    criticalNote: 'Protects hosts from competitor sabotage and false claims.',
    icon: ShieldAlert,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  {
    target: '[data-tour="payments-tab"]',
    fallbackTarget: '[data-tour="sidebar-toggle"]',
    preferredPlacement: 'right',
    title: 'Disputes & Payments Ledger',
    badge: 'Step 5 of 5',
    description:
      'Audit platform transactions and resolve seeker hold disputes with 1-click sandbox refunds. Press Ctrl+B or Cmd+B anytime to collapse the sidebar.',
    criticalNote: 'Shortcut: Press Ctrl+B or Cmd+B to toggle the sidebar.',
    icon: CreditCard,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
  },
]

const STORAGE_KEY = 'worq_admin_tour_seen_v2'

interface CardPosition {
  top: number
  left: number
  placement: 'right' | 'bottom' | 'left' | 'top'
  arrowOffset: number
}

/**
 * Compact, Precision-Positioned Onboarding Tour for Administrators (STORY-17).
 * Features:
 * - Unblurred cutout mask directly over the target element.
 * - Compact, sleek floating card (max 340px) right next to the target element.
 * - Strict viewport clamping ensuring all buttons are 100% visible and clickable.
 * - Directional pointer arrow pointing straight at the highlighted spot.
 * - Zero lag GPU translate3d positioning.
 */
export function AdminTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition>({
    top: 80,
    left: 80,
    placement: 'bottom',
    arrowOffset: 24,
  })

  const cardRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Auto-launch on first visit
  useEffect(() => {
    // Suppress auto-launch in automated test environments (Playwright, WebDriver, CI, or unit test)
    if (
      typeof window !== 'undefined' &&
      (window.navigator?.webdriver ||
        process.env.NODE_ENV === 'test' ||
        window.localStorage.getItem('studyhub:suppress-tour') === 'true')
    ) {
      return
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY)
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // Listen for manual launch events from the sidebar Quick Guide button
  useEffect(() => {
    function handleManualOpen() {
      setCurrentStepIndex(0)
      setIsOpen(true)
    }
    window.addEventListener('worq:open-admin-tour', handleManualOpen)
    return () => window.removeEventListener('worq:open-admin-tour', handleManualOpen)
  }, [])

  const currentStep = TOUR_STEPS[currentStepIndex]

  // Precision positioning adjacent to target element with strict on-screen clamping
  const updatePosition = useCallback(() => {
    if (!currentStep) return
    let el = document.querySelector(currentStep.target)
    if (!el && currentStep.fallbackTarget) {
      el = document.querySelector(currentStep.fallbackTarget)
    }

    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)

      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const cardWidth = Math.min(340, viewportW - 32)
      // Accurately measure or conservatively estimate card height
      const cardHeight = cardRef.current ? cardRef.current.offsetHeight : 260
      const margin = 14

      // Strict boundaries so buttons can NEVER overflow off-screen
      const maxAllowedTop = Math.max(16, viewportH - cardHeight - 24)
      const maxAllowedLeft = Math.max(16, viewportW - cardWidth - 16)

      let placement: 'right' | 'bottom' | 'left' | 'top' = currentStep.preferredPlacement
      let top = 0
      let left = 0
      let arrowOffset = 24

      const targetCenterX = rect.left + rect.width / 2
      const targetCenterY = rect.top + rect.height / 2

      // Right placement (ideal for sidebar targets)
      if (placement === 'right') {
        if (rect.right + cardWidth + margin <= viewportW) {
          left = rect.right + margin
          top = targetCenterY - cardHeight / 2
        } else if (rect.bottom + cardHeight + margin <= viewportH) {
          placement = 'bottom'
          top = rect.bottom + margin
          left = Math.max(16, rect.left)
        } else if (rect.top - cardHeight - margin >= 16) {
          placement = 'top'
          top = rect.top - cardHeight - margin
          left = Math.max(16, rect.left)
        } else {
          placement = 'right'
          left = Math.max(16, rect.right + margin)
          top = rect.top
        }
      }

      // Bottom placement (ideal for main workspace / queue targets)
      if (placement === 'bottom') {
        if (rect.bottom + cardHeight + margin <= viewportH) {
          top = rect.bottom + margin
          left = Math.max(16, rect.left + 10)
        } else if (rect.top - cardHeight - margin >= 16) {
          placement = 'top'
          top = rect.top - cardHeight - margin
          left = Math.max(16, rect.left + 10)
        } else if (rect.right + cardWidth + margin <= viewportW) {
          placement = 'right'
          left = rect.right + margin
          top = rect.top
        } else {
          // Bottom fallback clamped safely on-screen
          top = maxAllowedTop
          left = Math.max(16, rect.left + 10)
        }
      }

      // Clamp strictly within viewport
      top = Math.max(16, Math.min(top, maxAllowedTop))
      left = Math.max(16, Math.min(left, maxAllowedLeft))

      // Calculate directional arrow alignment pointing straight at target center
      if (placement === 'bottom' || placement === 'top') {
        arrowOffset = Math.max(20, Math.min(targetCenterX - left, cardWidth - 20))
      } else {
        arrowOffset = Math.max(20, Math.min(targetCenterY - top, cardHeight - 20))
      }

      setCardPos({ top, left, placement, arrowOffset })
    } else {
      setTargetRect(null)
    }
  }, [currentStep])

  // Scroll element into view smoothly only when step changes
  useEffect(() => {
    if (!isOpen || !currentStep) return

    let el = document.querySelector(currentStep.target)
    if (!el && currentStep.fallbackTarget) {
      el = document.querySelector(currentStep.fallbackTarget)
    }

    if (el) {
      const rect = el.getBoundingClientRect()
      const isInViewport =
        rect.top >= 40 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight - 40 &&
        rect.right <= window.innerWidth

      if (!isInViewport) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    }

    const raf = window.requestAnimationFrame(() => {
      updatePosition()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isOpen, currentStepIndex, currentStep, updatePosition])

  // Throttled RAF listener for scroll & resize
  useEffect(() => {
    if (!isOpen) return

    function handleThrottledUpdate() {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        updatePosition()
        rafRef.current = null
      })
    }

    window.addEventListener('resize', handleThrottledUpdate)
    window.addEventListener('scroll', handleThrottledUpdate, true)

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      window.removeEventListener('resize', handleThrottledUpdate)
      window.removeEventListener('scroll', handleThrottledUpdate, true)
    }
  }, [isOpen, updatePosition])

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleDismiss()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function handleDismiss() {
    setIsOpen(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  function handleNext() {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      handleDismiss()
    }
  }

  function handlePrev() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }

  if (!isOpen || !currentStep) return null

  const Icon = currentStep.icon
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* 1. Crystal-Clear SVG Mask Cutout: ZERO blur on the target spot */}
      <svg
        className="pointer-events-none fixed inset-0 z-40 h-full w-full"
        style={{ width: '100vw', height: '100vh' }}
        aria-hidden="true"
      >
        <defs>
          <mask id="spotlight-cutout-mask">
            {/* White area = covered by semi-transparent dark shade */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black area = 100% transparent cutout hole with ZERO blur */}
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Semi-transparent dark tint (No blur filter!) */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.55)"
          mask="url(#spotlight-cutout-mask)"
          className="pointer-events-auto cursor-pointer"
          onClick={handleDismiss}
        />
      </svg>

      {/* 2. Target Spotlight Border Ring with Soft Glow */}
      {targetRect && (
        <div
          className="pointer-events-none fixed top-0 left-0 z-40 rounded-xl shadow-[0_0_24px_rgba(22,101,52,0.45)] ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            transform: `translate3d(${targetRect.left - 4}px, ${targetRect.top - 4}px, 0)`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            willChange: 'transform, width, height',
            transition:
              'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), width 320ms cubic-bezier(0.16, 1, 0.3, 1), height 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          aria-hidden="true"
        />
      )}

      {/* 3. Compact Floating Card with Visible Pointer Arrow */}
      <div
        ref={cardRef}
        className="pointer-events-auto fixed top-0 left-0 z-50"
        style={{
          transform: `translate3d(${cardPos.left}px, ${cardPos.top}px, 0)`,
          maxWidth: '340px',
          width: 'calc(100vw - 32px)',
          willChange: 'transform',
          transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="relative overflow-visible rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xl sm:p-4">
          {/* Arrow pointing directly to the target element */}
          {cardPos.placement === 'right' && (
            <div
              className="absolute -left-2 size-3.5 -translate-y-1/2 rotate-45 border-b border-l border-border/80 bg-card shadow-xs transition-all duration-300"
              style={{ top: `${cardPos.arrowOffset}px` }}
              aria-hidden="true"
            />
          )}

          {cardPos.placement === 'bottom' && (
            <div
              className="absolute -top-2 size-3.5 -translate-x-1/2 rotate-45 border-t border-l border-border/80 bg-card shadow-xs transition-all duration-300"
              style={{ left: `${cardPos.arrowOffset}px` }}
              aria-hidden="true"
            />
          )}

          {cardPos.placement === 'top' && (
            <div
              className="absolute -bottom-2 size-3.5 -translate-x-1/2 rotate-45 border-r border-b border-border/80 bg-card shadow-xs transition-all duration-300"
              style={{ left: `${cardPos.arrowOffset}px` }}
              aria-hidden="true"
            />
          )}

          {cardPos.placement === 'left' && (
            <div
              className="absolute -right-2 size-3.5 -translate-y-1/2 rotate-45 border-t border-r border-border/80 bg-card shadow-xs transition-all duration-300"
              style={{ top: `${cardPos.arrowOffset}px` }}
              aria-hidden="true"
            />
          )}

          {/* Top Bar: Compact Badge, Indicator Dots & Close */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
              >
                {currentStep.badge}
              </Badge>
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      idx === currentStepIndex
                        ? 'w-4 bg-primary'
                        : 'w-1.5 bg-muted-foreground/30',
                    )}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="min-h-[48px] min-w-[48px] rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Skip onboarding tour"
              title="Skip tour (Esc)"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {/* Body Content (Compact, readable, no clutter) */}
          <div
            key={currentStepIndex}
            className="animate-fade-in mt-3 flex items-start gap-3 transition-opacity duration-200"
          >
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl shadow-2xs',
                currentStep.iconBg,
                currentStep.iconColor,
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2
                id="tour-step-title"
                className="font-heading text-sm font-bold tracking-tight text-foreground"
              >
                {currentStep.title}
              </h2>
              <p className="text-xs leading-relaxed text-foreground/80">
                {currentStep.description}
              </p>

              {/* Compact Policy Callout */}
              <div className="mt-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] font-semibold text-foreground/90">
                {currentStep.criticalNote}
              </div>
            </div>
          </div>

          {/* Action Footer: Always Visible and 100% Clickable */}
          <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleDismiss}
              className="min-h-[48px] min-w-[48px] px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Skip tour
            </Button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handlePrev}
                  className="min-h-[48px] min-w-[48px] gap-1 rounded-lg border-border/80 px-2.5 text-xs font-semibold"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Back</span>
                </Button>
              )}

              <Button
                type="button"
                size="default"
                onClick={handleNext}
                className="min-h-[48px] min-w-[48px] gap-1 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                <span>{isLastStep ? 'Finish Tour 🎉' : 'Next Step'}</span>
                {!isLastStep && <ChevronRight className="size-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
