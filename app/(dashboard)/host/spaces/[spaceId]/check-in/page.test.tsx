import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HostCheckInPage from './page'

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
  checkInAction: vi.fn(),
}))

const HOST_USER_ID = 'b0000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = 'b0000000-0000-4000-8000-000000000002'
const VALID_SPACE_ID = 'e0000000-0000-4000-8000-000000000002'

let mockUser: { id: string } | null = { id: HOST_USER_ID }
let mockSpace: { id: string; name: string } | null = {
  id: VALID_SPACE_ID,
  name: 'Kapihan Study Hall',
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn((table: string) => {
      if (table !== 'spaces') throw new Error(`Unexpected table ${table}`)
      const filters: Record<string, unknown> = {}
      const builder: Record<string, unknown> = {
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
  })),
}))

function makeProps(spaceId: string) {
  return {
    params: Promise.resolve({ spaceId }),
    searchParams: Promise.resolve({}),
  } as Parameters<typeof HostCheckInPage>[0]
}

describe('HostCheckInPage (STORY-10, TSK-10.4, D-060)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: HOST_USER_ID }
    mockSpace = { id: VALID_SPACE_ID, name: 'Kapihan Study Hall' }
  })

  it('redirects unauthenticated callers to login', async () => {
    mockUser = null
    await expect(HostCheckInPage(makeProps(VALID_SPACE_ID))).rejects.toThrow(
      'NEXT_REDIRECT:/login?returnUrl=%2Fhost',
    )
  })

  it('returns notFound for malformed spaceId without hitting the database', async () => {
    await expect(HostCheckInPage(makeProps('not-a-uuid'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })

  it('returns notFound when caller does not own the Space (C7)', async () => {
    mockUser = { id: OTHER_USER_ID }
    await expect(HostCheckInPage(makeProps(VALID_SPACE_ID))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })

  it('renders Check-in desk header, occupancy link, and CheckInShell for the owning Host', async () => {
    const element = await HostCheckInPage(makeProps(VALID_SPACE_ID))
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Kapihan Study Hall Check-in desk')
    expect(html).toContain(`href="/host/spaces/${VALID_SPACE_ID}/occupancy"`)
    expect(html).toContain('href="/host"')
    expect(html).toContain('Verify booking at Kapihan Study Hall')
    expect(html).toContain('ABCD-EFGH-JKMN')
  })
})
