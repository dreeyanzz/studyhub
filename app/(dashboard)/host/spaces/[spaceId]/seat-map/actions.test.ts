import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addUnit,
  addUnitAction,
  addZone,
  createUnit,
  createUnitAction,
  createZone,
  createZoneAction,
  deleteUnit,
  deleteUnitAction,
  deleteZone,
  deleteZoneAction,
  moveUnit,
  moveUnitAction,
  moveZoneDown,
  moveZoneDownAction,
  moveZoneDownForm,
  moveZoneUp,
  moveZoneUpAction,
  moveZoneUpForm,
  renameZone,
  renameZoneAction,
  reorderZones,
  reorderZonesAction,
  updateUnit,
  updateUnitAction,
  updateZone,
  updateZoneAction,
} from './actions'
import { mapPostgresError } from '@/lib/seat-map/errors'

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
  error: { code?: string; message?: string } | null
}

let tableResponses: Record<string, QueryResult> = {}
let capturedInserts: { table: string; values: unknown }[] = []
let capturedUpdates: {
  table: string
  values: unknown
  filters: Record<string, unknown>
}[] = []
let capturedDeletes: { table: string; filters: Record<string, unknown> }[] = []
let capturedSelects: { table: string; columns: string }[] = []

function createMockQueryBuilder(table: string) {
  const filters: Record<string, unknown> = {}

  const builder: Record<string, unknown> = {
    select: vi.fn((cols = '*') => {
      capturedSelects.push({ table, columns: cols })
      return builder
    }),
    insert: vi.fn((values: unknown) => {
      capturedInserts.push({ table, values })
      return builder
    }),
    update: vi.fn((values: unknown) => {
      capturedUpdates.push({ table, values, filters })
      return builder
    }),
    delete: vi.fn(() => {
      capturedDeletes.push({ table, filters })
      return builder
    }),
    eq: vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return builder
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => {
      return (
        tableResponses[table] ?? {
          data: { id: 'mock-id' },
          error: null,
        }
      )
    }),
    maybeSingle: vi.fn(async () => {
      return (
        tableResponses[table] ?? {
          data: { id: 'mock-id' },
          error: null,
        }
      )
    }),
    then: (resolve: (val: unknown) => void) => {
      resolve(
        tableResponses[table] ?? {
          data: [{ id: 'mock-id' }],
          error: null,
        },
      )
    },
  }

  return builder
}

let mockRpcResponse: {
  data: unknown
  error: { code?: string; message?: string } | null
} = {
  data: null,
  error: null,
}
let capturedRpcCalls: { fn: string; args: unknown }[] = []

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
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

const validSpaceId = 'e0000000-0000-4000-8000-000000000001'
const validZoneId = 'd0000000-0000-4000-8000-000000000001'
const validUnitId = 'c0000000-0000-4000-8000-000000000001'

