import { z } from 'zod'

/**
 * Zod validation schema for Seeker Profile updates (STORY-04).
 * Enforces validation rules on both client form and server action:
 * - full_name: required, trimmed, 1 to 100 characters.
 * - phone_number: optional string, trimmed, max 20 characters, phone symbol regex.
 *   An empty value passes as '', and updateProfile() saves it as null (TSK-04.4).
 * The limits match the check constraints on public.profiles (STORY-01).
 */
export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must be 100 characters or fewer' }),
  phone_number: z
    .string()
    .trim()
    .max(20, { message: 'Phone number must be 20 characters or fewer' })
    .regex(/^[0-9+\-\s()]*$/, {
      message: 'Invalid phone number format',
    })
    .optional(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
