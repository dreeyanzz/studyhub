import { z } from 'zod'

/**
 * Zod schemas for booking token check-in and check-out validation (STORY-10, D-059).
 *
 * Token format: 12-character Crockford base32 string.
 * Valid Crockford base32 alphabet: 0-9 A-H J K M N P-T V-Z (excludes I, L, O, U).
 *
 * Preprocessing normalizes raw user input before the regex check:
 * 1. Drop non-alphanumeric characters (spaces, hyphens, dashes, dots).
 * 2. Uppercase.
 * 3. Map ambiguous chars: O/o → 0, I/i/L/l → 1.
 */

const CROCKFORD_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/

/**
 * Validates and normalizes a raw booking token string.
 * Accepts grouped input like `ABCD-EFGH-JKMN` and returns the canonical
 * 12-character normalized form `ABCDEFGHJKMN`.
 */
export const bookingTokenSchema = z
  .string()
  .min(1, 'Please enter a booking token')
  .transform((val) => val.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())
  .transform((val) => val.replace(/O/g, '0').replace(/[IL]/g, '1'))
  .pipe(
    z
      .string()
      .regex(
        CROCKFORD_RE,
        'Booking token must be 12 characters from the Crockford base32 alphabet',
      ),
  )

/**
 * Validates the input for `checkInAction(spaceId, token)`.
 */
export const checkInSchema = z.object({
  spaceId: z.uuid({ error: 'Invalid Space ID' }),
  token: bookingTokenSchema,
})

/**
 * Validates the input for `checkOutAction(reservationId)`.
 */
export const checkOutSchema = z.object({
  reservationId: z.uuid({ error: 'Invalid reservation ID' }),
})

export type CheckInInput = z.input<typeof checkInSchema>
export type CheckInData = z.infer<typeof checkInSchema>
export type CheckOutInput = z.input<typeof checkOutSchema>
export type CheckOutData = z.infer<typeof checkOutSchema>
