import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpacePhotosPage from './page'

// Mock next/navigation
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock Supabase server client
const HOST_USER_ID = 'b0000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = 'b0000000-0000-4000-8000-000000000002'
const VALID_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'

let mockUser: { id: string } | null = { id: HOST_USER_ID }
let mockSpace: {
  id: string
  name: string
  status: 'verified' | 'pending' | 'rejected'
} | null = {
  id: VALID_SPACE_ID,
  name: 'Kapihan Study Hall',
  status: 'verified',
}
let mockStorageFiles: {
  name: string
  created_at: string
  metadata?: { size: number }
}[] = []

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
            mockSpace &&
            filters.id === mockSpace.id &&
            filters.host_id === HOST_USER_ID
          ) {
            return { data: mockSpace, error: null }
          }
          return { data: null, error: null }
        }),
      }
      return builder
    }),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(async () => ({ data: mockStorageFiles, error: null })),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/space-photos/${path}`,
          },
        })),
      })),
    },
  })),
}))

// Mock client supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: vi.fn(),
      })),
    },
  })),
}))

describe('SpacePhotosPage (STORY-11, TSK-11.2)', () => {
  beforeEach(() => {
    mockUser = { id: HOST_USER_ID }
    mockSpace = {
      id: VALID_SPACE_ID,
      name: 'Kapihan Study Hall',
      status: 'verified',
    }
    mockStorageFiles = []
    mockNotFound.mockClear()
    mockRedirect.mockClear()
  })

  it('redirects unauthenticated user to login', async () => {
    mockUser = null
    await expect(
      SpacePhotosPage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/login?returnUrl=%2Fhost')
  })

  it('returns notFound on malformed spaceId UUID', async () => {
    await expect(
      SpacePhotosPage({
        params: Promise.resolve({ spaceId: 'not-a-valid-uuid' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns notFound when caller is not the owning host', async () => {
    mockUser = { id: OTHER_USER_ID }
    await expect(
      SpacePhotosPage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders Space photos page with breadcrumb, space title, upload form, and empty photos state', async () => {
    const page = await SpacePhotosPage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({}),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Space Photos')
    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('Verified')
    expect(html).toContain('Back to Spaces')
    expect(html).toContain('Upload Space Photos')
    expect(html).toContain('No Space photos uploaded yet')
  })

  it('renders existing photos and confirmation panel when ?remove= is present', async () => {
    mockStorageFiles = [
      {
        name: '550e8400-e29b-41d4-a716-446655440000.jpg',
        created_at: '2026-11-01T10:00:00Z',
        metadata: { size: 1024 * 1024 },
      },
    ]

    const page = await SpacePhotosPage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({
        remove: '550e8400-e29b-41d4-a716-446655440000.jpg',
      }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Uploaded Photos (1)')
    expect(html).toContain('550e8400-e29b-41d4-a716-446655440000.jpg')
    expect(html).toContain('id="confirm"')
    expect(html).toContain('Remove this photo?')
    expect(html).toContain('Confirm removal')
  })
})
