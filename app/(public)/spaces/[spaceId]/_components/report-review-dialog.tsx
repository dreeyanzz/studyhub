'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { AlertCircle, Flag } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import {
  REVIEW_REPORT_NOTE_MAX_LENGTH,
  REVIEW_REPORT_REASON_LABELS,
  REVIEW_REPORT_REASONS,
  type ReportReviewActionState,
  type ReviewReportReason,
} from '@/lib/validation/review'
import { reportReviewAction } from '../actions'

const INITIAL_REPORT_STATE: ReportReviewActionState = {
  status: 'idle',
  message: null,
}

export interface ReportReviewFormProps {
  spaceId: string
  reviewId: string
  action?: (
    prevState: ReportReviewActionState,
    formData: FormData,
  ) => Promise<ReportReviewActionState>
  onSuccess: (message: string) => void
  onCancel: () => void
  idPrefix?: string
}

/**
 * Form rendered inside `ReportReviewDialog` (STORY-13 design §3 Screen 3, TSK-13.5, FR-4.2, D-080).
 * Exported so unit tests can inspect the radio options, counter, and buttons directly.
 */
export function ReportReviewForm({
  spaceId,
  reviewId,
  action = reportReviewAction,
  onSuccess,
  onCancel,
  idPrefix,
}: ReportReviewFormProps) {
  const reactId = useId()
  const prefix = idPrefix ?? reactId

  const [reason, setReason] = useState<ReviewReportReason | null>(null)
  const [note, setNote] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (prevState: ReportReviewActionState, formData: FormData) => {
      const next = await action(prevState, formData)
      if (next.status === 'success') {
        onSuccess(next.message ?? 'Report submitted.')
      }
      return next
    },
    INITIAL_REPORT_STATE,
  )

  const remainingChars = Math.max(0, REVIEW_REPORT_NOTE_MAX_LENGTH - note.length)
  const noteId = `${prefix}-note`
  const noteCountId = `${prefix}-note-count`
  const reasonErrorId = `${prefix}-reason-error`

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="reviewId" value={reviewId} />

      {state.status === 'error' && state.message && (
        <Alert
          variant="destructive"
          role="alert"
          data-testid="report-form-error"
          className="rounded-2xl border-destructive/30 shadow-xs"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <fieldset
        className="space-y-2"
        aria-describedby={state.fieldErrors?.reason ? reasonErrorId : undefined}
      >
        <legend className="text-sm font-medium text-foreground">Reason</legend>
        <div className="space-y-2">
          {REVIEW_REPORT_REASONS.map((option) => {
            const isSelected = reason === option
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-12 w-full min-w-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors select-none',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground shadow-2xs'
                    : 'border-border/80 bg-background text-foreground hover:border-primary/40 hover:bg-muted/60',
                  isPending && 'pointer-events-none opacity-50',
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={isSelected}
                  required
                  disabled={isPending}
                  onChange={() => setReason(option)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span>{REVIEW_REPORT_REASON_LABELS[option]}</span>
              </label>
            )
          })}
        </div>
        {state.fieldErrors?.reason && (
          <p id={reasonErrorId} className="text-sm text-destructive">
            {state.fieldErrors.reason}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor={noteId}
          className="block px-1 text-sm font-medium text-foreground"
        >
          Note (optional)
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={3}
          maxLength={REVIEW_REPORT_NOTE_MAX_LENGTH}
          value={note}
          disabled={isPending}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby={noteCountId}
          aria-invalid={state.fieldErrors?.note ? 'true' : undefined}
          placeholder="Add any detail that helps an Administrator review this."
          className="min-h-24 w-full rounded-2xl border border-input bg-muted/60 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p id={noteCountId} className="text-xs text-muted-foreground">
            {remainingChars} / {REVIEW_REPORT_NOTE_MAX_LENGTH} characters remaining
          </p>
          {state.fieldErrors?.note && (
            <p className="text-sm text-destructive">{state.fieldErrors.note}</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="h-auto min-h-12 rounded-full px-5 py-2 whitespace-normal"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="h-auto min-h-12 rounded-full px-5 py-2 font-semibold whitespace-normal"
        >
          {isPending ? 'Submitting...' : 'Submit report'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface ReportReviewDialogProps {
  spaceId: string
  reviewId: string
  reportedByCaller: boolean
}

/**
 * Report control + focus-trapped modal for another user's visible review
 * (STORY-13 design §3 Screen 3, TSK-13.5, RP1, FR-4.2, D-080).
 *
 * Shows a "Report" button until the caller reports the review's current version, then
 * switches to "You reported this" and announces "Report submitted." in `aria-live="polite"`.
 */
export function ReportReviewDialog({
  spaceId,
  reviewId,
  reportedByCaller,
}: ReportReviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const reportedBadgeRef = useRef<HTMLSpanElement | null>(null)

  const isReported = reportedByCaller || hasReported

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        data-testid={`report-live-status-${reviewId}`}
        className="sr-only"
      >
        {announcement ?? ''}
      </span>

      {isReported ? (
        <span
          ref={reportedBadgeRef}
          tabIndex={-1}
          data-testid={`review-reported-${reviewId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Flag className="size-3.5 shrink-0" aria-hidden="true" />
          <span>You reported this</span>
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          data-testid={`report-review-trigger-${reviewId}`}
          onClick={() => setOpen(true)}
          className="h-auto min-h-12 rounded-full px-4 py-2 whitespace-normal"
        >
          <Flag className="size-4 shrink-0" aria-hidden="true" />
          <span>Report</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border-border/80 bg-card shadow-2xl">
          <DialogHeader>
            <DialogTitle>Report review</DialogTitle>
            <DialogDescription>
              Tell our Administrators why this review should be checked.
            </DialogDescription>
          </DialogHeader>

          {open && (
            <ReportReviewForm
              spaceId={spaceId}
              reviewId={reviewId}
              onCancel={() => setOpen(false)}
              onSuccess={(message) => {
                setHasReported(true)
                setOpen(false)
                setAnnouncement(message)
                requestAnimationFrame(() => {
                  reportedBadgeRef.current?.focus()
                })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
