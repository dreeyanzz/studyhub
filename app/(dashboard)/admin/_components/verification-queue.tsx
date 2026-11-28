'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, X } from 'lucide-react'

import {
  setSpaceStatusAction,
  type HoldCleanupSummary,
  type SetSpaceStatusResult,
} from '@/app/(dashboard)/admin/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  SpaceVerificationDecision,
  VerificationQueueTab,
} from '@/lib/validation/verification'
import { RealtimeSpaceNotice } from './realtime-space-notice'
import { SpaceInspectionDialog } from './space-inspection-dialog'
import {
  VerificationCard,
  type VerificationAction,
  type VerificationCardItem,
} from './verification-card'
import {
  VerificationConfirmDialog,
  type ConfirmMode,
} from './verification-confirm-dialog'
import { VerificationReasonDialog, type ReasonMode } from './verification-reason-dialog'

export type PendingSpace = VerificationCardItem

/** The tab links, in the design's order (STORY-20 design §3, screen 1). */
export const TAB_LINKS: { tab: VerificationQueueTab; label: string; count: string }[] = [
  { tab: 'pending', label: 'Pending', count: 'pending' },
  { tab: 'verified', label: 'Verified', count: 'verified' },
  { tab: 'rejected', label: 'Rejected', count: 'rejected' },
  { tab: 'taken_down', label: 'Taken down', count: 'taken down' },
]

