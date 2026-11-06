'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'

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
}

interface VerificationCardProps {
  space: VerificationCardItem
  onDecision: (
    space: VerificationCardItem,
    status: 'verified' | 'rejected',
  ) => Promise<void>
}

/**
 * Individual pending Space card within the verification queue (STORY-15 design §3).
 * Renders Space name, address, hours, host name, creation timestamp, and
 * accessible Approve/Reject action buttons with 48x48 px minimum touch targets (D-031).
 */
export function VerificationCard({ space, onDecision }: VerificationCardProps) {
  const [isPending, setIsPending] = useState(false)
  const [activeDecision, setActiveDecision] = useState<'verified' | 'rejected' | null>(
    null,
  )

  const hostDisplay = space.host_name?.trim()
    ? `Host: ${space.host_name.trim()}`
    : 'Host: Unnamed'

  async function handleAction(status: 'verified' | 'rejected') {
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
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0">
            <h2 className="text-lg font-semibold wrap-anywhere">{space.name}</h2>
          </CardTitle>
          <Badge variant="secondary">Pending verification</Badge>
        </div>
        <CardDescription className="flex items-center gap-1.5 pt-1 wrap-anywhere">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{space.address}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {space.description ? (
          <p className="text-sm wrap-anywhere whitespace-pre-line text-foreground/90">
            {space.description}
          </p>
        ) : null}

        <dl className="space-y-1.5 text-sm">
          <div>
            <dt className="inline font-medium text-foreground">Daily hours: </dt>
            <dd className="inline text-muted-foreground">
              {formatOpeningHours(space.opens_at, space.closes_at)}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Host: </dt>
            <dd className="inline text-muted-foreground">{hostDisplay}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Submitted: </dt>
            <dd className="inline text-muted-foreground">
              <time dateTime={space.created_at}>{formatDateTime(space.created_at)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[48px] min-w-[48px] border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive"
          onClick={() => handleAction('rejected')}
          disabled={isPending}
          aria-busy={isPending && activeDecision === 'rejected'}
        >
          {isPending && activeDecision === 'rejected' ? 'Rejecting...' : 'Reject'}
          <span className="sr-only"> {space.name}</span>
        </Button>

        <Button
          type="button"
          className="min-h-[48px] min-w-[48px] bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => handleAction('verified')}
          disabled={isPending}
          aria-busy={isPending && activeDecision === 'verified'}
        >
          {isPending && activeDecision === 'verified' ? 'Approving...' : 'Approve'}
          <span className="sr-only"> {space.name}</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
