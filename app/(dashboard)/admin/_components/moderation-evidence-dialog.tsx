'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  EyeOff,
  Flag,
  QrCode,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ReportedReviewItem {
  id: string
  spaceId: string
  spaceName: string
  spaceAddress: string
  seekerName: string
  seekerEmail: string
  rating: number
  reviewText: string
  submittedAt: string
  verifiedStay: boolean
  checkInTimestamp: string | null
  reportedBy: string
  reportReason: string
  reportTimestamp: string
  status: 'pending' | 'dismissed' | 'hidden' | 'removed'
}

interface ModerationEvidenceDialogProps {
  review: ReportedReviewItem | null
  isOpen: boolean
  onClose: () => void
  onAction: (reviewId: string, action: 'dismiss' | 'hide' | 'remove') => Promise<void>
}

/**
 * Verified Stay & Evidence Dossier Modal (STORY-14, FR-5.2).
 * Allows Administrators to inspect the reviewer's QR check-in timestamp proof,
 * review text, reported violation claim, and issue 1-click decisions.
 */
export function ModerationEvidenceDialog({
  review,
  isOpen,
  onClose,
  onAction,
}: ModerationEvidenceDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeAction, setActiveAction] = useState<'dismiss' | 'hide' | 'remove' | null>(
    null,
  )

  if (!isOpen || !review) return null

  async function handleDecision(action: 'dismiss' | 'hide' | 'remove') {
    if (!review) return
    setIsProcessing(true)
    setActiveAction(action)
    try {
      await onAction(review.id, action)
      onClose()
    } finally {
      setIsProcessing(false)
      setActiveAction(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="animate-fade-in-up relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/70 bg-muted/20 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-5.5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="moderation-dialog-title"
                  className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl"
                >
                  Review Moderation Dossier
                </h2>
                <Badge
                  variant="secondary"
                  className="rounded-full border border-amber-300/80 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  Flagged Item
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Target Venue:{' '}
                <strong className="font-semibold text-foreground">
                  {review.spaceName}
                </strong>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
          {/* Reporter Violation Claim */}
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                <Flag className="size-4" aria-hidden="true" />
                <span>Flagged Violation Claim</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Reported by {review.reportedBy}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed font-medium text-foreground">
              &ldquo;{review.reportReason}&rdquo;
            </p>
          </div>

          {/* Verified Stay Authenticity Proof */}
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <QrCode className="size-4 text-emerald-600" aria-hidden="true" />
                <span>Verified Stay Check-in Proof</span>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100/80 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                {review.verifiedStay ? 'Verified Seeker Check-in' : 'Unverified Stay'}
              </Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
              {review.verifiedStay ? (
                <span>
                  The seeker held a seat and successfully scanned the host QR code at{' '}
                  <strong className="font-semibold text-foreground">
                    {review.checkInTimestamp}
                  </strong>
                  . This review is backed by an authentic confirmed stay.
                </span>
              ) : (
                <span>
                  No physical QR check-in recorded for this reservation. The review may be
                  subject to closer scrutiny under community guidelines.
                </span>
              )}
            </p>
          </div>

          {/* The Review Content */}
          <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {review.seekerName.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{review.seekerName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {review.submittedAt}
                  </p>
                </div>
              </div>

              {/* Star Rating */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`size-3.5 ${
                      s <= review.rating
                        ? 'fill-amber-400 text-amber-500'
                        : 'fill-muted text-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-muted/25 p-3 text-xs leading-relaxed text-foreground italic">
              &ldquo;{review.reviewText}&rdquo;
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] gap-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted"
            onClick={() => handleDecision('dismiss')}
            disabled={isProcessing}
          >
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            <span>
              {isProcessing && activeAction === 'dismiss'
                ? 'Dismissing...'
                : 'Dismiss Report'}
            </span>
          </Button>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 rounded-xl border-amber-300 bg-amber-500/10 text-xs font-semibold text-amber-900 hover:bg-amber-500/20 dark:border-amber-700 dark:text-amber-200"
              onClick={() => handleDecision('hide')}
              disabled={isProcessing}
            >
              <EyeOff className="size-4" aria-hidden="true" />
              <span>
                {isProcessing && activeAction === 'hide' ? 'Hiding...' : 'Hide Review'}
              </span>
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] gap-2 rounded-xl text-xs font-semibold shadow-xs"
              onClick={() => handleDecision('remove')}
              disabled={isProcessing}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>
                {isProcessing && activeAction === 'remove'
                  ? 'Removing...'
                  : 'Remove Review'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
