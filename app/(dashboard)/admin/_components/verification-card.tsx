'use client'

import { useState, type ReactNode } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  EyeOff,
  MapPin,
  RefreshCw,
  RotateCcw,
  User,
  XCircle,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import type { VerificationSpace } from '@/lib/data/verification'
import { formatDateTime, formatOpeningHours } from '@/lib/space/format'
import { SpaceEventsList, SPACE_STATUS_LABELS } from './space-events-list'

export type VerificationCardItem = VerificationSpace

/** What a card's buttons ask for: V2, V3, V7, V9 and V10 (STORY-20 design §2). */
export type VerificationAction = 'approve' | 'reject' | 'take_down' | 'undo' | 'put_back'

interface VerificationCardProps {
  space: VerificationCardItem
  onAction: (space: VerificationCardItem, action: VerificationAction) => Promise<void>
  onInspect?: (space: VerificationCardItem) => void
  /** A Host changed this Space since it loaded: decisions wait for a reload (D-086). */
  stale?: boolean
  onReload?: () => void
}

const TIMESTAMP_LABELS = {
  pending: 'Waiting since:',
  verified: 'Verified:',
  rejected: 'Rejected:',
  taken_down: 'Taken down:',
} as const

const BUTTON =
  'min-h-[48px] w-full min-w-[48px] gap-2 rounded-xl px-5 font-semibold sm:w-auto'
const DESTRUCTIVE_OUTLINE =
  'border-destructive/40 bg-destructive/5 text-destructive shadow-2xs hover:border-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:ring-destructive'

function ReasonCallout({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <p className="text-xs font-bold tracking-wider text-destructive uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
        {reason}
      </p>
    </div>
  )
}

function ActionButton({
  label,
  spaceName,
  icon,
  onClick,
  disabled,
  busy,
  className,
  variant,
}: {
  label: string
  spaceName: string
  icon: ReactNode
  onClick: () => void
  disabled: boolean
  busy?: boolean
  className: string
  variant?: 'outline' | 'default'
}) {
  return (
    <Button
      type="button"
      variant={variant ?? 'outline'}
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
    >
      {icon}
      <span>{label}</span>
      <span className="sr-only"> {spaceName}</span>
    </Button>
  )
}

/**
 * One Space on `/admin` (STORY-15 design §3, STORY-20 design §3, screen 1). Shows the
 * Space, its status in words, how a Pending Space got there, its reason, its list of
 * changes, and the buttons its list allows. Every button is at least 48 × 48 px and
 * names the Space for screen readers (D-031). When a Host has changed the Space since it
 * loaded, an "Updated by Host" notice replaces the decision until a reload (D-086).
 */
