'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { CheckInResult } from '../actions'

interface CheckInResultBannerProps {
  spaceId: string
  result: CheckInResult | null
}

/**
 * Accessible outcome banner for C1–C7 check-in results (STORY-10 design §3, C1–C7).
 * Conveys every result in explicit text and iconography, never color alone (D-031).
 */
export function CheckInResultBanner({ spaceId, result }: CheckInResultBannerProps) {
  if (!result) return null

  if (result.outcome === 'success') {
    const location = result.zoneName
      ? `${result.unitLabel} (${result.zoneName})`
      : result.unitLabel
    return (
      <Alert
        role="status"
        aria-live="polite"
        className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
      >
        <CheckCircle2
          className="text-emerald-700 dark:text-emerald-300"
          aria-hidden="true"
        />
        <AlertTitle className="text-base font-semibold">
          Checked in unit {location}
        </AlertTitle>
        <AlertDescription className="mt-1 flex flex-col gap-3 text-emerald-900 dark:text-emerald-200">
          <span>Unit is now Occupied and recorded under this Space.</span>
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
        </AlertDescription>
      </Alert>
    )
  }

  if (
    result.outcome === 'wait_window_lapsed' ||
    result.outcome === 'token_already_used' ||
    result.outcome === 'reservation_cancelled'
  ) {
    const title =
      result.outcome === 'wait_window_lapsed'
        ? 'Wait window lapsed'
        : result.outcome === 'token_already_used'
          ? 'Already checked in'
          : 'Reservation cancelled'

    const body =
      result.outcome === 'wait_window_lapsed'
        ? 'Wait window lapsed. Unit has been released and reservation fee forfeited.'
        : result.outcome === 'token_already_used'
          ? 'This token was already checked in. Unit is currently Occupied.'
          : 'This reservation was cancelled.'

    const Icon = result.outcome === 'wait_window_lapsed' ? Clock : AlertTriangle

    return (
      <Alert
        role="alert"
        aria-live="assertive"
        className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <Icon className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <AlertTitle className="text-base font-semibold">{title}</AlertTitle>
        <AlertDescription className="mt-1 text-amber-900 dark:text-amber-200">
          {body}
        </AlertDescription>
      </Alert>
    )
  }

  const destructiveCopy: Record<
    'wrong_space' | 'invalid_token' | 'forbidden' | 'error',
    { title: string; body: string; icon: typeof XCircle }
  > = {
    wrong_space: {
      title: 'Wrong Space',
      body: 'This reservation is for a different Space. No changes were made.',
      icon: AlertTriangle,
    },
    invalid_token: {
      title: 'Invalid booking token',
      body: 'Invalid booking token. Please check the code.',
      icon: XCircle,
    },
    forbidden: {
      title: 'Access denied',
      body: 'Access denied. You must be signed in as the host of this Space.',
      icon: ShieldAlert,
    },
    error: {
      title: 'Check-in unavailable',
      body: 'We could not complete check-in right now. Please try again.',
      icon: XCircle,
    },
  }

  const copy = destructiveCopy[result.outcome]
  const DestructiveIcon = copy.icon

  return (
    <Alert
      variant="destructive"
      role="alert"
      aria-live="assertive"
      className="border-destructive/60 bg-destructive/5"
    >
      <DestructiveIcon aria-hidden="true" />
      <AlertTitle className="text-base font-semibold">{copy.title}</AlertTitle>
      <AlertDescription className="mt-1">{copy.body}</AlertDescription>
    </Alert>
  )
}
