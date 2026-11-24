import { z } from 'zod'

/**
 * Zod schemas for the Seeker reservation history page (STORY-16 design §2 & §3).
 * Controls how many past reservations are shown: in steps of 20 up to 100.
 * Anything else falls back to 20.
 */

export const HISTORY_SHOW_COUNTS = [20, 40, 60, 80, 100] as const
export type HistoryShowCount = (typeof HISTORY_SHOW_COUNTS)[number]

export const DEFAULT_HISTORY_SHOW_COUNT: HistoryShowCount = 20
export const MAX_HISTORY_SHOW_COUNT: HistoryShowCount = 100

function firstParam(val: unknown): unknown {
  return Array.isArray(val) ? val[0] : val
}

export const historyPageSchema = z.object({
  show: z
    .preprocess(
      (val) => {
        const first = firstParam(val)
        if (typeof first === 'number') return first
        if (typeof first === 'string' && /^\d+$/.test(first.trim())) {
          return Number(first.trim())
        }
        return first
      },
      z
        .number()
        .refine((n): n is HistoryShowCount =>
          HISTORY_SHOW_COUNTS.includes(n as HistoryShowCount),
        ),
    )
    .catch(DEFAULT_HISTORY_SHOW_COUNT),
})

export type HistoryPageParams = z.infer<typeof historyPageSchema>
