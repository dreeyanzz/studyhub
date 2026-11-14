// How a hold's money, times and minutes left read on the Seeker's pages (STORY-09
// design §3, D-048, D-067). Pure: no React, no database. The booking token's groups
// come from STORY-10's lib/check-in/normalize.ts (formatToken), and the seconds left
// from its lib/check-in/countdown.ts, so the two stories show them the same way.
import { secondsRemaining } from '@/lib/check-in/countdown'

const pesoFormat = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "₱50.00" from 5000 centavos. Fees are whole centavos, so nothing is rounded (D-049). */
export function formatPeso(centavos: number): string {
  return pesoFormat.format(centavos / 100)
}

const manilaTimeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
})

/** "3:42 PM", in Asia/Manila whatever the server's or browser's zone (D-048). */
export function formatManilaTime(date: string | Date): string {
  return manilaTimeFormat.format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Whole minutes left until `deadline`, rounded up, so "1 min left" shows until the
 * very end and 0 only once it has passed. Uses STORY-10's secondsRemaining, which
 * rounds up and never goes below 0.
 */
export function minutesLeft(deadline: string | Date, now: Date = new Date()): number {
  return Math.ceil(secondsRemaining(deadline, now) / 60)
}

/**
 * What the countdown says aloud, or null to stay quiet (design §3, Accessibility):
 * only at 5 minutes, at 1 minute and at the lapse.
 */
export function countdownAnnouncement(minutes: number): string | null {
  if (minutes === 5) return '5 minutes left to pay.'
  if (minutes === 1) return '1 minute left to pay.'
  if (minutes <= 0) return 'Your payment window has run out.'
  return null
}
