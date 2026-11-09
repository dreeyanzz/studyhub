// STORY-11, TSK-11.1: Validation schemas for Space photo upload and deletion (D-010, D-063).

import { z } from 'zod'
import { spaceIdSchema } from '@/lib/validation/space'

export const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024 // 5 MB (D-063)
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const photoFileMetadataSchema = z.object({
  name: z
    .string({ error: 'File name is required' })
    .min(1, { error: 'File name is required' }),
  size: z
    .number({ error: 'File size is required' })
    .max(MAX_PHOTO_FILE_SIZE, { error: 'Photo must be 5 MB or smaller' }),
  type: z
    .string({ error: 'File type is required' })
    .refine((val) => (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(val), {
      error: 'Photo must be a JPEG, PNG, or WebP image',
    }),
})

export const uploadPhotosRequestSchema = z.object({
  spaceId: spaceIdSchema,
  files: z
    .array(photoFileMetadataSchema)
    .min(1, { error: 'Select at least one photo' })
    .max(10, { error: 'Maximum 10 photos per upload' }),
})

export const deletePhotoSchema = z.object({
  spaceId: spaceIdSchema,
  fileName: z
    .string({ error: 'File name is required' })
    .min(1, { error: 'File name is required' })
    .regex(/^[a-zA-Z0-9._-]+$/, { error: 'Invalid photo file name' })
    .refine((val) => !val.includes('..'), {
      error: 'Directory traversal is not allowed',
    }),
})

export type PhotoFileMetadata = z.infer<typeof photoFileMetadataSchema>
export type UploadPhotosRequest = z.infer<typeof uploadPhotosRequestSchema>
export type DeletePhotoInput = z.infer<typeof deletePhotoSchema>
