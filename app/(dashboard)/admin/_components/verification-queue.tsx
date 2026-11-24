'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, ShieldCheck, Sparkles, X } from 'lucide-react'

import { setSpaceStatusAction } from '@/app/(dashboard)/admin/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SpaceInspectionDialog } from './space-inspection-dialog'
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
 * Interactive Space Verification Queue (STORY-15, FR-5.1, STORY-17).
 * Renders pending Space cards with optimistic list removals,
 * clear confirmation notices, and an inspection modal dossier.
 */
export function VerificationQueue({ initialSpaces }: VerificationQueueProps) {
  const [spaces, setSpaces] = useState<PendingSpace[]>(initialSpaces)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [inspectingSpace, setInspectingSpace] = useState<PendingSpace | null>(null)

  async function handleDecision(space: PendingSpace, status: 'verified' | 'rejected') {
    const result = await setSpaceStatusAction({
      spaceId: space.id,
      status,
      updatedAt: space.updated_at,
    })

    if (result.success) {
      setRemovingId(space.id)
      const decisionVerb = status === 'verified' ? 'approved' : 'rejected'
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'success',
        title: status === 'verified' ? 'Space Approved' : 'Space Rejected',
        message: `${space.name} has been ${decisionVerb}.`,
      })
      setTimeout(() => {
        setSpaces((prev) => prev.filter((item) => item.id !== space.id))
        setRemovingId(null)
      }, 250)
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
      {/* Title Bar */}
      <div className="-m-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Space Verification
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Review pending Spaces. Approved Spaces become immediately visible in public
            search.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-xl border border-border/80 bg-secondary/80 px-3.5 py-1.5 text-sm font-bold text-foreground shadow-2xs"
        >
          {spaces.length} pending
        </Badge>
      </div>

      {/* Professional Guidance Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 shadow-2xs">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed text-foreground">
          <strong className="font-bold text-foreground">Administrator Guide:</strong>{' '}
          Inspect the Space&apos;s operating hours and campus vicinity. Approving
          immediately publishes coordinates to the public map.
        </div>
      </div>

      {/* Overview metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-primary/40 bg-card p-4.5 shadow-xs ring-1 ring-primary/20 transition-all duration-300 hover:border-primary">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              Pending Review
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {spaces.length} {spaces.length === 1 ? 'Space' : 'Spaces'}
            </p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:border-border">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-2xs">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Quality Standard
            </p>
            <p className="text-sm font-bold text-foreground">Verified Standards</p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:border-border">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-2xs">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Search Sync
            </p>
            <p className="text-sm font-bold text-foreground">Instant Map Publishing</p>
          </div>
        </div>
      </div>

      {notice ? (
        <Alert
          role="status"
          aria-live="polite"
          variant={notice.type === 'error' ? 'destructive' : 'default'}
          className="relative rounded-2xl border-border/80 pr-12 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <AlertTitle className="font-semibold">{notice.title}</AlertTitle>
            <AlertDescription className="text-sm">{notice.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 min-h-[48px] min-w-[48px] rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </Alert>
      ) : null}

      {spaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-xs">
            <CheckCircle2 className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground">All caught up!</h2>
          <p className="mt-1.5 max-w-md text-sm font-medium text-muted-foreground">
            There are currently no Spaces pending verification. Newly submitted Spaces
            from hosts will automatically appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={cn(
                'transition-all duration-300 ease-out',
                removingId === space.id &&
                  'pointer-events-none -translate-x-3 scale-95 opacity-0',
              )}
            >
              <VerificationCard
                space={space}
                onDecision={handleDecision}
                onInspect={(s) => setInspectingSpace(s)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Space Inspection Dossier Modal */}
      <SpaceInspectionDialog
        space={inspectingSpace}
        isOpen={!!inspectingSpace}
        onClose={() => setInspectingSpace(null)}
        onApprove={async (s) => {
          await handleDecision(s, 'verified')
        }}
        onReject={async (s) => {
          await handleDecision(s, 'rejected')
        }}
      />
    </div>
  )
}
