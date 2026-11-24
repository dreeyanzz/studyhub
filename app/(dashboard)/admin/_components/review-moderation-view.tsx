'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ModerationEvidenceDialog,
  type ReportedReviewItem,
} from './moderation-evidence-dialog'

/** Initial realistic reported reviews for QA & inspection */
const INITIAL_REPORTED_REVIEWS: ReportedReviewItem[] = [
  {
    id: 'rev-01',
    spaceId: 'e0000000-0000-4000-8000-000000000001',
    spaceName: 'Kapihan Study Hub',
    spaceAddress: '123 Cebu Tech Park, Cebu City',
    seekerName: 'Marco Valenzuela',
    seekerEmail: 'marco@example.test',
    rating: 1,
    reviewText:
      'The AC was dripping water directly onto my laptop desk and the host refused to move me to another seat even though there were empty pods.',
    submittedAt: 'Yesterday at 3:45 PM',
    verifiedStay: true,
    checkInTimestamp: 'Nov 22, 2026, 2:15 PM',
    reportedBy: 'Host (Hugo Santos)',
    reportReason:
      'Host claims customer sat in an unauthorized reserved meeting room and water drop was from spilled iced coffee, not air conditioning.',
    reportTimestamp: 'Today at 9:10 AM',
    status: 'pending',
  },
]

/**
 * Community Review Moderation portal view for Administrators (STORY-14, FR-5.2).
 * Displays flagged community reviews, verified stay dossier modal, and triage controls.
 */
export function ReviewModerationView() {
  const [reviews, setReviews] = useState<ReportedReviewItem[]>(INITIAL_REPORTED_REVIEWS)
  const [inspectingReview, setInspectingReview] = useState<ReportedReviewItem | null>(
    null,
  )
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
  } | null>(null)

  const pendingCount = reviews.filter((r) => r.status === 'pending').length

  async function handleModerationAction(
    reviewId: string,
    action: 'dismiss' | 'hide' | 'remove',
  ) {
    const target = reviews.find((r) => r.id === reviewId)
    if (!target) return

    setReviews((prev) => prev.filter((r) => r.id !== reviewId))

    const actionText =
      action === 'dismiss'
        ? 'Report dismissed. Review remains active on public space profile.'
        : action === 'hide'
          ? 'Review hidden from space profile. Ratings recalculating.'
          : 'Review permanently removed from audit log.'

    setNotice({
      type: 'success',
      title: `Moderation complete (${action})`,
      message: `${target.spaceName} review: ${actionText}`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Review Moderation
          </h1>
          <p className="mt-1 text-sm font-medium text-foreground/85">
            Inspect community reviews flagged by seekers or hosts for safety and platform
            guidelines compliance.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-xl border border-border/80 bg-secondary/80 px-3.5 py-1.5 text-sm font-bold text-foreground shadow-2xs"
        >
          {pendingCount} reported {pendingCount === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      {/* Professional Guidance Banner */}
      <div
        className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 shadow-2xs dark:border-amber-700/60"
        style={{ animationDelay: '40ms' }}
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-600 font-bold text-white shadow-2xs">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed text-foreground">
          <strong className="font-bold text-foreground">Moderation Guide:</strong> Hiding
          a review immediately removes it from the public venue profile and recalculates
          rating averages. Removing permanently deletes the text from public audit
          records.
        </div>
      </div>

      {/* Overview Metrics Bar */}
      <div
        className="animate-fade-in-up grid grid-cols-1 gap-3 sm:grid-cols-3"
        style={{ animationDelay: '80ms' }}
      >
        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-primary/40 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              Reported Reviews
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {pendingCount} Pending
            </p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/80 hover:shadow-md">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-100/90 text-sky-800 shadow-2xs ring-1 ring-sky-300/50 dark:bg-sky-950/70 dark:text-sky-300">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Quality Standard
            </p>
            <p className="text-sm font-bold text-foreground">Community Vetted</p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/80 hover:shadow-md">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-800 shadow-2xs ring-1 ring-amber-300/50 dark:bg-amber-950/70 dark:text-amber-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Resolution Target
            </p>
            <p className="text-sm font-bold text-foreground">&lt; 24 Hour Turnaround</p>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice ? (
        <Alert
          role="status"
          aria-live="polite"
          className="animate-fade-in relative rounded-2xl border-border/80 pr-12 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <AlertTitle className="font-semibold">{notice.title}</AlertTitle>
            <AlertDescription className="text-sm">{notice.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </Alert>
      ) : null}

      {/* Review Queue */}
      {reviews.length === 0 ? (
        <Card className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-xs">
            <CheckCircle2 className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            All caught up in Moderation!
          </h2>
          <p className="mt-1.5 max-w-md text-sm font-medium text-foreground/85">
            There are currently no flagged reviews requiring administrator attention.
            Flagged community reviews will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <Card
              key={rev.id}
              className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-lg font-bold text-foreground">
                      {rev.spaceName}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-[11px] font-semibold text-destructive"
                    >
                      Reported by {rev.reportedBy}
                    </Badge>
                    {rev.verifiedStay ? (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                      >
                        <QrCode className="size-3" />
                        <span>Verified Stay</span>
                      </Badge>
                    ) : null}
                  </div>

                  {/* Star Rating & Seeker info */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`size-3.5 ${
                            s <= rev.rating
                              ? 'fill-amber-400 text-amber-500'
                              : 'fill-muted text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      · by {rev.seekerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {rev.submittedAt}
                    </span>
                  </div>

                  <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground italic">
                    &ldquo;{rev.reviewText}&rdquo;
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInspectingReview(rev)}
                  className="min-h-[44px] shrink-0 gap-2 rounded-xl border-border/80 font-semibold hover:border-primary/60 hover:text-primary"
                >
                  <Eye className="size-4" />
                  <span>Inspect Evidence</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Verified Stay & Evidence Dossier Modal */}
      <ModerationEvidenceDialog
        review={inspectingReview}
        isOpen={!!inspectingReview}
        onClose={() => setInspectingReview(null)}
        onAction={handleModerationAction}
      />
    </div>
  )
}
