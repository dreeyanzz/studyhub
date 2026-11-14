'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { CheckInResult } from '../actions'

type Tone = 'success' | 'warning' | 'danger'

interface ResultCopy {
  tone: Tone
  title: string
  body: string
  icon: typeof XCircle
}

/** The words for each outcome, C1 to C7 (STORY-10 design §3). */
function resultCopy(result: CheckInResult): ResultCopy {
  switch (result.outcome) {
    case 'success': {
      const location = result.zoneName
        ? `${result.unitLabel} (${result.zoneName})`
        : result.unitLabel
      return {
        tone: 'success',
        title: `Checked in unit ${location}`,
        body: 'Unit is now Occupied and recorded under this Space.',
        icon: CheckCircle2,
      }
    }
    case 'wait_window_lapsed':
      return {
        tone: 'warning',
        title: 'Wait window lapsed',
        body: 'Wait window lapsed. Unit has been released and reservation fee forfeited.',
        icon: Clock,
      }
    case 'token_already_used':
      return {
        tone: 'warning',
        title: 'Already checked in',
        body: 'This token was already checked in. Unit is currently Occupied.',
        icon: AlertTriangle,
      }
    case 'reservation_cancelled':
      return {
        tone: 'warning',
        title: 'Reservation cancelled',
        body: 'This reservation was cancelled.',
        icon: AlertTriangle,
      }
    case 'wrong_space':
      return {
        tone: 'danger',
        title: 'Wrong Space',
        body: 'This reservation is for a different Space. No changes were made.',
        icon: AlertTriangle,
      }
    case 'invalid_token':
      return {
        tone: 'danger',
        title: 'Invalid booking token',
        body: 'Invalid booking token. Please check the code.',
        icon: XCircle,
      }
    case 'forbidden':
      return {
        tone: 'danger',
        title: 'Access denied',
        body: 'Access denied. You must be signed in as the host of this Space.',
        icon: ShieldAlert,
      }
    case 'error':
      return {
        tone: 'danger',
        title: 'Check-in unavailable',
        body: 'We could not complete check-in right now. Please try again.',
        icon: XCircle,
      }
  }
}

const TONE_CLASSES: Record<Tone, { alert: string; icon?: string; description?: string }> =
  {
    success: {
      alert:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
      icon: 'text-emerald-700 dark:text-emerald-300',
      description: 'text-emerald-900 dark:text-emerald-200',
    },
    warning: {
      alert:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
      icon: 'text-amber-700 dark:text-amber-300',
      description: 'text-amber-900 dark:text-amber-200',
    },
    danger: { alert: 'border-destructive/60 bg-destructive/5' },
  }

interface CheckInResultBannerProps {
  spaceId: string
  result: CheckInResult | null
  /** Changes with every answer, so the same answer twice is announced twice. */
  answerKey?: number
}

/**
 * Accessible outcome banner for C1–C7 check-in results (STORY-10 design §3, C1–C7).
 * Conveys every result in explicit text and iconography, never color alone (D-031).
 *
 * Screen readers hear the answer from two live regions that are on the page before
 * any answer: one added together with its text is often skipped, and that was the
 * success banner's case. A success is polite; a refusal interrupts. The visible banner
 * has no live role of its own, so nothing is read twice.
 */
export function CheckInResultBanner({
  spaceId,
  result,
  answerKey = 0,
}: CheckInResultBannerProps) {
  const copy = result ? resultCopy(result) : null
  const spoken = copy
    ? copy.body.startsWith(copy.title)
      ? copy.body
      : `${copy.title}. ${copy.body}`
    : ''
  const classes = copy ? TONE_CLASSES[copy.tone] : null
  const Icon = copy?.icon

  return (
    <>
      <p role="status" className="sr-only">
        {copy?.tone === 'success' ? <span key={answerKey}>{spoken}</span> : null}
      </p>
      <p role="alert" className="sr-only">
        {copy && copy.tone !== 'success' ? <span key={answerKey}>{spoken}</span> : null}
      </p>

      {copy && classes && Icon ? (
        <Alert
          key={answerKey}
          // The Alert primitive defaults to role="alert"; the regions above speak.
          role={undefined}
          variant={copy.tone === 'danger' ? 'destructive' : 'default'}
          className={classes.alert}
        >
          <Icon className={classes.icon} aria-hidden="true" />
          <AlertTitle className="text-base font-semibold">{copy.title}</AlertTitle>
          <AlertDescription
            className={cn(
              'mt-1',
              copy.tone === 'success' && 'flex flex-col gap-3',
              classes.description,
            )}
          >
            {copy.tone === 'success' ? (
              <>
                <span>{copy.body}</span>
                <div>
                  <Link
                    href={`/host/spaces/${spaceId}/occupancy`}
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'h-auto min-h-12 max-w-full border-emerald-400 bg-background/80 px-4 py-2 text-center whitespace-normal text-foreground hover:bg-background',
                    )}
                  >
                    View occupancy seat map
                  </Link>
                </div>
              </>
            ) : (
              copy.body
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
