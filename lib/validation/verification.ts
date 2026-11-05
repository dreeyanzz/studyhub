import { z } from 'zod'

import { spaceIdSchema } from '@/lib/validation/space'

// STORY-15, TSK-15.2: Verification schema (D-053).
// Validates Space ID, target verification status ('verified' | 'rejected'),
// and the raw ISO timestamp string used for optimistic concurrency control.

export const spaceVerificationDecisionSchema = z.enum(['verified', 'rejected'], {
  error: 'Decision must be either verified or rejected',
})

export const verifySpaceSchema = z.object({
  spaceId: spaceIdSchema,
  status: spaceVerificationDecisionSchema,
  // Preserves exact ISO timestamp string without client conversion (D-053, design §7).
  // Rejects invalid strings such as "yesterday" or whitespace while preserving microseconds.
  updatedAt: z.iso.datetime({
    offset: true,
    error: 'Timestamp is required for verification',
  }),
})

export type VerifySpaceInput = z.infer<typeof verifySpaceSchema>