export function VerificationCard({
  space,
  onAction,
  onInspect,
  stale = false,
  onReload,
}: VerificationCardProps) {
  const [approving, setApproving] = useState(false)
  const hostDisplay = space.host_name?.trim() || 'Unnamed'
  const disabled = stale || approving

  async function approve() {
    setApproving(true)
    try {
      await onAction(space, 'approve')
    } finally {
      setApproving(false)
    }
  }

  const reasonLabel =
    space.status === 'pending'
      ? 'Previous reason:'
      : space.status === 'rejected' || space.status === 'taken_down'
        ? 'Reason:'
        : null

  return (
    <Card className="group relative h-full overflow-visible rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md">
      <CardHeader className="min-w-0 grid-cols-[minmax(0,1fr)] gap-3 pb-4">
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
          <div className="flex flex-wrap gap-2">
            {space.origin === 'edited' ? (
              <Badge
                variant="outline"
                className="h-auto max-w-full rounded-full px-3 py-1 text-xs font-semibold whitespace-normal"
              >
                Edited
              </Badge>
            ) : null}
            {space.origin === 'resubmitted' ? (
              <Badge
                variant="outline"
                className="h-auto max-w-full rounded-full px-3 py-1 text-xs font-semibold whitespace-normal"
              >
                Resubmitted
              </Badge>
            ) : null}
            <Badge
              variant={
                space.status === 'rejected' || space.status === 'taken_down'
                  ? 'destructive'
                  : 'secondary'
              }
              className="h-auto max-w-full rounded-full px-3 py-1 text-xs font-semibold whitespace-normal"
            >
              {SPACE_STATUS_LABELS[space.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pt-0">
        {stale ? (
          <Alert
            role="status"
            aria-live="polite"
            className="rounded-xl border-primary/40"
          >
            <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
            <AlertTitle className="font-semibold">Updated by Host</AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <p className="wrap-anywhere">
                {space.name} was just changed. Reload to inspect the latest details and
                list of changes before deciding.
              </p>
              <Button
                type="button"
                className="min-h-[48px] min-w-[48px] rounded-xl font-semibold"
                onClick={onReload}
              >
                Reload latest version
                <span className="sr-only"> {space.name}</span>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {reasonLabel && space.status_reason ? (
          <ReasonCallout label={reasonLabel} reason={space.status_reason} />
        ) : null}

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

        {/* Columns follow the card's own width, not the viewport's (#430): beside the
            sidebar at 200% text the card is narrower than 1024 px, so lg:grid-cols-3
            forced three tiles into about 250 px and pushed the page sideways. */}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2.5">
          <div className="flex min-w-0 flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider wrap-anywhere text-muted-foreground uppercase">
              <User className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Host:{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              {hostDisplay}
            </dd>
          </div>

          <div className="flex min-w-0 flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider wrap-anywhere text-muted-foreground uppercase">
              <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              Daily hours:{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>

          <div className="flex min-w-0 flex-col justify-center rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-wider wrap-anywhere text-muted-foreground uppercase">
              <Calendar className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {TIMESTAMP_LABELS[space.status]}{' '}
            </dt>
            <dd className="mt-1 block font-bold wrap-anywhere text-foreground">
              <time dateTime={space.status_changed_at}>
                {formatDateTime(space.status_changed_at)}
              </time>
            </dd>
          </div>
        </dl>

        <SpaceEventsList events={space.events} />
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-3 rounded-b-2xl border-t border-border/70 bg-muted/25 px-4 py-4 sm:px-6">
        {onInspect ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] w-full min-w-[48px] rounded-xl border-border/80 font-semibold text-foreground hover:bg-muted sm:w-auto"
            onClick={() => onInspect(space)}
          >
            <span>Inspect</span>
            <span className="sr-only"> {space.name}</span>
          </Button>
        ) : null}

        {space.status === 'pending' ? (
          <>
            <ActionButton
              label="Reject"
              spaceName={space.name}
              icon={<XCircle className="size-4 shrink-0" aria-hidden="true" />}
              onClick={() => void onAction(space, 'reject')}
              disabled={disabled}
              className={`${BUTTON} ${DESTRUCTIVE_OUTLINE}`}
            />
            <ActionButton
              label={approving ? 'Approving...' : 'Approve'}
              spaceName={space.name}
              icon={<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
              onClick={() => void approve()}
              disabled={disabled}
              busy={approving}
              variant="default"
              className={`${BUTTON} bg-primary px-6 text-primary-foreground shadow-sm hover:bg-primary/90`}
            />
          </>
        ) : null}

        {space.status === 'verified' ? (
          <ActionButton
            label="Take down"
            spaceName={space.name}
            icon={<EyeOff className="size-4 shrink-0" aria-hidden="true" />}
            onClick={() => void onAction(space, 'take_down')}
            disabled={disabled}
            className={`${BUTTON} ${DESTRUCTIVE_OUTLINE}`}
          />
        ) : null}

        {space.status === 'rejected' || space.status === 'taken_down' ? (
          <ActionButton
            label={space.status === 'rejected' ? 'Undo' : 'Put back'}
            spaceName={space.name}
            icon={<RotateCcw className="size-4 shrink-0" aria-hidden="true" />}
            onClick={() =>
              void onAction(space, space.status === 'rejected' ? 'undo' : 'put_back')
            }
            disabled={disabled}
            className={`${BUTTON} border-border/80 text-foreground hover:bg-muted`}
          />
        ) : null}
      </CardFooter>
    </Card>
  )
}
