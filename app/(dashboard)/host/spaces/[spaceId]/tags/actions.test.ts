import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveSpaceTagsAction } from './actions'

// --- Next.js mocks ---
const mockRevalidatePath = vi.fn()
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

// --- Supabase mock ---
// Synthetic ids only (D-013).
const hostId = 'b0000000-0000-4000-8000-000000000001'
const spaceId = 'e0000000-0000-4000-8000-000000000001'

type Result = { data: unknown; error: { code?: string; message?: string } | null }

let mockUser: { id: string } | null
let responses: Record<string, Partial<Record<'select' | 'insert' | 'delete', Result>>>
let calls: {
  table: string
  op: 'select' | 'insert' | 'delete'
  values?: unknown
  filters: Record<string, unknown>
}[]

function builder(table: string) {
  const call: (typeof calls)[number] = { table, op: 'select', filters: {} }
  calls.push(call)
  const result = () =>
    responses[table]?.[call.op] ?? {
      data: call.op === 'select' ? [] : null,
      error: null,
    }
  const b: Record<string, unknown> = {
    select: vi.fn(() => b),
    insert: vi.fn((values: unknown) => {
      call.op = 'insert'
      call.values = values
      return b
    }),
    delete: vi.fn(() => {
      call.op = 'delete'
      return b
    }),
    eq: vi.fn((col: string, val: unknown) => {
      call.filters[col] = val
      return b
    }),
    in: vi.fn((col: string, val: unknown) => {
      call.filters[col] = val
      return b
    }),
    maybeSingle: vi.fn(async () => result()),
    then: (resolve: (value: unknown) => void) => resolve(result()),
  }
  return b
}

const mockSupabase = {
  auth: { getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })) },
  from: vi.fn((table: string) => builder(table)),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

const catalog = [
  { id: 'wifi_fast' },
  { id: 'wifi_basic' },
  { id: 'outlets_all' },
  { id: 'noise_quiet' },
]

function form({
  id = spaceId,
  curated = [] as string[],
  custom = [] as string[],
} = {}): FormData {
  const fd = new FormData()
  fd.set('spaceId', id)
  for (const tag of curated) fd.append('curatedTagIds', tag)
  for (const name of custom) fd.append('customTagNames', name)
  return fd
}

function writes(table: string, op: 'insert' | 'delete') {
  return calls.filter((call) => call.table === table && call.op === op)
}

