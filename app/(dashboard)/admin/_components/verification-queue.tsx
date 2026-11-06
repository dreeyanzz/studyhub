'use client'

import { useState } from 'react'
import { Inbox, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  setSpaceStatusAction,
  type SetSpaceStatusResult,
} from '@/app/(dashboard)/admin/actions'
import { VerificationCard, type VerificationCardItem } from './verification-card'

export type PendingSpace = VerificationCardItem

interface VerificationQueueProps {
  initialSpaces: PendingSpace[]
}

type Notice = {
  id: string
  type: 'success' | 'error'
  title: string
  message: string
}

/**
 * Verification queue component for Administrators (STORY-15 design §3).
 * Renders the list of pending Spaces, active count badge, empty state,
 * and handles optimistic action states with accessible role="status" announcements.
 */
export function VerificationQueue({ initialSpaces }: VerificationQueueProps) {
  const [spaces, setSpaces] = useState<PendingSpace[]>(initialSpaces)
  const [notice, setNotice] = useState<Notice | null>(null)

  async function handleDecision(space: PendingSpace, status: 'verified' | 'rejected') {
    const result: SetSpaceStatusResult = await setSpaceStatusAction({
      spaceId: space.id,
      status,
      updatedAt: space.updated_at,
    })

    if (result.success) {
      setSpaces((prev) => prev.filter((item) => item.id !== space.id))
      const decisionVerb = status === 'verified' ? 'approved' : 'rejected'
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'success',
        title: status === 'verified' ? 'Space approved' : 'Space rejected',
        message: `${space.name} has been ${decisionVerb}.`,
      })
    } else {
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'error',
        title: 'Action could not be completed',
        message: result.error,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Space Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Review pending Spaces. Approved Spaces become immediately visible in public
            search.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {spaces.length} pending
        </Badge>
      </div>

      {notice ? (
        <Alert
          role="status"
          aria-live="polite"
          variant={notice.type === 'error' ? 'destructive' : 'default'}
          className="relative pr-12"
        >
          <div className="flex flex-col gap-1">
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </Alert>
      ) : null}

      {spaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Inbox className="mb-4 size-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">No pending spaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All spaces have been reviewed.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {spaces.map((space) => (
            <VerificationCard key={space.id} space={space} onDecision={handleDecision} />
          ))}
        </div>
      )}
    </div>
  )
}
