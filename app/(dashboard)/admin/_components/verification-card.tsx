'use client'

import { useState } from 'react'
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  MapPin,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDateTime, formatOpeningHours } from '@/lib/space/format'

export type VerificationCardItem = {
  id: string
  name: string
  description: string | null
  address: string
  opens_at: string
  closes_at: string
  status: 'pending' | 'verified' | 'rejected'
  created_at: string
  updated_at: string
  host_name: string | null
  photos?: string[] | null
}

interface VerificationCardProps {
  space: VerificationCardItem
  onDecision: (
    space: VerificationCardItem,
    status: 'verified' | 'rejected',
  ) => Promise<void>
  onInspect?: (space: VerificationCardItem) => void
}

/**
 * Individual pending Space card within the verification queue (STORY-15 design §3).
 * Renders Space name, address, hours, host name, creation timestamp, and
 * accessible Approve/Reject action buttons with 48x48 px minimum touch targets (D-031).
 */
export function VerificationCard({
  space,
  onDecision,
  onInspect,
}: VerificationCardProps) {
  const [isPending, setIsPending] = useState(false)
  const [activeDecision, setActiveDecision] = useState<'verified' | 'rejected' | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  // The "Host:" label is the <dt> below, so the value is the name alone (design §3).
  const hostDisplay = space.host_name?.trim() || 'Unnamed'

  async function handleCopyAddress(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(space.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is not available
    }
  }

  async function handleAction(e: React.MouseEvent, status: 'verified' | 'rejected') {
    e.stopPropagation()
    setIsPending(true)
    setActiveDecision(status)
    try {
      await onDecision(space, status)
    } finally {
      setIsPending(false)
      setActiveDecision(null)
    }
  }

  function handleCardClick() {
    onInspect?.(space)
  }

  return (
    <Card
      onClick={handleCardClick}
      className="group relative h-full cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
    >
      {/* Interactive hover accent: hidden by default, smoothly reveals when the cursor moves to this card */}
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      />

      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 font-heading text-xl font-bold text-primary shadow-2xs transition-all duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xs"
            >
              {space.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <CardTitle className="min-w-0">
                <h2 className="font-heading text-xl font-bold tracking-tight wrap-anywhere text-foreground transition-colors group-hover:text-primary group-hover:underline sm:text-2xl">
                  {space.name}
                </h2>
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium wrap-anywhere text-foreground/85">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{space.address}</span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
                  title={copied ? 'Copied address!' : 'Copy address to clipboard'}
                  aria-label={
                    copied ? 'Copied address' : `Copy address for ${space.name}`
                  }
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                </button>
                {copied && (
                  <span className="text-[11px] font-semibold text-emerald-600">
                    Copied!
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-amber-600"></span>
            </span>
            <span>Pending verification</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pt-0">
        {space.description ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors group-hover:border-border group-hover:bg-muted/35">
            <p className="text-xs font-bold tracking-wider text-foreground/75 uppercase">
              Description
            </p>
            <p className="mt-1 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground italic">
              &ldquo;{space.description}&rdquo;
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-50/30 hover:shadow-xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-foreground/75 uppercase">
              <User
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Host:{' '}
            </dt>
            <dd className="mt-1 block truncate font-bold wrap-anywhere text-foreground">
              {hostDisplay}
            </dd>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-200 hover:border-sky-400/60 hover:bg-sky-50/30 hover:shadow-xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-foreground/75 uppercase">
              <Clock
                className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              Daily hours:{' '}
            </dt>
            <dd className="mt-1 block truncate font-bold wrap-anywhere text-foreground">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-200 hover:border-amber-400/60 hover:bg-amber-50/30 hover:shadow-xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-foreground/75 uppercase">
              <Calendar
                className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              Submitted:{' '}
            </dt>
            <dd className="mt-1 block truncate font-bold wrap-anywhere text-foreground">
              <time dateTime={space.created_at}>{formatDateTime(space.created_at)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>

      {/* flex-wrap: at 360 px with 200% text both buttons don't fit on one line (D-031). */}
      <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 bg-muted/25 px-6 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Approving immediately publishes listing to public search</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onInspect ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px] min-w-[48px] gap-2 rounded-xl border-border/80 bg-background px-4 font-semibold text-foreground shadow-2xs transition-all duration-200 hover:border-primary/50 hover:bg-muted hover:text-primary active:scale-[0.98]"
              onClick={(e) => {
                e.stopPropagation()
                onInspect(space)
              }}
              aria-label={`Inspect details for ${space.name}`}
            >
              <Eye className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Inspect Details</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] min-w-[48px] gap-2 rounded-xl border-destructive/40 bg-destructive/5 px-5 font-semibold text-destructive shadow-2xs transition-all duration-200 hover:border-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:ring-destructive active:scale-[0.98]"
            onClick={(e) => handleAction(e, 'rejected')}
            disabled={isPending}
            aria-busy={isPending && activeDecision === 'rejected'}
          >
            <XCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {isPending && activeDecision === 'rejected' ? 'Rejecting...' : 'Reject'}
            </span>
            <span className="sr-only"> {space.name}</span>
          </Button>

          <Button
            type="button"
            className="min-h-[48px] min-w-[48px] gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
            onClick={(e) => handleAction(e, 'verified')}
            disabled={isPending}
            aria-busy={isPending && activeDecision === 'verified'}
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {isPending && activeDecision === 'verified' ? 'Approving...' : 'Approve'}
            </span>
            <span className="sr-only"> {space.name}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
