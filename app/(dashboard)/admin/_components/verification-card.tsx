'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, Clock, MapPin, User, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
 * accessible Inspect, Approve, and Reject action buttons with 48x48 px minimum touch targets (D-031).
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
  const hostDisplay = space.host_name?.trim() || 'Unnamed'

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

  return (
    <Card className="group relative h-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md">
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 font-heading text-xl font-bold text-primary shadow-2xs transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {space.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <CardTitle className="min-w-0">
                <h2 className="font-heading text-xl font-bold tracking-tight wrap-anywhere text-foreground sm:text-2xl">
                  {space.name}
                </h2>
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1.5 text-sm font-medium wrap-anywhere text-muted-foreground">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{space.address}</span>
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-xs font-semibold"
          >
            Pending verification
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pt-0">
        {space.description ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Description
            </p>
            <p className="mt-1 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground italic">
              &ldquo;{space.description}&rdquo;
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <User className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Host:{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              {hostDisplay}
            </dd>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Daily hours:{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <Calendar className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Submitted:{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              <time dateTime={space.created_at}>{formatDateTime(space.created_at)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-3 border-t border-border/70 bg-muted/25 px-6 py-4">
        {onInspect && (
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] min-w-[48px] rounded-xl border-border/80 font-semibold text-foreground hover:bg-muted"
            onClick={() => onInspect(space)}
          >
            <span>Inspect</span>
            <span className="sr-only"> {space.name}</span>
          </Button>
        )}

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
          className="min-h-[48px] min-w-[48px] gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
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
      </CardFooter>
    </Card>
  )
}
