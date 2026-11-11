import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpace, deleteSpace, updateSpace } from './actions'

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
let mockUser: { id: string } | null = {
  id: 'b0000000-0000-4000-8000-000000000001',
}

type QueryResult = {
  data: unknown
  error: { code?: string; message?: string; hint?: string } | null
}

let tableResponses: Record<string, QueryResult | ((op: string) => QueryResult)> = {}
let capturedInserts: { table: string; values: unknown }[] = []
let capturedUpdates: {
  table: string
  values: unknown
  filters: Record<string, unknown>
}[] = []
let capturedDeletes: { table: string; filters: Record<string, unknown> }[] = []

let mockRpcResponse: {
  data: unknown
  error: { code?: string; message?: string; hint?: string } | null
} = {
  data: [],
  error: null,
}
let capturedRpcCalls: { fn: string; args: unknown }[] = []

let storageFiles: { name: string }[] = []
let storageListError: unknown = null
let storageRemoveError: unknown = null
let capturedStorageRemoves: string[][] = []

function createMockQueryBuilder(table: string) {
  const filters: Record<string, unknown> = {}
  let lastOp = 'select'

  const getResponse = () => {
    const resp = tableResponses[table]
    if (typeof resp === 'function') return resp(lastOp)
    return resp ?? { data: { id: 'mock-space-id' }, error: null }
  }

  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn((values: unknown) => {
      lastOp = 'insert'
      capturedInserts.push({ table, values })
      return builder
    }),
    update: vi.fn((values: unknown) => {
      lastOp = 'update'
      capturedUpdates.push({ table, values, filters })
      return builder
    }),
    delete: vi.fn(() => {
      lastOp = 'delete'
      capturedDeletes.push({ table, filters })
      return builder
    }),
    eq: vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return builder
    }),
    single: vi.fn(async () => getResponse()),
    maybeSingle: vi.fn(async () => getResponse()),
    then: (resolve: (val: unknown) => void) => {
      resolve(getResponse())
    },
  }

  return builder
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: mockUser },
      error: null,
    })),
  },
  from: vi.fn((table: string) => createMockQueryBuilder(table)),
  rpc: vi.fn(async (fn: string, args: unknown) => {
    capturedRpcCalls.push({ fn, args })
    return mockRpcResponse
  }),
  storage: {
    from: vi.fn((_bucket: string) => ({
      list: vi.fn(async () => {
        if (storageListError) return { data: null, error: storageListError }
        // Return files and then empty on second list call to end the loop
        const currentFiles = [...storageFiles]
        storageFiles = []
        return { data: currentFiles, error: null }
      }),
      remove: vi.fn(async (paths: string[]) => {
        capturedStorageRemoves.push(paths)
        if (storageRemoveError) return { data: null, error: storageRemoveError }
        return { data: paths.map((p) => ({ name: p })), error: null }
      }),
    })),
  },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

const validSpaceId = 'e0000000-0000-4000-8000-000000000001'

function createValidSpaceFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.append('name', 'Kapihan Study Hall')
  fd.append('address', '123 Test Street, Cebu City')
  fd.append('description', 'A cozy study hall with fast Wi-Fi.')
  fd.append('opensAt', '08:00')
  fd.append('closesAt', '22:00')
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v)
  }
  return fd
}

