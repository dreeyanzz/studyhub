import { z } from 'zod'

import { spaceIdSchema } from '@/lib/validation/space'

// STORY-15, TSK-15.2: Verification schema (D-053).
// Validates Space ID, target verification status ('verified' | 'rejected'),
// and the raw ISO timestamp string used for optimistic concurrency control.

export const verifySpaceSchema = z.object({
  spaceId: spaceIdSchema,
  status: z.enum(['verified', 'rejected'], {
    error: 'Status must be verified or rejected',
  }),
  // Preserves exact ISO timestamp string without client conversion (D-053, design §7).
  updatedAt: z
    .string({ error: 'Timestamp is required' })
    .min(1, { error: 'Timestamp is required' }),
})

export type VerifySpaceInput = z.infer<typeof verifySpaceSchema>
