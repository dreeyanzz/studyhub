import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SpacePhotoGallery, type SpacePhoto } from './space-photo-gallery'

/** The class attribute of the element with this aria-label. */
function classOfLabelled(html: string, label: string): string {
  const tag = new RegExp(`<[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0]
  if (!tag) throw new Error(`no element with aria-label="${label}"`)
  return /class="([^"]*)"/.exec(tag)?.[1] ?? ''
}

describe('SpacePhotoGallery (STORY-11, TSK-11.4)', () => {
  const spaceName = 'Kapihan Study Hall'

  const mockPhotos: SpacePhoto[] = [
    {
      name: 'cover.jpg',
      url: 'https://example.supabase.co/storage/v1/object/public/space-photos/cover.jpg',
    },
    {
      name: 'interior.jpg',
      url: 'https://example.supabase.co/storage/v1/object/public/space-photos/interior.jpg',
    },
    {
      name: 'quiet-zone.jpg',
      url: 'https://example.supabase.co/storage/v1/object/public/space-photos/quiet-zone.jpg',
    },
  ]

  it('renders graceful fallback card when space has no uploaded photos', () => {
    const html = renderToStaticMarkup(
      <SpacePhotoGallery spaceName={spaceName} photos={[]} />,
    )

    expect(html).toContain('data-testid="space-photos-empty"')
    expect(html).toContain('No Space photos uploaded yet.')
    expect(html).toContain(
      'Photos of this Space will appear here once the Host uploads them.',
    )
    // No heading of its own: one would sit straight under the page's h1
    expect(html).not.toMatch(/<h[1-6]/)
    expect(html).not.toContain('role="region"')
    expect(html).not.toContain('aria-roledescription="carousel"')
  })

  it('renders cover photo and counter when a single photo is provided', () => {
    const html = renderToStaticMarkup(
      <SpacePhotoGallery spaceName={spaceName} photos={[mockPhotos[0]!]} />,
    )

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain(`aria-label="Photos of ${spaceName}"`)
    expect(html).toContain(`alt="Photo of ${spaceName} (1 of 1)"`)
    expect(html).toContain('1 / 1')

    // Single photo should not display prev/next buttons or thumbnail strip
    expect(html).not.toContain('aria-label="Previous slide"')
    expect(html).not.toContain('aria-label="Next slide"')
    expect(html).not.toContain('aria-label="Photo thumbnails"')
  })

  it('renders chronological hero photo, counter, navigation buttons, and thumbnails for multiple photos', () => {
    const html = renderToStaticMarkup(
      <SpacePhotoGallery spaceName={spaceName} photos={mockPhotos} />,
    )

    // Initial cover photo is the first photo chronologically (design §0, FR-1.3)
    expect(html).toContain(`alt="Photo of ${spaceName} (1 of 3)"`)
    expect(html).toContain('1 / 3')

    // Carousel navigation controls
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')

    // Each navigation button carries the 48x48 px minimums (D-031, SRS §3.2.2)
    for (const label of ['Previous slide', 'Next slide']) {
      const classes = classOfLabelled(html, label).split(/\s+/)
      expect(classes, label).toContain('min-h-12')
      expect(classes, label).toContain('min-w-12')
    }

    // Thumbnail strip
    expect(html).toContain('aria-label="Photo thumbnails"')
    expect(html).toContain('aria-label="Show photo 1 of 3"')
    expect(html).toContain('aria-label="Show photo 2 of 3"')
    expect(html).toContain('aria-label="Show photo 3 of 3"')
    expect(html).toContain('aria-current="true"')
  })

  it('declares accessible carousel semantics and live counter announcements', () => {
    const html = renderToStaticMarkup(
      <SpacePhotoGallery spaceName={spaceName} photos={mockPhotos} />,
    )

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-live="polite"')

    // The live counter is read once: "Slide 1 of 3", with the visible "1 / 3" hidden
    expect(html).toContain('<span aria-hidden="true">1 / 3</span>')
    expect(html).toContain('<span class="sr-only">Slide 1 of 3</span>')
  })
})