describe('Host Space Actions (STORY-05, STORY-09 TSK-09.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'b0000000-0000-4000-8000-000000000001' }
    tableResponses = {}
    capturedInserts = []
    capturedUpdates = []
    capturedDeletes = []
    mockRpcResponse = { data: [], error: null }
    capturedRpcCalls = []
    storageFiles = []
    storageListError = null
    storageRemoveError = null
    capturedStorageRemoves = []

    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ---------------------------------------------------------------------------
  // createSpace
  // ---------------------------------------------------------------------------
  describe('createSpace', () => {
    it('creates space with default max_wait_window (60 minutes) when omitted', async () => {
      const fd = createValidSpaceFormData()

      await expect(createSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=created')
      expect(capturedInserts).toContainEqual(
        expect.objectContaining({
          table: 'spaces',
          values: expect.objectContaining({
            name: 'Kapihan Study Hall',
            max_wait_window: '60 minutes',
          }),
        }),
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith('/host')
    })

    it('creates space with explicit max_wait_window (e.g. 30 minutes)', async () => {
      const fd = createValidSpaceFormData({ maxWaitWindowMinutes: '30' })

      await expect(createSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=created')
      expect(capturedInserts).toContainEqual(
        expect.objectContaining({
          table: 'spaces',
          values: expect.objectContaining({
            max_wait_window: '30 minutes',
          }),
        }),
      )
    })

    it('rejects invalid wait window with field error', async () => {
      const fd = createValidSpaceFormData({ maxWaitWindowMinutes: '50' })

      const res = await createSpace({}, fd)
      expect(res.fieldErrors?.maxWaitWindowMinutes).toBeDefined()
      expect(capturedInserts).toHaveLength(0)
    })

    it('stores the map pin and price tier (STORY-08, TSK-08.5)', async () => {
      const fd = createValidSpaceFormData({
        latitude: '10.3157',
        longitude: '123.8854',
        priceTier: 'standard',
      })

      await expect(createSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=created')
      expect(capturedInserts[0]?.values).toEqual(
        expect.objectContaining({
          latitude: 10.3157,
          longitude: 123.8854,
          price_tier: 'standard',
        }),
      )
    })

    it('stores no pin as nulls and defaults the tier to budget (STORY-08, TSK-08.5)', async () => {
      const fd = createValidSpaceFormData({ latitude: '', longitude: '' })

      await expect(createSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=created')
      expect(capturedInserts[0]?.values).toEqual(
        expect.objectContaining({
          latitude: null,
          longitude: null,
          price_tier: 'budget',
        }),
      )
    })

    it('refuses a half pin and keeps what the Host typed (STORY-08, TSK-08.5)', async () => {
      const fd = createValidSpaceFormData({ latitude: '10.3157', priceTier: 'free' })

      const res = await createSpace({}, fd)
      expect(res.fieldErrors?.longitude).toEqual([
        'Enter the longitude too, or clear the latitude',
      ])
      expect(res.values).toEqual(
        expect.objectContaining({
          latitude: '10.3157',
          longitude: '',
          priceTier: 'free',
        }),
      )
      expect(capturedInserts).toHaveLength(0)
    })

    it('never sends status or host_id, even when the form carries them', async () => {
      const fd = createValidSpaceFormData({ status: 'verified', host_id: 'someone-else' })

      await expect(createSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=created')
      const values = capturedInserts[0]?.values as Record<string, unknown>
      expect(values).not.toHaveProperty('status')
      expect(values).not.toHaveProperty('host_id')
    })

    it('returns formError when database insert fails', async () => {
      tableResponses.spaces = {
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      }
      const fd = createValidSpaceFormData()

      const res = await createSpace({}, fd)
      expect(res.formError).toBe('We could not create this Space. Please try again.')
    })
  })

  // ---------------------------------------------------------------------------
  // updateSpace
  // ---------------------------------------------------------------------------
  describe('updateSpace', () => {
    it('updates space with max_wait_window successfully', async () => {
      const fd = createValidSpaceFormData({
        spaceId: validSpaceId,
        maxWaitWindowMinutes: '45',
      })

      await expect(updateSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=updated')
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'spaces',
          values: expect.objectContaining({
            max_wait_window: '45 minutes',
          }),
        }),
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith('/host')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/spaces')
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/spaces/${validSpaceId}`)
    })

    it('clears a saved pin when both coordinates are emptied (STORY-08, TSK-08.5)', async () => {
      const fd = createValidSpaceFormData({
        spaceId: validSpaceId,
        latitude: '',
        longitude: '',
        priceTier: 'premium',
      })

      await expect(updateSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=updated')
      expect(capturedUpdates[0]?.values).toEqual(
        expect.objectContaining({
          latitude: null,
          longitude: null,
          price_tier: 'premium',
        }),
      )
      expect(capturedUpdates[0]?.values).not.toHaveProperty('status')
    })

    it('returns friendly refusal error when hours cut into active hold (N22)', async () => {
      tableResponses.spaces = {
        data: null,
        error: { code: 'P0001', hint: 'hours_cut_hold' },
      }
      const fd = createValidSpaceFormData({
        spaceId: validSpaceId,
        closesAt: '18:00',
      })

      const res = await updateSpace({}, fd)
      expect(res.formError).toBe(
        "A Seeker's hold runs past these hours. Change them after it ends.",
      )
    })

    it('returns generic error when space update fails for other reasons', async () => {
      tableResponses.spaces = {
        data: null,
        error: { code: '42501', message: 'Unauthorized' },
      }
      const fd = createValidSpaceFormData({ spaceId: validSpaceId })

      const res = await updateSpace({}, fd)
      expect(res.formError).toBe(
        'We could not save this Space. It may no longer exist or you may not have access.',
      )
    })
  })

  // ---------------------------------------------------------------------------
  // deleteSpace
  // ---------------------------------------------------------------------------
  describe('deleteSpace', () => {
    it('refuses deletion and preserves photos when unit_states reports an active hold (N17 pre-check)', async () => {
      storageFiles = [{ name: 'photo1.jpg' }]
      mockRpcResponse = {
        data: [
          {
            unit_id: 'f0000000-0000-4000-8000-000000000001',
            seat_state: 'reserved',
            reservation_id: 'a0000000-0000-4000-8000-000000000001',
          },
        ],
        error: null,
      }

      const fd = new FormData()
      fd.append('spaceId', validSpaceId)

      const res = await deleteSpace({}, fd)
      expect(res.formError).toBe(
        'A unit here has an active hold. End it from the occupancy view, or wait for it to end.',
      )
      // Must NOT have removed photos
      expect(capturedStorageRemoves).toHaveLength(0)
      // Must NOT have deleted space row
      expect(capturedDeletes).toHaveLength(0)
    })

    it('refuses deletion when database delete trigger raises unit_held (N17 race condition)', async () => {
      // unit_states check passes (no hold during pre-check)
      mockRpcResponse = { data: [], error: null }
      tableResponses.spaces = (op) => {
        if (op === 'delete') {
          return { data: null, error: { code: 'P0001', hint: 'unit_held' } }
        }
        return { data: { id: validSpaceId }, error: null }
      }

      const fd = new FormData()
      fd.append('spaceId', validSpaceId)

      const res = await deleteSpace({}, fd)
      expect(res.formError).toBe(
        'A unit here has an active hold. End it from the occupancy view, or wait for it to end.',
      )
    })

    it('empties photos and deletes space row when no holds exist', async () => {
      mockRpcResponse = { data: [], error: null }
      storageFiles = [{ name: 'photo1.jpg' }, { name: 'photo2.jpg' }]

      const fd = new FormData()
      fd.append('spaceId', validSpaceId)

      await expect(deleteSpace({}, fd)).rejects.toThrow('REDIRECT:/host?notice=deleted')
      expect(capturedStorageRemoves).toContainEqual([
        `${validSpaceId}/photo1.jpg`,
        `${validSpaceId}/photo2.jpg`,
      ])
      expect(capturedDeletes).toContainEqual(
        expect.objectContaining({
          table: 'spaces',
          filters: expect.objectContaining({ id: validSpaceId }),
        }),
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith('/host')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/spaces')
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/spaces/${validSpaceId}`)
    })
  })
})