describe('saveSpaceTagsAction (STORY-08, TSK-08.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: hostId }
    calls = []
    responses = {
      spaces: { select: { data: { id: spaceId }, error: null } },
      curated_tags: { select: { data: catalog, error: null } },
    }
  })

  it('inserts newly chosen curated and custom tags on the Host’s own Space', async () => {
    const res = await saveSpaceTagsAction(
      {},
      form({ curated: ['wifi_fast', 'outlets_all'], custom: ['Pet friendly'] }),
    )

    expect(res).toEqual({ success: true })
    expect(writes('space_curated_tags', 'insert')[0]?.values).toEqual([
      { space_id: spaceId, tag_id: 'wifi_fast' },
      { space_id: spaceId, tag_id: 'outlets_all' },
    ])
    expect(writes('space_custom_tags', 'insert')[0]?.values).toEqual([
      { space_id: spaceId, name: 'Pet friendly' },
    ])
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/host/spaces/${spaceId}/tags`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/spaces')
  })

  it('writes only the differences: removes unticked tags and adds new ones', async () => {
    responses.space_curated_tags = {
      select: {
        data: [{ tag_id: 'wifi_basic' }, { tag_id: 'outlets_all' }],
        error: null,
      },
    }
    responses.space_custom_tags = {
      select: {
        data: [
          { id: 'c1', name: 'Pet friendly' },
          { id: 'c2', name: 'Rooftop' },
        ],
        error: null,
      },
    }

    const res = await saveSpaceTagsAction(
      {},
      form({ curated: ['outlets_all', 'wifi_fast'], custom: ['Rooftop', 'Has parking'] }),
    )

    expect(res).toEqual({ success: true })
    const curatedDelete = writes('space_curated_tags', 'delete')
    expect(curatedDelete).toHaveLength(1)
    expect(curatedDelete[0]?.filters).toEqual({
      space_id: spaceId,
      tag_id: ['wifi_basic'],
    })
    expect(writes('space_curated_tags', 'insert')[0]?.values).toEqual([
      { space_id: spaceId, tag_id: 'wifi_fast' },
    ])
    expect(writes('space_custom_tags', 'delete')[0]?.filters).toEqual({
      space_id: spaceId,
      id: ['c1'],
    })
    expect(writes('space_custom_tags', 'insert')[0]?.values).toEqual([
      { space_id: spaceId, name: 'Has parking' },
    ])
  })

  it('deletes a custom tag before re-adding it with different capitals', async () => {
    responses.space_custom_tags = {
      select: { data: [{ id: 'c1', name: 'wifi lounge' }], error: null },
    }

    await saveSpaceTagsAction({}, form({ custom: ['WiFi Lounge'] }))

    const order = calls
      .filter((call) => call.table === 'space_custom_tags' && call.op !== 'select')
      .map((call) => call.op)
    expect(order).toEqual(['delete', 'insert'])
  })

  it('writes nothing when the submitted tags match what is saved', async () => {
    responses.space_curated_tags = {
      select: { data: [{ tag_id: 'wifi_fast' }], error: null },
    }
    responses.space_custom_tags = {
      select: { data: [{ id: 'c1', name: 'Rooftop' }], error: null },
    }

    const res = await saveSpaceTagsAction(
      {},
      form({ curated: ['wifi_fast'], custom: ['Rooftop'] }),
    )

    expect(res).toEqual({ success: true })
    expect(calls.filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('never writes to public.spaces, so Verification status is untouched (W4, D-027)', async () => {
    await saveSpaceTagsAction({}, form({ curated: ['wifi_fast'] }))

    expect(
      calls.filter((call) => call.table === 'spaces' && call.op !== 'select'),
    ).toEqual([])
  })

  // --- Negative cases: the wrong user, and forbidden writes ---

  it('refuses another Host’s Space with the generic message and writes nothing', async () => {
    responses.spaces = { select: { data: null, error: null } }

    const res = await saveSpaceTagsAction({}, form({ curated: ['wifi_fast'] }))

    expect(res.formError).toBe(
      'We could not save these tags. The Space may no longer exist or you may not have access.',
    )
    expect(calls.find((call) => call.table === 'spaces')?.filters).toEqual({
      id: spaceId,
      host_id: hostId,
    })
    expect(calls.filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('redirects a signed-out caller to sign in', async () => {
    mockUser = null

    await expect(saveSpaceTagsAction({}, form())).rejects.toThrow(
      'REDIRECT:/login?returnUrl=%2Fhost',
    )
    expect(calls.filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('refuses a malformed spaceId with the generic message', async () => {
    const res = await saveSpaceTagsAction({}, form({ id: 'not-a-uuid' }))

    expect(res.formError).toBe(
      'We could not save these tags. The Space may no longer exist or you may not have access.',
    )
    expect(calls).toHaveLength(0)
  })

  it('refuses a curated id that is not in the catalog, writing nothing', async () => {
    const res = await saveSpaceTagsAction(
      {},
      form({ curated: ['wifi_fast', 'free_coffee'] }),
    )

    expect(res.fieldErrors?.curatedTagIds).toEqual(['Choose only the amenities listed.'])
    expect(calls.filter((call) => call.op !== 'select')).toHaveLength(0)
  })

  it('refuses custom tags that repeat apart from capitals', async () => {
    const res = await saveSpaceTagsAction({}, form({ custom: ['Rooftop', 'rooftop'] }))

    expect(res.fieldErrors?.customTagNames).toEqual([
      'Custom tag names must be unique (case-insensitive)',
    ])
    expect(calls).toHaveLength(0)
  })

  it('refuses custom tags with markup characters', async () => {
    const res = await saveSpaceTagsAction({}, form({ custom: ['<script>'] }))

    expect(res.fieldErrors?.customTagNames).toBeDefined()
    expect(calls).toHaveLength(0)
  })

  it('refuses more than ten custom tags', async () => {
    const res = await saveSpaceTagsAction(
      {},
      form({ custom: Array.from({ length: 11 }, (_, i) => `Tag ${i + 1}`) }),
    )

    expect(res.fieldErrors?.customTagNames).toEqual([
      'A Space can have at most 10 custom tags',
    ])
  })

  it('maps a unique violation from a racing save to a field message', async () => {
    responses.space_custom_tags = {
      select: { data: [], error: null },
      insert: { data: null, error: { code: '23505' } },
    }

    const res = await saveSpaceTagsAction({}, form({ custom: ['Rooftop'] }))

    expect(res.fieldErrors?.customTagNames).toEqual([
      'Each custom tag must be different.',
    ])
    expect(res.success).toBeUndefined()
  })

  it('returns the generic save message when RLS refuses a write', async () => {
    responses.space_curated_tags = {
      select: { data: [], error: null },
      insert: { data: null, error: { code: '42501', message: 'permission denied' } },
    }

    const res = await saveSpaceTagsAction({}, form({ curated: ['wifi_fast'] }))

    expect(res).toEqual({ formError: 'We could not save these tags. Please try again.' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
