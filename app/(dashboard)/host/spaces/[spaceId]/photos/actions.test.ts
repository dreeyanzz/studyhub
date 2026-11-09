import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPhotoUploadUrls, deletePhoto, revalidatePhotos } from './actions'

// --- Mock Next.js dependencies ---
const mockRevalidatePath = vi.fn()
const mockRedirect = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

// --- Mock Supabase setup ---
const HOST_USER_ID = 'b0000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = 'b0000000-0000-4000-8000-000000000002'
const VALID_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

let mockUser: { id: string } | null = { id: HOST_USER_ID }
let isSpaceOwned = true
let storageCreateSignedUrlError: { message: string } | null = null
let storageRemoveError: { message: string } | null = null
let capturedCreatedUrls: string[] = []
let capturedRemovedPaths: string[][] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn((table: string) => {
      if (table !== 'spaces') throw new Error(`Unexpected table ${table}`)
      const filters: Record<string, unknown> = {}
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          filters[col] = val
          return builder
        }),
        maybeSingle: vi.fn(async () => {
          if (
            isSpaceOwned &&
            filters.id === VALID_SPACE_ID &&
            filters.host_id === HOST_USER_ID
          ) {
            return { data: { id: VALID_SPACE_ID }, error: null }
          }
          return { data: null, error: null }
        }),
      }
      return builder
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== 'space-photos') throw new Error(`Unexpected bucket ${bucket}`)
        return {
          createSignedUploadUrl: vi.fn(async (path: string) => {
            capturedCreatedUrls.push(path)
            if (storageCreateSignedUrlError) {
              return { data: null, error: storageCreateSignedUrlError }
            }
            return {
              data: {
                signedUrl: `https://example.supabase.co/storage/v1/upload/sign/${path}?token=mock-token`,
                token: 'mock-token',
                path,
              },
              error: null,
            }
          }),
          remove: vi.fn(async (paths: string[]) => {
            capturedRemovedPaths.push(paths)
            if (storageRemoveError) {
              return { data: null, error: storageRemoveError }
            }
            return { data: paths.map((p) => ({ name: p })), error: null }
          }),
        }
      }),
    },
  })),
}))

