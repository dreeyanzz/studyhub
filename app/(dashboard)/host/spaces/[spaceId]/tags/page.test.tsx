import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpaceTagsPage from './page'

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('./actions', () => ({
  saveSpaceTagsAction: vi.fn(async () => ({})),
}))

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
  status: 'pending',
}
let mockCatalogError = false

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {}
      const getResult = () => {
        if (table === 'spaces') {
          if (
            mockSpace &&
            filters.id === mockSpace.id &&
            filters.host_id === HOST_USER_ID
          ) {
            return { data: mockSpace, error: null }
          }
          return { data: null, error: null }
        }
        if (table === 'curated_tags') {
          if (mockCatalogError) return { data: null, error: { message: 'db error' } }
          return {
            data: [
              {
                id: 'wifi_fast',
                category: 'wifi',
                label: 'Wi-Fi: Fast (50+ Mbps)',
                description: 'High-speed internet',
              },
            ],
            error: null,
          }
        }
        if (table === 'space_curated_tags') {
          return { data: [{ tag_id: 'wifi_fast' }], error: null }
        }
        if (table === 'space_custom_tags') {
          return { data: [{ name: 'Pet friendly' }], error: null }
        }
        throw new Error(`Unexpected table ${table}`)
      }
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          filters[col] = val
          return builder
        }),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => getResult()),
        then: (resolve: (val: unknown) => void) => resolve(getResult()),
      }
      return builder
    }),
  })),
}))

describe('SpaceTagsPage (STORY-08, TSK-08.5)', () => {
  beforeEach(() => {
    mockUser = { id: HOST_USER_ID }
    mockSpace = {
      id: VALID_SPACE_ID,
      name: 'Kapihan Study Hall',
      status: 'pending',
    }
    mockCatalogError = false
    mockNotFound.mockClear()
    mockRedirect.mockClear()
  })

  it('redirects an unauthenticated visitor to sign in', async () => {
    mockUser = null
    await expect(
      SpaceTagsPage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/login?returnUrl=%2Fhost')
  })

  it('returns notFound on a malformed spaceId UUID', async () => {
    await expect(
      SpaceTagsPage({
        params: Promise.resolve({ spaceId: 'not-a-valid-uuid' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns notFound when the caller is not the owning Host', async () => {
    mockUser = { id: OTHER_USER_ID }
    await expect(
      SpaceTagsPage({
        params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders breadcrumbs, status badge, and TagForm for the owning Host', async () => {
    const page = await SpaceTagsPage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({}),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Amenities &amp; Tags')
    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('Pending verification')
    expect(html).toContain('Back to Spaces')
    expect(html).toContain('Wi-Fi: Fast (50+ Mbps)')
    expect(html).toContain('Pet friendly')
  })

  it('shows a generic error alert if loading tags fails', async () => {
    mockCatalogError = true
    const page = await SpaceTagsPage({
      params: Promise.resolve({ spaceId: VALID_SPACE_ID }),
      searchParams: Promise.resolve({}),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain(
      'We could not load this Space&#x27;s tags. Refresh the page to try again.',
    )
    expect(html).not.toContain('db error')
  })
})
