'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PencilLine, Star } from 'lucide-react'

import {
  editReviewAction,
  postReviewAction,
} from '@/app/(public)/spaces/[spaceId]/actions'
import { ReviewForm, type ReviewFormValues } from '@/components/review/review-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type ReviewDialogProps =
  | {
      mode: 'create'
      spaceId: string
      spaceName: string
      reservationId: string
    }
  | {
      mode: 'edit'
      spaceId: string
      spaceName: string
      reviewId: string
      initialValues: ReviewFormValues
    }

/**
 * Leave a review and Edit your review from the reservation history
 * (STORY-16 design §3 Screen 4, TSK-16.4, RV1/RV2, D-081).
 *
 * Reuses STORY-13's `ReviewForm` and its Server Actions inside the shared focus-trapped
 * `Dialog`. On success it closes, refreshes the history so the row reads "Reviewed",
 * and announces the outcome in an `aria-live="polite"` region. Escape or Cancel closes
 * it, and Radix returns focus to the trigger button.
 *
 * HistoryRow keeps this component in the same place in both modes, so the
 * announcement survives the refresh that turns "Leave a review" into "Edit your review".
 */
export function ReviewDialog(props: ReviewDialogProps) {
  const { mode, spaceId, spaceName } = props
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const triggerLabel = mode === 'create' ? 'Leave a review' : 'Edit your review'
  const title = `${triggerLabel} — ${spaceName}`
  const testIdSuffix = props.mode === 'create' ? props.reservationId : props.reviewId

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        data-testid="review-live-status"
        className="sr-only"
      >
        {announcement}
      </span>

      <Button
        type="button"
        variant="outline"
        data-testid={`${mode === 'create' ? 'leave-review' : 'edit-review'}-${testIdSuffix}`}
        onClick={() => {
          setAnnouncement('')
          setOpen(true)
        }}
        className="h-auto min-h-12 min-w-12 rounded-full px-4 py-2 whitespace-normal"
      >
        {mode === 'create' ? (
          <Star className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <PencilLine className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>{triggerLabel}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/80 bg-card shadow-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Rate your visit so other Seekers know what to expect.'
                : 'Change your ratings or comment, then save.'}
            </DialogDescription>
          </DialogHeader>

          {open && (
            <ReviewForm
              mode={mode}
              action={mode === 'create' ? postReviewAction : editReviewAction}
              spaceId={spaceId}
              reservationId={props.mode === 'create' ? props.reservationId : undefined}
              reviewId={props.mode === 'edit' ? props.reviewId : undefined}
              initialValues={props.mode === 'edit' ? props.initialValues : undefined}
              onCancel={() => setOpen(false)}
              onSuccess={(message) => {
                setOpen(false)
                setAnnouncement(message)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
