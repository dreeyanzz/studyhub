import { z } from 'zod'

/**
 * Valid wait window lengths in minutes (STORY-09 design §2, D-067).
 * Must be 15 to 120 minutes in 15-minute increments.
 */
export const WAIT_WINDOW_MINUTES = [15, 30, 45, 60, 75, 90, 105, 120] as const

export type WaitWindowMinutes = (typeof WAIT_WINDOW_MINUTES)[number]

/**
 * Human-readable display label for wait windows (e.g. "15 min", "1 hr", "1 hr 15 min", "2 hr").
 */
export function formatWaitWindow(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours} hr`
  return `${hours} hr ${remainingMinutes} min`
}

/**
 * Form select options for wait windows.
 */
export const WAIT_WINDOW_OPTIONS: readonly {
  readonly value: WaitWindowMinutes
  readonly label: string
}[] = WAIT_WINDOW_MINUTES.map((m) => ({
  value: m,
  label: formatWaitWindow(m),
}))

/**
 * Parses PostgreSQL interval string or numeric minutes into whole minutes.
 * Handles formats:
 * - 'HH:MM:SS' or 'HH:MM' (e.g. '01:00:00' -> 60, '00:15:00' -> 15)
 * - Text formats (e.g. '60 minutes', '1 hour', '1 hr 15 min')
 * - ISO-8601 (e.g. 'PT1H', 'PT15M', 'PT1H30M')
 * - Number (returns as is)
 * Defaults to 60 if missing or invalid.
 */
export function parseIntervalToMinutes(
  interval: string | number | null | undefined,
): number {
  if (typeof interval === 'number') {
    return Number.isFinite(interval) && interval > 0 ? interval : 60
  }
  if (!interval || typeof interval !== 'string') return 60

  const trimmed = interval.trim()

  // Format: HH:MM:SS, HH:MM, or with fractional seconds HH:MM:SS.ffffff
  const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(trimmed)
  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    return hours * 60 + minutes
  }

  // Format: "X hour(s)" and/or "Y minute(s)" / "X hr" / "Y min"
  let totalMinutes = 0
  let matched = false

  const hoursMatch = /(\d+)\s*(?:hour|hr)s?/i.exec(trimmed)
  if (hoursMatch && hoursMatch[1]) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60
    matched = true
  }

  const minsMatch = /(\d+)\s*(?:minute|min)s?/i.exec(trimmed)
  if (minsMatch && minsMatch[1]) {
    totalMinutes += parseInt(minsMatch[1], 10)
    matched = true
  }

  if (matched) return totalMinutes

  // ISO 8601 duration: PT1H30M
  const isoMatch = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(trimmed)
  if (isoMatch && (isoMatch[1] || isoMatch[2])) {
    const h = parseInt(isoMatch[1] || '0', 10)
    const m = parseInt(isoMatch[2] || '0', 10)
    return h * 60 + m
  }

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric) && numeric > 0) return numeric

  return 60
}

/**
 * Validates a wait window in minutes: one of 15, 30, ..., 120, coerced from the form's string (design §2).
 */
export const waitWindowMinutesSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return undefined
    if (typeof val === 'string' && val.trim() !== '') return Number(val)
    return val
  },
  z
    .number({ error: 'Please choose a valid wait window.' })
    .refine(
      (val): val is WaitWindowMinutes =>
        WAIT_WINDOW_MINUTES.includes(val as WaitWindowMinutes),
      {
        message: 'Wait window must be between 15 and 120 minutes in 15-minute steps.',
      },
    ),
)

/**
 * Validation schema for holding a unit (STORY-09 design §2).
 */
export const holdUnitSchema = z.object({
  spaceId: z.uuid({ error: 'Invalid Space ID' }),
  unitId: z.uuid({ error: 'Invalid Unit ID' }),
  waitWindowMinutes: waitWindowMinutesSchema,
})

export type HoldUnitInput = z.infer<typeof holdUnitSchema>

/**
 * Validation schema for cancelling a hold (STORY-09 design §2).
 */
export const cancelHoldSchema = z.object({
  reservationId: z.uuid({ error: 'Invalid Reservation ID' }),
  expectedStatus: z.enum(['pending_payment', 'reserved'], {
    error: 'Expected status must be pending_payment or reserved',
  }),
})

export type CancelHoldInput = z.infer<typeof cancelHoldSchema>
