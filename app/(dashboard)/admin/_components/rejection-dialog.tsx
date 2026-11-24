'use client'

import { useState } from 'react'
import { AlertCircle, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { VerificationCardItem } from './verification-card'

interface RejectionDialogProps {
  space: VerificationCardItem | null
  isOpen: boolean
  onClose: () => void
  onConfirmReject: (space: VerificationCardItem, reason: string) => Promise<void>
}

const REJECTION_REASONS = [
  'Invalid or crossing operating hours schedule format',
  'Physical address is not located near verified Cebu university hubs',
  'Incomplete seat map layout or zero bookable units configured',
  'Host contact information or venue description incomplete',
  'Duplicate venue listing or unverified business legitimacy',
]

/**
 * Actionable Rejection Feedback Picker Dialog (STORY-15, STORY-20).
 * Provides structured, actionable feedback to the host so they can fix their
 * venue listing and resubmit.
 */
export function RejectionDialog({
  space,
  isOpen,
  onClose,
  onConfirmReject,
}: RejectionDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>(
    REJECTION_REASONS[0] ?? 'Incomplete venue address',
  )
  const [customFeedback, setCustomFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !space) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!space) return
    setIsSubmitting(true)
    const finalReason = customFeedback.trim()
      ? `${selectedReason} — Note: ${customFeedback.trim()}`
      : selectedReason

    try {
      await onConfirmReject(space, finalReason)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rejection-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="animate-fade-in-up relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-destructive/30 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/70 bg-destructive/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-destructive-foreground flex size-10 items-center justify-center rounded-xl bg-destructive shadow-2xs">
              <XCircle className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="rejection-dialog-title"
                className="text-base font-bold text-foreground sm:text-lg"
              >
                Reject Venue Listing
              </h2>
              <p className="text-xs text-muted-foreground">
                Actionable feedback will be recorded for {space.name}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close rejection dialog"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4 px-6 py-5">
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              <span>Feedback Guide for Hosts</span>
            </div>
            <p className="mt-1">
              Select the primary standard that failed inspection. The host will be
              notified to correct this issue before resubmitting.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Select Primary Rejection Reason:
            </p>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/70 p-2.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="rejection-reason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="mt-0.5 size-4 accent-destructive"
                  />
                  <span className="font-medium">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-rejection-note"
              className="text-xs font-bold tracking-wider text-foreground/80 uppercase"
            >
              Additional Guidance for Host (Optional):
            </label>
            <textarea
              id="custom-rejection-note"
              rows={2}
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              placeholder="e.g. Please update closing hours to match building curfew..."
              className="w-full rounded-xl border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-destructive focus:ring-1 focus:ring-destructive focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[48px] min-w-[48px] rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-destructive-foreground min-h-[48px] min-w-[48px] rounded-xl bg-destructive px-4 text-xs font-semibold hover:bg-destructive/90"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Rejection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
