'use client'

import { useId, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'

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

export interface RejectReasonFormProps {
  space: VerificationCardItem
  onConfirm: (
    space: VerificationCardItem,
    reason: string,
  ) => Promise<SetSpaceStatusResult>
  onDone: () => void
  onCancel: () => void
}

/**
 * The form inside `VerificationReasonDialog` in its Reject mode (STORY-20 design §3,
 * screen 1, N10, D-084): a required reason of 1 to 500 characters after trimming, with a
 * live counter. Exported so Vitest can drive it without a portal. TSK-20.3 adds the Take
 * down mode and the warning for an edited Space.
 */
export function RejectReasonForm({
  space,
  onConfirm,
  onDone,
  onCancel,
}: RejectReasonFormProps) {
  const id = useId()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const reasonId = `${id}-verification-reason`
  const countId = `${id}-reason-count`
  const errorId = `${id}-reason-error`
  const remaining = Math.max(0, SPACE_STATUS_REASON_MAX_LENGTH - reason.trim().length)

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
    setIsPending(true)
    try {
      const result = await onConfirm(space, parsed.data)
      if (result.success) {
        onDone()
        return
      }
      if (result.fieldErrors?.reason) setReasonError(result.fieldErrors.reason)
      else setFormError(result.error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
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
          placeholder="Tell the Host what to fix before they resubmit."
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
          {isPending ? 'Rejecting...' : 'Confirm rejection'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface VerificationReasonDialogProps {
  space: VerificationCardItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: RejectReasonFormProps['onConfirm']
}

/**
 * Focus-trapped modal on `components/ui/dialog.tsx` asking for a rejection's reason
 * before `public.set_space_status` runs (STORY-20 design §3, N10). Escape or "Cancel"
 * closes it, and focus returns to the button that opened it.
 */
export function VerificationReasonDialog({
  space,
  open,
  onOpenChange,
  onConfirm,
}: VerificationReasonDialogProps) {
  return (
    <Dialog open={open && Boolean(space)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            Reject Space — {space?.name}
          </DialogTitle>
          <DialogDescription>
            A rejection needs a reason. Only the Space&apos;s Host and Administrators can
            read it.
          </DialogDescription>
        </DialogHeader>

        {open && space ? (
          <RejectReasonForm
            key={space.id}
            space={space}
            onConfirm={onConfirm}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
