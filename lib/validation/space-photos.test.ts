import { describe, expect, it } from 'vitest'

import {
  ALLOWED_PHOTO_MIME_TYPES,
  deletePhotoSchema,
  MAX_PHOTO_FILE_SIZE,
  photoFileMetadataSchema,
  uploadPhotosRequestSchema,
} from './space-photos'

describe('photoFileMetadataSchema', () => {
  it('accepts valid JPEG, PNG, and WebP files <= 5 MB', () => {
    for (const type of ALLOWED_PHOTO_MIME_TYPES) {
      const result = photoFileMetadataSchema.safeParse({
        name: `photo.${type.split('/')[1]}`,
        size: MAX_PHOTO_FILE_SIZE,
        type,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects files larger than 5 MB (5,242,880 bytes, D-063)', () => {
    const result = photoFileMetadataSchema.safeParse({
      name: 'large.jpg',
      size: MAX_PHOTO_FILE_SIZE + 1,
      type: 'image/jpeg',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Photo must be 5 MB or smaller')
    }
  })

  it('rejects unsupported MIME types (e.g. gif, svg, pdf)', () => {
    const unsupported = ['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain']
    for (const type of unsupported) {
      const result = photoFileMetadataSchema.safeParse({
        name: 'test.file',
        size: 1024,
        type,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Photo must be a JPEG, PNG, or WebP image',
        )
      }
    }
  })

  it('rejects empty file names', () => {
    const result = photoFileMetadataSchema.safeParse({
      name: '',
      size: 1024,
      type: 'image/jpeg',
    })
    expect(result.success).toBe(false)
  })
})

describe('uploadPhotosRequestSchema', () => {
  const validSpaceId = '11111111-1111-4111-8111-111111111111'

  it('accepts a valid spaceId with 1 to 10 photos', () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      name: `img-${i}.jpg`,
      size: 500 * 1024,
      type: 'image/jpeg' as const,
    }))

    const result = uploadPhotosRequestSchema.safeParse({
      spaceId: validSpaceId,
      files,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty files array (min 1)', () => {
    const result = uploadPhotosRequestSchema.safeParse({
      spaceId: validSpaceId,
      files: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Select at least one photo')
    }
  })

  it('rejects more than 10 photos (max 10)', () => {
    const files = Array.from({ length: 11 }, (_, i) => ({
      name: `img-${i}.jpg`,
      size: 100 * 1024,
      type: 'image/jpeg' as const,
    }))

    const result = uploadPhotosRequestSchema.safeParse({
      spaceId: validSpaceId,
      files,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Maximum 10 photos per upload')
    }
  })

  it('rejects malformed spaceId UUID', () => {
    const result = uploadPhotosRequestSchema.safeParse({
      spaceId: 'not-a-uuid',
      files: [{ name: 'test.jpg', size: 1024, type: 'image/jpeg' }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('We could not find that Space.')
    }
  })
})

describe('deletePhotoSchema', () => {
  const validSpaceId = '11111111-1111-4111-8111-111111111111'

  it('accepts valid photo file names', () => {
    const validNames = [
      '550e8400-e29b-41d4-a716-446655440000.jpg',
      'cover_photo.webp',
      'space-123.png',
      'a.b.c.jpeg',
    ]

    for (const fileName of validNames) {
      const result = deletePhotoSchema.safeParse({
        spaceId: validSpaceId,
        fileName,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects directory traversal in fileName (..)', () => {
    const traversalNames = ['../secret.jpg', 'foo/../../bar.jpg', '..', 'sub/..']
    for (const fileName of traversalNames) {
      const result = deletePhotoSchema.safeParse({
        spaceId: validSpaceId,
        fileName,
      })
      expect(result.success).toBe(false)
    }
  })

  it('rejects file names with forbidden characters (slashes, spaces, control chars)', () => {
    const invalidNames = ['foo/bar.jpg', 'my photo.png', 'photo?.jpg', 'photo#1.webp']
    for (const fileName of invalidNames) {
      const result = deletePhotoSchema.safeParse({
        spaceId: validSpaceId,
        fileName,
      })
      expect(result.success).toBe(false)
    }
  })

  it('rejects malformed spaceId', () => {
    const result = deletePhotoSchema.safeParse({
      spaceId: 'invalid-id',
      fileName: 'valid.jpg',
    })
    expect(result.success).toBe(false)
  })
})
