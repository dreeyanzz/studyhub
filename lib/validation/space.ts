import { z } from 'zod'

// 24-hour HH:mm from 00:00 to 23:59, the value an HTML time input submits. Seconds,
// single-digit hours and impossible times such as 24:00 or 12:60 fail.
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

// An empty value gets only the "required" message; anything else must be a real time.
function timeOfDay(required: string, invalid: string) {
  return z
    .string({ error: required })
    .min(1, { error: required, abort: true })
    .regex(timePattern, { error: invalid })
}

/**
 * The Space form rules (STORY-05 design §2.3), checked in the browser and again in
 * createSpace and updateSpace. The limits match the check constraints on
 * public.spaces (STORY-01).
 *
 * There is deliberately no rule that closing comes after opening: a closing time
 * earlier than the opening time means the Space closes after midnight, and equal
 * times mean it is open 24 hours (D-027).
 *
 * An empty description stays '' so form fields keep string values; the Server
 * Actions store it as null.
 */
export const spaceSchema = z.object({
  name: z
    .string({ error: 'Space name is required' })
    .trim()
    .min(1, { error: 'Space name is required' })
    .max(100, { error: 'Space name must be 100 characters or fewer' }),
  description: z
    .string()
    .trim()
    .max(2000, { error: 'Description must be 2,000 characters or fewer' })
    .default(''),
  address: z
    .string({ error: 'Address is required' })
    .trim()
    .min(1, { error: 'Address is required' })
    .max(200, { error: 'Address must be 200 characters or fewer' }),
  opensAt: timeOfDay('Opening time is required', 'Enter a valid opening time'),
  closesAt: timeOfDay('Closing time is required', 'Enter a valid closing time'),
})

export type SpaceInput = z.infer<typeof spaceSchema>
export type SpaceField = keyof SpaceInput

// The hidden spaceId on the edit and delete forms (STORY-05 design §2.4). It stays
// out of spaceSchema, so create can never accept an id and field errors only name
// visible fields.
export const spaceIdSchema = z.uuid({ error: 'We could not find that Space.' })
