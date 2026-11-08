import { z } from 'zod'

/**
 * Zod validation schema for Space curated and custom tags mutations (STORY-08, FR-1.2, D-006).
 *
 * Enforces:
 * - Valid UUID for spaceId
 * - Curated tags array up to 20 valid IDs
 * - Custom tag names up to 10 items, 1-30 chars, no forbidden chars (`<`, `>`, `{`, `}`, `\`),
 *   and case-insensitive uniqueness across custom tag names.
 */
export const spaceTagsSchema = z.object({
  spaceId: z.string().uuid({ message: 'A valid Space ID is required' }),
  curatedTagIds: z
    .array(z.string().min(1).max(50))
    .max(20, 'A Space can have at most 20 curated tags'),
  customTagNames: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Tag name cannot be empty')
        .max(30, 'Tag name cannot exceed 30 characters')
        .regex(/^[^<>{}\\]+$/, 'Tag name contains invalid characters'),
    )
    .max(10, 'A Space can have at most 10 custom tags')
    .refine((tags) => new Set(tags.map((t) => t.toLowerCase())).size === tags.length, {
      message: 'Custom tag names must be unique (case-insensitive)',
    }),
})

export type SpaceTagsInput = z.infer<typeof spaceTagsSchema>
