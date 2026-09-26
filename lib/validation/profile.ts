import { z } from 'zod'

/**
 * Zod validation schema for Seeker Profile updates (STORY-04).
 * Enforces validation rules on both client form and server action:
 * - full_name: required, trimmed, 1 to 100 characters.
 * - phone_number: optional string, trimmed, max 20 characters, phone symbol regex.
 */
export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  phone_number: z
    .string()
    .trim()
    .max(20, { message: 'Phone number must not exceed 20 characters' })
    .regex(/^[0-9+\-\s()]*$/, {
      message: 'Invalid phone number format',
    })
    .optional()
    .or(z.literal('')),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