const EMPTY: Record<VerificationQueueTab, { title: string; body: string }> = {
  pending: { title: 'No pending spaces', body: 'All spaces have been reviewed.' },
  verified: { title: 'No verified spaces', body: 'Approved spaces appear here.' },
  rejected: {
    title: 'No rejected spaces',
    body: 'Rejected spaces appear here with their reasons.',
  },
  taken_down: {
    title: 'No taken down spaces',
    body: 'Spaces taken down from public view appear here.',
  },
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** The success announcement for each move, with the hold summary (design §3, D-085). */
export function successMessage(
  action: VerificationAction,
  name: string,
  holds?: HoldCleanupSummary,
): string {
  const base = {
    approve: `${name} has been approved.`,
    reject: `${name} has been rejected.`,
    take_down: `${name} has been taken down.`,
    undo: `Rejection undone. ${name} is now Verified.`,
    put_back: `${name} has been put back and is now Verified.`,
  }[action]
  if (!holds || holds.cancelledCount === 0) return base
  let message = `${base} ${plural(holds.cancelledCount, 'unstarted hold', 'unstarted holds')} cancelled; ${plural(holds.refundedCount, 'sandbox fee', 'sandbox fees')} refunded.`
  if (holds.failedRefundCount > 0) {
    message += ` ${plural(holds.failedRefundCount, 'sandbox refund', 'sandbox refunds')} could not finish automatically — retry on Payments.`
  }
  return message
}

const DECISIONS: Record<VerificationAction, SpaceVerificationDecision> = {
  approve: 'verified',
  reject: 'rejected',
  take_down: 'taken_down',
  undo: 'verified',
  put_back: 'verified',
}

const TITLES: Record<VerificationAction, string> = {
  approve: 'Space Approved',
  reject: 'Space Rejected',
  take_down: 'Space Taken Down',
  undo: 'Rejection Undone',
  put_back: 'Space Put Back',
}

type Notice = {
  id: string
  type: 'success' | 'error'
  title: string
  message: string
  reload?: boolean
  paymentsLink?: boolean
}

interface VerificationQueueProps {
  tab: VerificationQueueTab
  initialSpaces: PendingSpace[]
}

/**
 * The Space Verification console (STORY-15, STORY-17, STORY-20 design §3, screen 1): the
 * four status lists, their decisions and dialogs, the result announcement, and the live
 * notice that pauses decisions on a Space its Host has just changed (D-086).
 */
export function VerificationQueue({ tab, initialSpaces }: VerificationQueueProps) {
  const router = useRouter()
  const [spaces, setSpaces] = useState<PendingSpace[]>(initialSpaces)
  const [loaded, setLoaded] = useState(initialSpaces)
  const [stale, setStale] = useState<ReadonlySet<string>>(new Set())
  const [deciding, setDeciding] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [inspectingSpace, setInspectingSpace] = useState<PendingSpace | null>(null)
  const [reasonDialog, setReasonDialog] = useState<{
    space: PendingSpace
    mode: ReasonMode
  } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    space: PendingSpace
    mode: ConfirmMode
  } | null>(null)

  // A reload (router.refresh) brings new server data: show it, and clear the stale mark
  // of every Space whose version changed (D-086).
  if (loaded !== initialSpaces) {
    const fresh = new Map(initialSpaces.map((space) => [space.id, space.updated_at]))
    const before = new Map(loaded.map((space) => [space.id, space.updated_at]))
    setLoaded(initialSpaces)
    setSpaces(initialSpaces)
    setStale(
      (prev) =>
        new Set(
          [...prev].filter((id) => fresh.has(id) && fresh.get(id) === before.get(id)),
        ),
    )
  }

  const reload = useCallback(() => {
    setNotice(null)
    router.refresh()
  }, [router])

  const markStale = useCallback((spaceId: string) => {
    setStale((prev) => (prev.has(spaceId) ? prev : new Set(prev).add(spaceId)))
    // A dialog for that Space closes: its decision would use the old version.
    setReasonDialog((open) => (open?.space.id === spaceId ? null : open))
    setConfirmDialog((open) => (open?.space.id === spaceId ? null : open))
    setInspectingSpace((open) => (open?.id === spaceId ? null : open))
  }, [])

  const watched = useMemo(
    () => spaces.map(({ id, updated_at }) => ({ id, updated_at })),
    [spaces],
  )

  async function submit(
    space: PendingSpace,
    action: VerificationAction,
    reason?: string,
  ): Promise<SetSpaceStatusResult> {
    setDeciding((prev) => new Set(prev).add(space.id))
    let result: SetSpaceStatusResult
    try {
      result = await setSpaceStatusAction({
        spaceId: space.id,
        status: DECISIONS[action],
        updatedAt: space.updated_at,
        reason,
      })
    } finally {
      setDeciding((prev) => {
        const next = new Set(prev)
        next.delete(space.id)
        return next
      })
    }

    if (result.success) {
      setRemovingId(space.id)
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'success',
        title: TITLES[action],
        message: successMessage(action, space.name, result.holds),
        paymentsLink: (result.holds?.failedRefundCount ?? 0) > 0,
      })
      setTimeout(() => {
        setSpaces((prev) => prev.filter((item) => item.id !== space.id))
        setRemovingId(null)
      }, 250)
    } else if (action === 'approve') {
      // A refusal from a dialog shows inside that dialog instead.
      setNotice({
        id: `${space.id}-${Date.now()}`,
        type: 'error',
        title: 'Action could not be completed',
        message: result.error,
        reload: result.reload,
      })
    }
    return result
  }

  async function handleAction(space: PendingSpace, action: VerificationAction) {
    if (stale.has(space.id)) return
    if (action === 'approve') {
      await submit(space, 'approve')
      return
    }
    setInspectingSpace(null)
    if (action === 'reject') setReasonDialog({ space, mode: 'rejected' })
    else if (action === 'take_down') setReasonDialog({ space, mode: 'taken_down' })
    else setConfirmDialog({ space, mode: action })
  }

  const current = TAB_LINKS.find((link) => link.tab === tab) ?? TAB_LINKS[0]!

  return (
    <div className="space-y-6">
      <RealtimeSpaceNotice spaces={watched} deciding={deciding} onStale={markStale} />

      {/* Title Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1.5">
          <p className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
            Administration · Queue
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
            Space Verification
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Review Pending Spaces, inspect changes, take Verified Spaces down, or undo
            past decisions.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-xs font-semibold text-foreground tabular-nums shadow-2xs"
        >
          {spaces.length} {current.count}
        </Badge>
      </div>

      <nav aria-label="Verification status lists">
        <ul className="flex flex-wrap gap-2">
          {TAB_LINKS.map((link) => {
            const active = link.tab === tab
            return (
              <li key={link.tab}>
                <Link
                  href={`/admin?tab=${link.tab}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition-all focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-foreground shadow-2xs hover:border-primary/40 hover:bg-surface-subtle',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Always mounted, so a screen reader hears each new result (D-031). */}
      <div role="status" aria-live="polite">
        {notice ? (
          <Alert
            key={notice.id}
            // The region around it announces; its own default role="alert" would interrupt.
            role="none"
            variant={notice.type === 'error' ? 'destructive' : 'default'}
            className="relative rounded-2xl border-border/80 pr-16 shadow-xs"
          >
            <div className="flex flex-col gap-2">
              <AlertTitle className="font-semibold">{notice.title}</AlertTitle>
              <AlertDescription className="text-sm wrap-anywhere">
                {notice.message}
              </AlertDescription>
              {notice.paymentsLink ? (
                <Link
                  href="/admin/payments?status=refundable"
                  className="inline-flex min-h-12 min-w-12 items-center self-start rounded-xl border border-border/80 px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Retry refunds on Payments
                </Link>
              ) : null}
              {notice.reload ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={reload}
                  className="min-h-12 min-w-12 self-start rounded-xl font-semibold"
                >
                  Reload latest version
                </Button>
              ) : null}
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
      </div>

      {spaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-xs">
            <Inbox className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            {EMPTY[tab].title}
          </h2>
          <p className="mt-1.5 max-w-md text-sm font-medium text-muted-foreground">
            {EMPTY[tab].body}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={cn(
                'transition-all duration-300 ease-out motion-reduce:transition-none',
                removingId === space.id &&
                  'pointer-events-none -translate-x-3 scale-95 opacity-0 motion-reduce:transform-none',
              )}
            >
              <VerificationCard
                space={space}
                onAction={handleAction}
                onInspect={
                  space.status === 'pending' ? (s) => setInspectingSpace(s) : undefined
                }
                stale={stale.has(space.id)}
                onReload={reload}
              />
            </div>
          ))}
        </div>
      )}

      {/* Space Inspection Dossier Modal (Pending Spaces only) */}
      <SpaceInspectionDialog
        space={inspectingSpace}
        isOpen={!!inspectingSpace}
        onClose={() => setInspectingSpace(null)}
        onApprove={async (s) => {
          await handleAction(s, 'approve')
          setInspectingSpace(null)
        }}
        onReject={async (s) => {
          await handleAction(s, 'reject')
        }}
      />

      <VerificationReasonDialog
        space={reasonDialog?.space ?? null}
        mode={reasonDialog?.mode ?? 'rejected'}
        open={!!reasonDialog}
        onOpenChange={(open) => {
          if (!open) setReasonDialog(null)
        }}
        onConfirm={(space, reason) =>
          submit(
            space,
            reasonDialog?.mode === 'taken_down' ? 'take_down' : 'reject',
            reason,
          )
        }
        onReload={() => {
          setReasonDialog(null)
          reload()
        }}
      />

      <VerificationConfirmDialog
        space={confirmDialog?.space ?? null}
        mode={confirmDialog?.mode ?? 'undo'}
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null)
        }}
        onConfirm={(space) => submit(space, confirmDialog?.mode ?? 'undo')}
        onReload={() => {
          setConfirmDialog(null)
          reload()
        }}
      />
    </div>
  )
}
