import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmPhotoRemoval } from './confirm-photo-removal'
import { PhotoGrid, type PhotoItem } from './photo-grid'
import { PhotoUploadForm } from './photo-upload-form'

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
    it('renders in-place confirmation panel with photo preview and form controls', () => {
      const fileName = '550e8400-e29b-41d4-a716-446655440000.jpg'
      const photoUrl =
        'https://example.supabase.co/storage/v1/object/public/space-photos/cover.jpg'

      const html = renderToStaticMarkup(
        <ConfirmPhotoRemoval spaceId={spaceId} fileName={fileName} photoUrl={photoUrl} />,
      )

      expect(html).toContain('id="confirm"')
      expect(html).toContain('Remove this photo?')
      expect(html).toContain('permanently removed from your Space')
      expect(html).toContain(`src="${photoUrl}"`)
      expect(html).toContain(fileName)
      expect(html).toContain(
        'name="spaceId" value="e0000000-0000-4000-8000-000000000001"',
      )
      expect(html).toContain(`name="fileName" value="${fileName}"`)
      expect(html).toContain('Confirm removal')
      expect(html).toContain(`href="/host/spaces/${spaceId}/photos"`)
      expect(html).toContain('Cancel')
    })
  })

  describe('PhotoGrid', () => {
    it('renders empty state when photos array is empty', () => {
      const html = renderToStaticMarkup(<PhotoGrid spaceId={spaceId} photos={[]} />)
      expect(html).toContain('No Space photos uploaded yet')
      expect(html).toContain('Add photos to showcase your study spots')
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

      const html = renderToStaticMarkup(<PhotoGrid spaceId={spaceId} photos={photos} />)

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
      expect(html).toContain('Delete photo<span class="sr-only"> (photo-1.jpg)</span>')
    })
  })

  describe('PhotoUploadForm', () => {
    it('renders upload instructions, file constraints, and browse trigger', () => {
      const html = renderToStaticMarkup(<PhotoUploadForm spaceId={spaceId} />)

      expect(html).toContain('Upload Space Photos')
      expect(html).toContain('Up to 5 MB per photo (JPEG, PNG, WebP)')
      expect(html).toContain('Maximum 10 photos per upload')
      expect(html).toContain('Browse photos')
      expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
      expect(html).toContain('JavaScript required')
    })
  })
})
