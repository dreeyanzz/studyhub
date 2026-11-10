import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmPhotoRemoval } from './confirm-photo-removal'
import { PhotoGrid, type PhotoItem } from './photo-grid'
import { PhotoUploadForm, uploadToSignedUrls } from './photo-upload-form'

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: vi.fn(),
      })),
    },
  })),
}))

describe('Host photo components (STORY-11, TSK-11.2)', () => {
  const spaceId = 'e0000000-0000-4000-8000-000000000001'

  describe('ConfirmPhotoRemoval', () => {
    const fileName = '550e8400-e29b-41d4-a716-446655440000.jpg'
    const photoUrl =
      'https://example.supabase.co/storage/v1/object/public/space-photos/cover.jpg'
    const html = renderToStaticMarkup(
      <ConfirmPhotoRemoval
        spaceId={spaceId}
        spaceName="Kapihan Study Hall"
        fileName={fileName}
        photoUrl={photoUrl}
        position={2}
        total={3}
      />,
    )

    it('renders in-place confirmation panel with photo preview and form controls', () => {
      expect(html).toContain('id="confirm"')
      expect(html).toContain('permanently removed from your Space')
      expect(html).toContain(`src="${photoUrl}"`)
      expect(html).toContain(
        'name="spaceId" value="e0000000-0000-4000-8000-000000000001"',
      )
      expect(html).toContain(`name="fileName" value="${fileName}"`)
      expect(html).toContain('Confirm removal')
      expect(html).toContain(`href="/host/spaces/${spaceId}/photos"`)
    })

    it('asks the question in a focusable heading that labels the panel (like STORY-07)', () => {
      expect(html).toContain('aria-labelledby="confirm-heading"')
      expect(html).toMatch(
        /<h2 id="confirm-heading" tabindex="-1"[^>]*>Remove this photo\?<\/h2>/,
      )
    })

    it('names the photo by its place, not its storage file name', () => {
      expect(html).toContain('alt="Kapihan Study Hall, 2 of 3"')
      expect(html).toContain('Photo 2 of 3')
      expect(html).not.toContain(`>${fileName}<`)
    })

    it('puts Cancel before the destructive button, like STORY-07', () => {
      expect(html.indexOf('Cancel')).toBeLessThan(html.indexOf('Confirm removal'))
    })
  })

  describe('PhotoGrid', () => {
    it('renders empty state when photos array is empty', () => {
      const html = renderToStaticMarkup(
        <PhotoGrid spaceId={spaceId} spaceName="Kapihan Study Hall" photos={[]} />,
      )
      expect(html).toContain('No Space photos uploaded yet')
      expect(html).toContain('Add photos to showcase your study spots')
      // The page has an h1, so the empty state's title is an h2 (no skipped level).
      expect(html).toMatch(/<h2[^>]*>No Space photos uploaded yet<\/h2>/)
    })

    it('renders photo cards with formatted size, timestamp, and delete links', () => {
      const photos: PhotoItem[] = [
        {
          name: 'photo-1.jpg',
          url: 'https://example.com/p1.jpg',
          sizeBytes: 1.5 * 1024 * 1024, // 1.5 MB
          createdAt: '2026-11-01T10:00:00Z',
        },
        {
          name: 'photo-2.png',
          url: 'https://example.com/p2.png',
          sizeBytes: 450 * 1024, // 450 KB
          createdAt: '2026-11-02T12:30:00Z',
        },
      ]

      const html = renderToStaticMarkup(
        <PhotoGrid spaceId={spaceId} spaceName="Kapihan Study Hall" photos={photos} />,
      )

      expect(html).toContain('Uploaded Photos (2)')
      expect(html).toContain('src="https://example.com/p1.jpg"')
      expect(html).toContain('src="https://example.com/p2.png"')
      expect(html).toContain('1.5 MB')
      expect(html).toContain('450.0 KB')
      expect(html).toContain(
        'href="/host/spaces/e0000000-0000-4000-8000-000000000001/photos?remove=photo-1.jpg#confirm"',
      )
      expect(html).toContain(
        'href="/host/spaces/e0000000-0000-4000-8000-000000000001/photos?remove=photo-2.png#confirm"',
      )
    })

    it('names each photo by Space and place (design §2/§3), never "venue" or a file name', () => {
      const photos: PhotoItem[] = [
        { name: 'a.jpg', url: 'https://example.com/a.jpg' },
        { name: 'b.jpg', url: 'https://example.com/b.jpg' },
      ]
      const html = renderToStaticMarkup(
        <PhotoGrid spaceId={spaceId} spaceName="Kapihan Study Hall" photos={photos} />,
      )

      expect(html).toContain('alt="Kapihan Study Hall, 1 of 2"')
      expect(html).toContain('alt="Kapihan Study Hall, 2 of 2"')
      expect(html).toContain('Delete photo<span class="sr-only"> 1 of 2</span>')
      expect(html).toContain('Delete photo<span class="sr-only"> 2 of 2</span>')
      expect(html.toLowerCase()).not.toContain('venue')
    })
  })

  describe('PhotoUploadForm', () => {
    const html = renderToStaticMarkup(<PhotoUploadForm spaceId={spaceId} />)

    it('renders upload instructions, file constraints, and browse trigger', () => {
      expect(html).toContain('Up to 5 MB per photo (JPEG, PNG, WebP)')
      expect(html).toContain('Maximum 10 photos per upload')
      expect(html).toContain('Browse photos')
      expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
      expect(html).toContain('JavaScript required')
      expect(html).toMatch(/<h2[^>]*>Upload Space Photos<\/h2>/)
    })

    it('keeps the hidden file input out of the tab order', () => {
      expect(html).toMatch(
        /<input[^>]*type="file"[^>]*tabindex="-1"[^>]*aria-hidden="true"/,
      )
    })
  })

  describe('uploadToSignedUrls', () => {
    const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
    const signed = (name: string) => ({
      fileName: name,
      path: `${spaceId}/${name}`,
      signedUrl: `https://example.test/${name}`,
      token: `token-${name}`,
    })

    it('uploads every file to its own signed path and reports progress', async () => {
      const upload = vi.fn(async () => ({ error: null }))
      const progress: number[] = []
      const files = [file('a.jpg'), file('b.jpg')]

      const outcome = await uploadToSignedUrls(
        files,
        [signed('1.jpg'), signed('2.jpg')],
        upload,
        (done) => progress.push(done),
      )

      expect(outcome).toEqual({ uploadedCount: 2, failed: [] })
      expect(upload).toHaveBeenNthCalledWith(
        1,
        `${spaceId}/1.jpg`,
        'token-1.jpg',
        files[0],
      )
      expect(upload).toHaveBeenNthCalledWith(
        2,
        `${spaceId}/2.jpg`,
        'token-2.jpg',
        files[1],
      )
      expect(progress).toEqual([1, 2])
    })

    it('keeps going after a failure and returns the failed files for a retry', async () => {
      const files = [file('a.jpg'), file('b.jpg'), file('c.jpg')]
      const upload = vi
        .fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'Payload too large' } })
        .mockRejectedValueOnce(new Error('Failed to fetch'))

      const outcome = await uploadToSignedUrls(
        files,
        [signed('1.jpg'), signed('2.jpg'), signed('3.jpg')],
        upload,
      )

      expect(outcome.uploadedCount).toBe(1)
      expect(outcome.failed).toEqual([
        { file: files[1], reason: 'Payload too large' },
        { file: files[2], reason: 'Failed to fetch' },
      ])
    })

    it('counts a file with no signed URL as failed instead of skipping it', async () => {
      const files = [file('a.jpg'), file('b.jpg')]
      const upload = vi.fn(async () => ({ error: null }))

      const outcome = await uploadToSignedUrls(files, [signed('1.jpg')], upload)

      expect(outcome.uploadedCount).toBe(1)
      expect(outcome.failed).toEqual([
        { file: files[1], reason: 'No upload link was prepared' },
      ])
      expect(upload).toHaveBeenCalledTimes(1)
    })
  })
})
