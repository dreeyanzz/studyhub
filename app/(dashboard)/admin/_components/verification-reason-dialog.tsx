'use client'

import { useId, useState, type FormEvent } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'

import type { SetSpaceStatusResult } from '@/app/(dashboard)/admin/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SPACE_STATUS_REASON_MAX_LENGTH,
  spaceStatusReasonSchema,
} from '@/lib/validation/verification'
import type { VerificationCardItem } from './verification-card'

/** Reject (V3) or Take down (V7): the two moves that need a reason (N10). */
export type ReasonMode = 'rejected' | 'taken_down'

const COPY = {
  rejected: {
    title: 'Reject Space',
    confirm: 'Confirm rejection',
    pending: 'Rejecting...',
    warning:
      'Unstarted holds (Pending Payment and Reserved) will be cancelled and paid sandbox fees refunded. Visits under way keep running.',
  },
  taken_down: {
    title: 'Take down Space',
    confirm: 'Take down Space',
    pending: 'Taking down...',
    warning:
      'Taking this Space down hides it from Seekers at once. Unstarted holds (Pending Payment and Reserved) are cancelled and paid sandbox fees are refunded automatically; visits under way keep running.',
  },
} as const

/** The hold warning shows for every take-down, and for rejecting an Edited Space. */
export function showsHoldWarning(mode: ReasonMode, space: VerificationCardItem): boolean {
  return mode === 'taken_down' || space.origin === 'edited'
}

export interface VerificationReasonFormProps {
  space: VerificationCardItem
  mode: ReasonMode
  onConfirm: (
    space: VerificationCardItem,
    reason: string,
  ) => Promise<SetSpaceStatusResult>
  onDone: () => void
  onCancel: () => void
  /** Loads the latest version after a stale_version or invalid_transition refusal. */
  onReload?: () => void
}

/**
 * The form inside `VerificationReasonDialog` (STORY-20 design §3, screen 1, N10, D-084):
 * a required reason of 1 to 500 characters after trimming, with a live counter, and the
 * hold warning when the move cancels holds. Exported so Vitest can drive it without a
 * portal.
 */
export function VerificationReasonForm({
  space,
  mode,
  onConfirm,
  onDone,
  onCancel,
  onReload,
}: VerificationReasonFormProps) {
  const id = useId()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const copy = COPY[mode]

  const reasonId = `${id}-verification-reason`
  const countId = `${id}-reason-count`
  const errorId = `${id}-reason-error`
  const warningId = `${id}-hold-warning`
  const remaining = Math.max(0, SPACE_STATUS_REASON_MAX_LENGTH - reason.trim().length)
  const warns = showsHoldWarning(mode, space)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = spaceStatusReasonSchema.safeParse(reason)
    if (!parsed.success) {
      setReasonError(
        parsed.error.issues[0]?.message ?? 'Enter a reason before continuing.',
      )
      return
    }

    setReasonError(null)
    setFormError(null)
    setNeedsReload(false)
    setIsPending(true)
    try {
      const result = await onConfirm(space, parsed.data)
      if (result.success) {
        onDone()
        return
      }
      if (result.fieldErrors?.reason) setReasonError(result.fieldErrors.reason)
      else setFormError(result.error)
      setNeedsReload(Boolean(result.reload))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {warns ? (
        <Alert id={warningId}>
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{copy.warning}</AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription className="space-y-3">
            <p>{formError}</p>
            {needsReload && onReload ? (
              <Button
                type="button"
                variant="outline"
                onClick={onReload}
                className="h-auto min-h-12 min-w-12 py-2 whitespace-normal"
              >
                Reload latest version
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
          Reason
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={4}
          required
          maxLength={SPACE_STATUS_REASON_MAX_LENGTH}
          value={reason}
          disabled={isPending}
          onChange={(event) => {
            setReason(event.target.value)
            if (reasonError) setReasonError(null)
          }}
          aria-describedby={reasonError ? `${countId} ${errorId}` : countId}
          aria-invalid={reasonError ? 'true' : undefined}
          placeholder={
            mode === 'rejected'
              ? 'Tell the Host what to fix before they resubmit.'
              : 'Tell the Host why the Space was taken down.'
          }
          className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={countId} className="text-xs text-muted-foreground">
            {remaining} / {SPACE_STATUS_REASON_MAX_LENGTH} characters remaining
          </p>
          {reasonError ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {reasonError}
            </p>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending}
          aria-busy={isPending}
          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
        >
          {isPending ? copy.pending : copy.confirm}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface VerificationReasonDialogProps {
  space: VerificationCardItem | null
  mode: ReasonMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: VerificationReasonFormProps['onConfirm']
  onReload?: () => void
}

/**
 * Focus-trapped modal on `components/ui/dialog.tsx` asking for the reason of a
 * rejection (V3) or take-down (V7) before `public.set_space_status` runs (STORY-20 design
 * §3, N10). Escape or "Cancel" closes it, and focus returns to the button that opened it.
 */
export function VerificationReasonDialog({
  space,
  mode,
  open,
  onOpenChange,
  onConfirm,
  onReload,
}: VerificationReasonDialogProps) {
  return (
    <Dialog open={open && Boolean(space)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {COPY[mode].title} — {space?.name}
          </DialogTitle>
          <DialogDescription>
            This needs a reason. Only the Space&apos;s Host and Administrators can read
            it.
          </DialogDescription>
        </DialogHeader>

        {open && space ? (
          <VerificationReasonForm
            key={`${space.id}-${mode}`}
            space={space}
            mode={mode}
            onConfirm={onConfirm}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
            onReload={onReload}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