describe('Seat Map Server Actions', () => {
  beforeEach(() => {
    mockUser = { id: 'b0000000-0000-4000-8000-000000000001' }
    tableResponses = {
      spaces: { data: { id: validSpaceId }, error: null },
      zones: {
        data: {
          id: validZoneId,
          space_id: validSpaceId,
          name: 'Quiet desks',
          position: 0,
        },
        error: null,
      },
      units: {
        data: {
          id: validUnitId,
          space_id: validSpaceId,
          zone_id: validZoneId,
          unit_type: 'seat',
          label: 'S1',
          capacity: null,
          grid_row: 0,
          grid_col: 0,
          col_span: 1,
        },
        error: null,
      },
    }
    capturedInserts = []
    capturedUpdates = []
    capturedDeletes = []
    capturedSelects = []
    capturedRpcCalls = []
    mockRpcResponse = { data: null, error: null }
    mockSupabase.from = vi.fn((table: string) => createMockQueryBuilder(table))
    mockSupabase.rpc = vi.fn(async (fn: string, args: unknown) => {
      capturedRpcCalls.push({ fn, args })
      return mockRpcResponse
    })
    mockRevalidatePath.mockClear()
    mockRedirect.mockClear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // 1. Error Mapping Tests
  // ---------------------------------------------------------------------------
  describe('mapPostgresError', () => {
    it('maps 23P01 exclusion violation to user-friendly overlap error', () => {
      const result = mapPostgresError({ code: '23P01' }, 'unit')
      expect(result.formError).toBe('That grid cell is already occupied')
      expect(result.fieldErrors?.col).toContain('That grid cell is already occupied')
      expect(result.fieldErrors?.row).toContain('That grid cell is already occupied')
      expect(result.fieldErrors?.grid_col).toContain('That grid cell is already occupied')
      expect(result.fieldErrors?.grid_row).toContain('That grid cell is already occupied')
    })

    it('maps 23505 unique violation on unit label to duplicate label error', () => {
      const result = mapPostgresError({ code: '23505' }, 'unit')
      expect(result.formError).toBe('A unit with this label already exists in this Space')
      expect(result.fieldErrors?.label).toContain(
        'A unit with this label already exists in this Space',
      )
    })

    it('maps 23505 unique violation on zone name to duplicate zone error', () => {
      const result = mapPostgresError({ code: '23505' }, 'zone')
      expect(result.formError).toBe('A zone with this name already exists in this Space')
      expect(result.fieldErrors?.name).toContain(
        'A zone with this name already exists in this Space',
      )
    })

    it('maps 42501 unauthorized / RLS refusal to permission error', () => {
      const result = mapPostgresError({ code: '42501' })
      expect(result.formError).toBe('Space may not exist or you do not have permission')
    })

    it('maps 23514 check constraint violation to configuration error by context', () => {
      const unitResult = mapPostgresError({ code: '23514' }, 'unit')
      expect(unitResult.formError).toBe('Unit bounds or configuration are invalid')

      const zoneResult = mapPostgresError({ code: '23514' }, 'zone')
      expect(zoneResult.formError).toBe('Zone configuration is invalid')
    })

    it('maps 23503 foreign key violation to appropriate error message', () => {
      const unitResult = mapPostgresError({ code: '23503' }, 'unit')
      expect(unitResult.formError).toBe(
        'Zone may not exist or does not belong to this Space',
      )

      const zoneResult = mapPostgresError({ code: '23503' }, 'zone')
      expect(zoneResult.formError).toBe(
        'Space may not exist or you do not have permission',
      )
    })

    it('maps unknown error codes to generic message', () => {
      const unitResult = mapPostgresError({ code: '99999' }, 'unit')
      expect(unitResult.formError).toBe('We could not save this unit. Please try again.')

      const zoneResult = mapPostgresError({ code: '99999' }, 'zone')
      expect(zoneResult.formError).toBe('We could not save this zone. Please try again.')
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Authentication & Space Ownership
  // ---------------------------------------------------------------------------
  describe('Authentication & Space Ownership Guards', () => {
    it('redirects to login if user is not authenticated', async () => {
      mockUser = null
      mockRedirect.mockImplementationOnce(() => {
        throw new Error('NEXT_REDIRECT')
      })

      await expect(
        createZone({ spaceId: validSpaceId, name: 'Main Zone' }),
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/login?returnUrl=%2Fhost')
    })

    it('refuses mutation when caller does not own the Space', async () => {
      tableResponses.spaces = { data: null, error: null }

      const res = await createZone({ spaceId: validSpaceId, name: 'Main Zone' })
      expect(res.formError).toBe('Space may not exist or you do not have permission')
      expect(res.success).toBeFalsy()
      expect(capturedInserts).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Zone Actions Tests
  // ---------------------------------------------------------------------------
  describe('Zone Actions', () => {
    it('validates zone name length and rejects empty name', async () => {
      const res = await createZone({ spaceId: validSpaceId, name: '' })
      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.name).toBeDefined()
      expect(capturedInserts).toHaveLength(0)
    })

    it('validates zone name length > 60 chars', async () => {
      const res = await createZone({
        spaceId: validSpaceId,
        name: 'a'.repeat(61),
      })
      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.name).toContain('Zone name must be 60 characters or fewer')
    })

    it('successfully creates zone and revalidates path', async () => {
      const res = await createZone({
        spaceId: validSpaceId,
        name: 'Quiet Area',
        position: 2,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedInserts).toContainEqual({
        table: 'zones',
        values: {
          space_id: validSpaceId,
          name: 'Quiet Area',
          position: 2,
        },
      })
    })

    it('supports positional arguments on createZone', async () => {
      const res = await createZone(validSpaceId, 'Positional Zone', 3)
      expect(res.success).toBe(true)
      expect(capturedInserts).toContainEqual({
        table: 'zones',
        values: {
          space_id: validSpaceId,
          name: 'Positional Zone',
          position: 3,
        },
      })
    })

    it('handles duplicate zone name error (23505)', async () => {
      tableResponses.zones = {
        data: null,
        error: { code: '23505', message: 'unique violation' },
      }

      const res = await createZone({
        spaceId: validSpaceId,
        name: 'Existing Zone',
      })

      expect(res.formError).toBe('A zone with this name already exists in this Space')
      expect(res.fieldErrors?.name).toContain(
        'A zone with this name already exists in this Space',
      )
    })

    it('renames zone successfully', async () => {
      const res = await renameZone({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        name: 'Renamed Zone',
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'zones',
          values: { name: 'Renamed Zone' },
        }),
      )
    })

    it('supports positional arguments on renameZone', async () => {
      const res = await renameZone(validSpaceId, validZoneId, 'Renamed Positional', 1)
      expect(res.success).toBe(true)
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'zones',
          values: { name: 'Renamed Positional', position: 1 },
        }),
      )
    })

    it('returns error when renaming non-existent zone', async () => {
      tableResponses.zones = { data: null, error: null }

      const res = await renameZone(validSpaceId, validZoneId, 'Non-existent')
      expect(res.formError).toBe('Zone may not exist or you do not have permission')
    })

    it('reorders zones with zoneOrders array', async () => {
      const res = await reorderZones({
        spaceId: validSpaceId,
        zoneOrders: [
          { zoneId: validZoneId, position: 1 },
          { zoneId: 'd0000000-0000-4000-8000-000000000002', position: 0 },
        ],
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: ['d0000000-0000-4000-8000-000000000002', validZoneId],
        },
      })
    })

    it('reorders zones with zoneIds array', async () => {
      const res = await reorderZones({
        spaceId: validSpaceId,
        zoneIds: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
        },
      })
    })

    it('supports positional arguments on reorderZones', async () => {
      const res = await reorderZones(validSpaceId, [
        validZoneId,
        'd0000000-0000-4000-8000-000000000002',
      ])

      expect(res.success).toBe(true)
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
        },
      })
    })

    it('moves zone up successfully and normalizes positions', async () => {
      tableResponses.zones = {
        data: [
          { id: 'd0000000-0000-4000-8000-000000000002', position: 0 },
          { id: validZoneId, position: 1 },
        ],
        error: null,
      }

      const res = await moveZoneUp({
        spaceId: validSpaceId,
        zoneId: validZoneId,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
        },
      })
    })

    it('supports positional arguments on moveZoneUp and moveZoneDown', async () => {
      tableResponses.zones = {
        data: [
          { id: 'd0000000-0000-4000-8000-000000000002', position: 0 },
          { id: validZoneId, position: 1 },
        ],
        error: null,
      }

      const resUp = await moveZoneUp(validSpaceId, validZoneId)
      expect(resUp.success).toBe(true)
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
        },
      })

      capturedRpcCalls = []
      tableResponses.zones = {
        data: [
          { id: validZoneId, position: 0 },
          { id: 'd0000000-0000-4000-8000-000000000002', position: 1 },
        ],
        error: null,
      }

      const resDown = await moveZoneDown(validSpaceId, validZoneId)
      expect(resDown.success).toBe(true)
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: ['d0000000-0000-4000-8000-000000000002', validZoneId],
        },
      })
    })

    it('returns error when moveZoneUp or moveZoneDown targets non-existent zone', async () => {
      tableResponses.zones = {
        data: [{ id: 'd0000000-0000-4000-8000-000000000002', position: 0 }],
        error: null,
      }

      const resUp = await moveZoneUp(validSpaceId, validZoneId)
      expect(resUp.formError).toBe('Zone may not exist or you do not have permission')

      const resDown = await moveZoneDown(validSpaceId, validZoneId)
      expect(resDown.formError).toBe('Zone may not exist or you do not have permission')
    })

    it('moves zone down successfully', async () => {
      tableResponses.zones = {
        data: [
          { id: validZoneId, position: 0 },
          { id: 'd0000000-0000-4000-8000-000000000002', position: 1 },
        ],
        error: null,
      }

      const res = await moveZoneDown({
        spaceId: validSpaceId,
        zoneId: validZoneId,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: ['d0000000-0000-4000-8000-000000000002', validZoneId],
        },
      })
    })

    it('executes moveZoneUpForm with FormData and returns void', async () => {
      tableResponses.zones = {
        data: [
          { id: 'd0000000-0000-4000-8000-000000000002', position: 0 },
          { id: validZoneId, position: 1 },
        ],
        error: null,
      }

      const fd = new FormData()
      fd.append('spaceId', validSpaceId)
      fd.append('zoneId', validZoneId)

      const result = await moveZoneUpForm(fd)
      expect(result).toBeUndefined()
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
        },
      })
    })

    it('executes moveZoneDownForm with FormData and returns void', async () => {
      tableResponses.zones = {
        data: [
          { id: validZoneId, position: 0 },
          { id: 'd0000000-0000-4000-8000-000000000002', position: 1 },
        ],
        error: null,
      }

      const fd = new FormData()
      fd.append('spaceId', validSpaceId)
      fd.append('zoneId', validZoneId)

      const result = await moveZoneDownForm(fd)
      expect(result).toBeUndefined()
      expect(capturedRpcCalls).toContainEqual({
        fn: 'reorder_zones',
        args: {
          p_space_id: validSpaceId,
          p_zone_ids: ['d0000000-0000-4000-8000-000000000002', validZoneId],
        },
      })
    })

    it('handles atomic failure when reorder_zones rpc fails without partial updates', async () => {
      mockRpcResponse = {
        data: null,
        error: {
          code: '23503',
          message: 'Zone does not exist or does not belong to Space',
        },
      }

      const res = await reorderZones({
        spaceId: validSpaceId,
        zoneIds: [validZoneId, 'd0000000-0000-4000-8000-000000000002'],
      })

      expect(res.success).toBeFalsy()
      expect(res.formError).toBe('Space may not exist or you do not have permission')
      expect(capturedUpdates.filter((u) => u.table === 'zones')).toHaveLength(0)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('handles atomic failure when moveZoneUp rpc fails without persisting partial order', async () => {
      tableResponses.zones = {
        data: [
          { id: 'd0000000-0000-4000-8000-000000000002', position: 0 },
          { id: validZoneId, position: 1 },
        ],
        error: null,
      }

      mockRpcResponse = {
        data: null,
        error: {
          code: '42501',
          message: 'permission denied',
        },
      }

      const res = await moveZoneUp({
        spaceId: validSpaceId,
        zoneId: validZoneId,
      })

      expect(res.success).toBeFalsy()
      expect(res.formError).toBe('Space may not exist or you do not have permission')
      expect(capturedUpdates.filter((u) => u.table === 'zones')).toHaveLength(0)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('deletes zone successfully', async () => {
      const res = await deleteZone({
        spaceId: validSpaceId,
        zoneId: validZoneId,
      })

      expect(res.success).toBe(true)
      expect(res.data).toEqual({ id: validZoneId })
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedDeletes).toContainEqual(
        expect.objectContaining({
          table: 'zones',
        }),
      )
    })

    it('supports positional arguments on deleteZone', async () => {
      const res = await deleteZone(validSpaceId, validZoneId)
      expect(res.success).toBe(true)
      expect(res.data).toEqual({ id: validZoneId })
    })

    it('returns error when deleting non-existent zone', async () => {
      tableResponses.zones = { data: null, error: null }

      const res = await deleteZone(validSpaceId, validZoneId)
      expect(res.formError).toBe('Zone may not exist or you do not have permission')
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Unit Actions Tests
  // ---------------------------------------------------------------------------
  describe('Unit Actions', () => {
    it('validates unit input and rejects empty label', async () => {
      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: '',
        row: 0,
        col: 0,
        colSpan: 1,
      })

      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.label).toBeDefined()
      expect(capturedInserts).toHaveLength(0)
    })

    it('rejects capacity on seat or standing desk', async () => {
      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1',
        capacity: 4,
        row: 0,
        col: 0,
        colSpan: 1,
      })

      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.capacity).toContain(
        'Seats and standing desks cannot have a capacity',
      )
    })

    it('requires capacity on whole room', async () => {
      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'room',
        label: 'Room A',
        capacity: undefined,
        row: 0,
        col: 0,
        colSpan: 2,
      })

      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.capacity).toContain('Room capacity is required')
    })

    it('rejects unit exceeding grid right boundary (col + colSpan > 6)', async () => {
      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'room',
        label: 'Room A',
        capacity: 4,
        row: 0,
        col: 5,
        colSpan: 2,
      })

      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.colSpan).toContain(
        'Unit must fit within the 6 grid columns',
      )
    })

    it('successfully adds unit with explicit columns only (no row, col, unitType, colSpan sent)', async () => {
      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1',
        row: 1,
        col: 2,
        colSpan: 1,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )

      expect(capturedInserts).toHaveLength(1)
      const inserted = capturedInserts[0]
      expect(inserted).toBeDefined()
      if (!inserted) throw new Error('Expected captured insert')
      expect(inserted.table).toBe('units')
      expect(inserted.values).toEqual({
        space_id: validSpaceId,
        zone_id: validZoneId,
        unit_type: 'seat',
        label: 'S1',
        capacity: null,
        grid_row: 1,
        grid_col: 2,
        col_span: 1,
      })
      // Ensure camelCase and helper fields are stripped
      expect(inserted.values).not.toHaveProperty('row')
      expect(inserted.values).not.toHaveProperty('col')
      expect(inserted.values).not.toHaveProperty('colSpan')
      expect(inserted.values).not.toHaveProperty('unitType')
    })

    it('supports positional arguments on addUnit (design §1.2 sequence diagram)', async () => {
      const res = await addUnit(validSpaceId, validZoneId, 'seat', 'S2', null, 1, 2, 1)

      expect(res.success).toBe(true)
      expect(capturedInserts).toContainEqual(
        expect.objectContaining({
          table: 'units',
          values: expect.objectContaining({
            space_id: validSpaceId,
            zone_id: validZoneId,
            unit_type: 'seat',
            label: 'S2',
            grid_row: 1,
            grid_col: 2,
            col_span: 1,
          }),
        }),
      )
    })

    it('selects explicit granted columns on insert (N15: no select * on units)', async () => {
      await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1',
        row: 0,
        col: 0,
        colSpan: 1,
      })

      const unitSelect = capturedSelects.find((s) => s.table === 'units')
      expect(unitSelect).toBeDefined()
      expect(unitSelect?.columns).toBe(
        'id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span, created_at, updated_at',
      )
      expect(unitSelect?.columns).not.toContain('host_state')
      expect(unitSelect?.columns).not.toContain('host_updated_at')
    })

    it('handles exclusion overlap violation (23P01) on addUnit', async () => {
      tableResponses.units = {
        data: null,
        error: { code: '23P01', message: 'exclusion violation' },
      }

      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1',
        row: 0,
        col: 0,
        colSpan: 1,
      })

      expect(res.formError).toBe('That grid cell is already occupied')
      expect(res.fieldErrors?.col).toContain('That grid cell is already occupied')
      expect(res.fieldErrors?.row).toContain('That grid cell is already occupied')
    })

    it('handles duplicate unit label violation (23505) on addUnit', async () => {
      tableResponses.units = {
        data: null,
        error: { code: '23505', message: 'unique label violation' },
      }

      const res = await addUnit({
        spaceId: validSpaceId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1',
        row: 0,
        col: 0,
        colSpan: 1,
      })

      expect(res.formError).toBe('A unit with this label already exists in this Space')
      expect(res.fieldErrors?.label).toContain(
        'A unit with this label already exists in this Space',
      )
    })

    it('updates unit details successfully', async () => {
      const res = await updateUnit({
        spaceId: validSpaceId,
        unitId: validUnitId,
        zoneId: validZoneId,
        unitType: 'seat',
        label: 'S1-updated',
        row: 2,
        col: 3,
        colSpan: 1,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'units',
          values: {
            zone_id: validZoneId,
            unit_type: 'seat',
            label: 'S1-updated',
            capacity: null,
            grid_row: 2,
            grid_col: 3,
            col_span: 1,
          },
        }),
      )
    })

    it('supports positional arguments on updateUnit', async () => {
      const res = await updateUnit(
        validSpaceId,
        validUnitId,
        validZoneId,
        'seat',
        'S1-pos',
        null,
        1,
        1,
        1,
      )

      expect(res.success).toBe(true)
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'units',
          values: expect.objectContaining({
            label: 'S1-pos',
            grid_row: 1,
            grid_col: 1,
          }),
        }),
      )
    })

    it('returns error when updateUnit targets non-existent unit', async () => {
      tableResponses.units = { data: null, error: null }

      const res = await updateUnit(
        validSpaceId,
        validUnitId,
        validZoneId,
        'seat',
        'S1',
        null,
        0,
        0,
        1,
      )

      expect(res.formError).toBe('Unit may not exist or you do not have permission')
    })

    it('moveUnit passes colSpan to schema and writes only zone_id, grid_row, and grid_col (never width)', async () => {
      const res = await moveUnit({
        spaceId: validSpaceId,
        unitId: validUnitId,
        zoneId: validZoneId,
        row: 3,
        col: 4,
        colSpan: 1,
      })

      expect(res.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )

      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'units',
          values: {
            zone_id: validZoneId,
            grid_row: 3,
            grid_col: 4,
          },
        }),
      )

      const moveUpdate = capturedUpdates.find((u) => u.table === 'units')
      expect(moveUpdate?.values).not.toHaveProperty('col_span')
      expect(moveUpdate?.values).not.toHaveProperty('colSpan')
      expect(moveUpdate?.values).not.toHaveProperty('unit_type')
      expect(moveUpdate?.values).not.toHaveProperty('label')
    })

    it('supports positional arguments on moveUnit', async () => {
      const res = await moveUnit(validSpaceId, validUnitId, validZoneId, 2, 2, 1)
      expect(res.success).toBe(true)
      expect(capturedUpdates).toContainEqual(
        expect.objectContaining({
          table: 'units',
          values: {
            zone_id: validZoneId,
            grid_row: 2,
            grid_col: 2,
          },
        }),
      )
    })

    it('moveUnit returns permission/not-found error when unit does not exist in space', async () => {
      tableResponses.units = { data: null, error: null }

      const res = await moveUnit(validSpaceId, validUnitId, validZoneId, 1, 1)
      expect(res.formError).toBe('Unit may not exist or you do not have permission')
    })

    it('moveUnit looks up col_span from database when omitted from payload', async () => {
      tableResponses.units = {
        data: { col_span: 2, id: validUnitId },
        error: null,
      }

      // col 5 with colSpan 2 exceeds 6 columns (5 + 2 = 7 > 6)
      const res = await moveUnit({
        spaceId: validSpaceId,
        unitId: validUnitId,
        zoneId: validZoneId,
        row: 0,
        col: 5,
      })

      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.fieldErrors?.col).toContain('Unit must fit within the 6 grid columns')
    })

    it('moveUnit maps 23P01 cell overlap error', async () => {
      let queryCount = 0
      // First query is col_span lookup, second query is the update
      mockSupabase.from = vi.fn((table: string) => {
        const builder = createMockQueryBuilder(table)
        if (table === 'units') {
          queryCount++
          if (queryCount > 1) {
            builder.maybeSingle = vi.fn(async () => ({
              data: null,
              error: { code: '23P01', message: 'exclusion violation' },
            }))
          }
        }
        return builder
      })

      const res = await moveUnit({
        spaceId: validSpaceId,
        unitId: validUnitId,
        zoneId: validZoneId,
        row: 1,
        col: 1,
        colSpan: 1,
      })

      expect(res.formError).toBe('That grid cell is already occupied')
      expect(res.fieldErrors?.col).toContain('That grid cell is already occupied')
    })

    it('deletes unit successfully', async () => {
      const res = await deleteUnit({
        spaceId: validSpaceId,
        unitId: validUnitId,
      })

      expect(res.success).toBe(true)
      expect(res.data).toEqual({ id: validUnitId })
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/host/spaces/${validSpaceId}/seat-map`,
      )
      expect(capturedDeletes).toContainEqual(
        expect.objectContaining({
          table: 'units',
        }),
      )
    })

    it('supports positional arguments on deleteUnit', async () => {
      const res = await deleteUnit(validSpaceId, validUnitId)
      expect(res.success).toBe(true)
      expect(res.data).toEqual({ id: validUnitId })
    })

    it('returns error when deleting non-existent unit', async () => {
      tableResponses.units = { data: null, error: null }

      const res = await deleteUnit(validSpaceId, validUnitId)
      expect(res.formError).toBe('Unit may not exist or you do not have permission')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. FormData and useActionState compatibility
  // ---------------------------------------------------------------------------
  describe('FormData and ActionState compatibility', () => {
    it('supports useActionState invocation format (prevState, formData)', async () => {
      const formData = new FormData()
      formData.append('spaceId', validSpaceId)
      formData.append('name', 'Form Zone')
      formData.append('position', '0')

      const res = await createZone({ formError: 'old error' }, formData)
      expect(res.success).toBe(true)
      expect(capturedInserts).toContainEqual(
        expect.objectContaining({
          table: 'zones',
          values: expect.objectContaining({ name: 'Form Zone' }),
        }),
      )
    })

    it('preserves form values on validation failure for unit addition', async () => {
      const formData = new FormData()
      formData.append('spaceId', validSpaceId)
      formData.append('zoneId', validZoneId)
      formData.append('unitType', 'seat')
      formData.append('label', '') // invalid empty label
      formData.append('row', '2')
      formData.append('col', '3')

      const res = await addUnit(formData)
      expect(res.formError).toBe('Please correct the errors in the form before saving.')
      expect(res.values).toBeDefined()
      expect(res.values?.label).toBe('')
      expect(res.values?.row).toBe('2')
      expect(res.values?.col).toBe('3')
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Action Aliases
  // ---------------------------------------------------------------------------
  describe('Action Aliases Export Verification', () => {
    it('aliases match primary action functions', () => {
      expect(addZone).toBe(createZone)
      expect(createZoneAction).toBe(createZone)
      expect(renameZoneAction).toBe(renameZone)
      expect(updateZone).toBe(renameZone)
      expect(updateZoneAction).toBe(renameZone)
      expect(reorderZonesAction).toBe(reorderZones)
      expect(moveZoneUpAction).toBe(moveZoneUp)
      expect(moveZoneDownAction).toBe(moveZoneDown)
      expect(deleteZoneAction).toBe(deleteZone)
      expect(addUnitAction).toBe(addUnit)
      expect(createUnit).toBe(addUnit)
      expect(createUnitAction).toBe(addUnit)
      expect(updateUnitAction).toBe(updateUnit)
      expect(moveUnitAction).toBe(moveUnit)
      expect(deleteUnitAction).toBe(deleteUnit)
    })
  })
})