describe('Host photo management Server Actions (STORY-11, TSK-11.2)', () => {
  beforeEach(() => {
    mockUser = { id: HOST_USER_ID }
    isSpaceOwned = true
    storageCreateSignedUrlError = null
    storageRemoveError = null
    capturedCreatedUrls = []
    capturedRemovedPaths = []
    mockRevalidatePath.mockClear()
    mockRedirect.mockClear()
  })

  describe('createPhotoUploadUrls', () => {
    it('rejects unauthenticated caller', async () => {
      mockUser = null
      const res = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [{ name: 'test.jpg', size: 1024, type: 'image/jpeg' }],
      })

      expect(res.success).toBe(false)
      expect(res.formError).toContain('signed in')
      expect(capturedCreatedUrls).toHaveLength(0)
    })

    it('rejects caller who does not own the Space', async () => {
      mockUser = { id: OTHER_USER_ID }
      isSpaceOwned = false
      const res = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [{ name: 'test.jpg', size: 1024, type: 'image/jpeg' }],
      })

      expect(res.success).toBe(false)
      expect(res.formError).toContain('do not have permission')
      expect(capturedCreatedUrls).toHaveLength(0)
    })

    it('rejects invalid metadata (empty files array, oversized file, invalid MIME)', async () => {
      const emptyRes = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [],
      })
      expect(emptyRes.success).toBe(false)
      expect(emptyRes.formError).toBe('Select at least one photo')

      const oversizedRes = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [{ name: 'huge.jpg', size: 6 * 1024 * 1024, type: 'image/jpeg' }],
      })
      expect(oversizedRes.success).toBe(false)
      expect(oversizedRes.formError).toContain('5 MB or smaller')

      const mimeRes = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [{ name: 'doc.pdf', size: 1024, type: 'application/pdf' }],
      })
      expect(mimeRes.success).toBe(false)
      expect(mimeRes.formError).toContain('JPEG, PNG, or WebP')
    })

    it('successfully creates signed upload URLs for valid photos with safe random paths', async () => {
      const res = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [
          { name: 'cover.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' },
          { name: 'room.png', size: 1 * 1024 * 1024, type: 'image/png' },
          { name: 'desk.webp', size: 500 * 1024, type: 'image/webp' },
        ],
      })

      expect(res.success).toBe(true)
      expect(res.data?.uploads).toHaveLength(3)

      expect(capturedCreatedUrls).toHaveLength(3)
      for (const upload of res.data!.uploads) {
        expect(upload.path).toMatch(
          new RegExp(`^${VALID_SPACE_ID}/[0-9a-f-]+\\.(jpg|png|webp)$`),
        )
        expect(upload.signedUrl).toContain('mock-token')
        expect(upload.token).toBe('mock-token')
      }
    })

    it('returns error if Supabase Storage fails to create a signed URL', async () => {
      storageCreateSignedUrlError = { message: 'Bucket quota exceeded' }
      const res = await createPhotoUploadUrls({
        spaceId: VALID_SPACE_ID,
        files: [{ name: 'test.jpg', size: 1024, type: 'image/jpeg' }],
      })

      expect(res.success).toBe(false)
      expect(res.formError).toContain('Bucket quota exceeded')
    })
  })

  describe('revalidatePhotos', () => {
    it('rejects invalid spaceId or unauthenticated caller', async () => {
      const invalidRes = await revalidatePhotos('not-a-uuid')
      expect(invalidRes.success).toBe(false)

      mockUser = null
      const unauthRes = await revalidatePhotos(VALID_SPACE_ID)
      expect(unauthRes.success).toBe(false)
      expect(unauthRes.formError).toContain('signed in')
    })

    it('rejects non-owner', async () => {
      mockUser = { id: OTHER_USER_ID }
      isSpaceOwned = false
      const res = await revalidatePhotos(VALID_SPACE_ID)
      expect(res.success).toBe(false)
      expect(res.formError).toContain('do not have permission')
    })

    it('revalidates host photos route and public space profile route for the owner', async () => {
      const res = await revalidatePhotos(VALID_SPACE_ID)
      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${VALID_SPACE_ID}/photos`,
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/spaces/${VALID_SPACE_ID}`)
    })
  })

  describe('deletePhoto', () => {
    const validFileName = '550e8400-e29b-41d4-a716-446655440000.jpg'

    it('rejects unauthenticated caller by redirecting to login', async () => {
      mockUser = null
      await deletePhoto({
        spaceId: VALID_SPACE_ID,
        fileName: validFileName,
      })
      expect(mockRedirect).toHaveBeenCalledWith('/login?returnUrl=%2Fhost')
    })

    it('rejects directory traversal in fileName', async () => {
      const res = await deletePhoto({
        spaceId: VALID_SPACE_ID,
        fileName: '..secret.jpg',
      })
      expect(res.success).toBe(false)
      expect(res.formError).toContain('Directory traversal')
      expect(capturedRemovedPaths).toHaveLength(0)
    })

    it('rejects non-owner', async () => {
      mockUser = { id: OTHER_USER_ID }
      isSpaceOwned = false
      const res = await deletePhoto({
        spaceId: VALID_SPACE_ID,
        fileName: validFileName,
      })
      expect(res.success).toBe(false)
      expect(res.formError).toContain('do not have permission')
      expect(capturedRemovedPaths).toHaveLength(0)
    })

    it('deletes photo from storage and revalidates paths when invoked programmatically', async () => {
      const res = await deletePhoto({
        spaceId: VALID_SPACE_ID,
        fileName: validFileName,
      })

      expect(res.success).toBe(true)
      expect(capturedRemovedPaths).toEqual([[`${VALID_SPACE_ID}/${validFileName}`]])
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${VALID_SPACE_ID}/photos`,
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/spaces/${VALID_SPACE_ID}`)
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('handles FormData submission and redirects back to photos page', async () => {
      const formData = new FormData()
      formData.set('spaceId', VALID_SPACE_ID)
      formData.set('fileName', validFileName)

      await deletePhoto(formData)

      expect(capturedRemovedPaths).toEqual([[`${VALID_SPACE_ID}/${validFileName}`]])
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${VALID_SPACE_ID}/photos`,
      )
      expect(mockRedirect).toHaveBeenCalledWith(`/host/spaces/${VALID_SPACE_ID}/photos`)
    })

    it('returns error if storage deletion fails', async () => {
      storageRemoveError = { message: 'Object not found in storage' }
      const res = await deletePhoto({
        spaceId: VALID_SPACE_ID,
        fileName: validFileName,
      })

      expect(res.success).toBe(false)
      expect(res.formError).toContain('Object not found in storage')
    })
  })
})
