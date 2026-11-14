/**
 * Wait-window countdown and time utilities for STORY-10 (FR-3.3).
 *
 * Pure functions — no React, no Supabase, no side effects.
 * Consumed by:
 *   - `wait-countdown.tsx`: live Seeker dashboard countdown
 *   - `unit-control-card.tsx` and `occupancy-list.tsx`: Host occupancy wait-window badges
 */

/**
 * Returns the number of whole seconds remaining until `deadline`.
 * Clamps to 0 — never returns a negative value.
 *
 * Rounds up, so it returns 0 only once the deadline has passed. The server ends
 * a wait window when `wait_window_ends_at <= now` (`private.record_lapses`), and
 * the Seeker's card reloads at zero (design §3): rounding down would show 00:00
 * and reload while the reservation is still Reserved.
 *
 * @param deadline - ISO string or Date representing the wait window end time.
 * @param now      - Reference time (defaults to `new Date()`). Inject in tests.
 */
export function secondsRemaining(
  deadline: Date | string,
  now: Date = new Date(),
): number {
  const deadlineMs =
    typeof deadline === 'string' ? new Date(deadline).getTime() : deadline.getTime()
  const diff = Math.ceil((deadlineMs - now.getTime()) / 1000)
  return Math.max(0, diff)
}

/**
 * Formats a non-negative seconds value as `MM:SS` for the live countdown timer.
 *
 * @example
 * formatCountdown(0)   // '00:00'
 * formatCountdown(125) // '02:05'
 * formatCountdown(900) // '15:00'
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/**
 * Formats a non-negative seconds value as a human-readable relative string
 * for the Host occupancy wait-window badge (FR-3.3).
 *
 * - 0–59 s  → `'< 1 min'`
 * - 60+ s   → `'X min left'`  (rounded up to the nearest minute)
 *
 * @example
 * formatRelative(55)   // '< 1 min'
 * formatRelative(60)   // '1 min left'
 * formatRelative(90)   // '2 min left'
 * formatRelative(3600) // '60 min left'
 */
export function formatRelative(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return '< 1 min'
  const mins = Math.ceil(s / 60)
  return `${mins} min left`
}

/**
 * The threshold a countdown tick passed, for the Seeker card's polite announcements
 * (STORY-10 design §3, Accessibility): the smallest of `thresholds` (seconds left)
 * with `previous > threshold >= next`, or null.
 *
 * Only passing a threshold counts. A card opened with 19 s left announces nothing until
 * the end, rather than "1 minute remaining", and a tab that slept past two thresholds
 * announces only the later one.
 *
 * @example
 * passedThreshold(61, 60, [600, 300, 60, 0]) // 60
 * passedThreshold(19, 18, [600, 300, 60, 0]) // null
 * passedThreshold(700, 250, [600, 300, 60, 0]) // 300
 */
export function passedThreshold(
  previous: number,
  next: number,
  thresholds: readonly number[],
): number | null {
  let passed: number | null = null
  for (const threshold of thresholds) {
    if (previous > threshold && next <= threshold) {
      if (passed === null || threshold < passed) passed = threshold
    }
  }
  return passed
}
