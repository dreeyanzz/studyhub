import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { getSeatMap } from '@/lib/data/seat-map'
import type { Database } from '@/lib/supabase/database.types'

describe('getSeatMap server data helper (STORY-07 TSK-07.4)', () => {
  const validSpaceId = '11111111-1111-4111-8111-111111111111'

  it('returns empty array when spaceId is not a valid UUID', async () => {
    const mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, 'not-a-valid-uuid')
    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('returns empty array when zones query returns an error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: null, error: new Error('RLS refusal') }),
          }),
        }),
      }),
    })

    const mockSupabase = {
      from: mockFrom,
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)
    expect(result).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('zones')
  })

  it('returns empty array when space has no zones', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    const mockSupabase = {
      from: mockFrom,
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)
    expect(result).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('zones')
  })

  it('enforces column grant invariant N15 (never queries units.host_state directly)', async () => {
    let queriedColumns = ''

    const zonesData = [
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockImplementation((cols: string) => {
        queriedColumns = cols
        return {
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })

    const mockSupabase = {
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as SupabaseClient<Database>

    await getSeatMap(mockSupabase, validSpaceId)

    expect(queriedColumns).not.toContain('host_state')
    expect(queriedColumns).not.toContain('host_updated_at')
    expect(queriedColumns).not.toBe('*')
    expect(queriedColumns).toContain('id')
    expect(queriedColumns).toContain('label')
    expect(queriedColumns).toContain('grid_row')
    expect(queriedColumns).toContain('grid_col')
    expect(queriedColumns).toContain('col_span')
  })

  it('reads zones in position order and joins units with unit_states', async () => {
    const zonesData = [
      {
        id: 'zone-2',
        name: 'Standing Desks',
        position: 1,
        created_at: '2026-11-01T00:00:00Z',
      },
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const unitsData = [
      {
        id: 'unit-2',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'S2',
        capacity: null,
        grid_row: 0,
        grid_col: 1,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-1',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'S1',
        capacity: null,
        grid_row: 0,
        grid_col: 0,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-3',
        space_id: validSpaceId,
        zone_id: 'zone-2',
        unit_type: 'standing_desk' as const,
        label: 'D1',
        capacity: null,
        grid_row: 1,
        grid_col: 0,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
    ]

    const unitStatesData = [
      {
        unit_id: 'unit-1',
        seat_state: 'available',
        host_updated_at: '2026-11-01T02:00:00Z',
        wait_window_ends_at: null,
        reservation_id: null,
      },
      {
        unit_id: 'unit-2',
        seat_state: 'reserved',
        host_updated_at: '2026-11-01T02:30:00Z',
        wait_window_ends_at: '2026-11-01T03:00:00Z',
        reservation_id: 'res-123',
      },
      {
        unit_id: 'unit-3',
        seat_state: 'available',
        host_updated_at: '2026-11-01T02:45:00Z',
        wait_window_ends_at: null,
        reservation_id: null,
      },
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: unitsData, error: null }),
          }),
        }),
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockRpc = vi.fn().mockResolvedValue({ data: unitStatesData, error: null })

    const mockSupabase = {
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)

    expect(mockRpc).toHaveBeenCalledWith('unit_states', {
      p_space_id: validSpaceId,
    })

    expect(result).toHaveLength(2)
    const firstZone = result[0]!
    expect(firstZone.id).toBe('zone-2')
    expect(firstZone.name).toBe('Standing Desks')
    expect(firstZone.units).toHaveLength(1)
    expect(firstZone.units[0]).toEqual({
      id: 'unit-3',
      unitType: 'standing_desk',
      label: 'D1',
      capacity: null,
      row: 1,
      col: 0,
      colSpan: 1,
      seatState: 'occupied', // fails closed when missing from unit_states
      hostUpdatedAt: '2026-11-01T02:45:00Z',
      waitWindowEndsAt: null,
      reservationId: null,
    })

    // Second zone: zone-1 (quiet desks), units ordered by col (S1 before S2)
    const secondZone = result[1]!
    expect(secondZone.id).toBe('zone-1')
    expect(secondZone.name).toBe('Quiet Desks')
    expect(secondZone.units).toHaveLength(2)

    const s1 = secondZone.units[0]!
    expect(s1.label).toBe('S1')
    expect(s1.col).toBe(0)
    expect(s1.seatState).toBe('available')
    expect(s1.hostUpdatedAt).toBe('2026-11-01T02:00:00Z')

    const s2 = secondZone.units[1]!
    expect(s2.label).toBe('S2')
    expect(s2.col).toBe(1)
    expect(s2.seatState).toBe('reserved')
    expect(s2.reservationId).toBe('res-123')
    expect(s2.waitWindowEndsAt).toBe('2026-11-01T03:00:00Z')
  })

  it('returns empty array when units query errors', async () => {
    const zonesData = [
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: null, error: new Error('DB Error') }),
          }),
        }),
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockSupabase = {
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)
    expect(result).toEqual([])
  })

  it('returns empty array when unit_states RPC returns an error', async () => {
    const zonesData = [
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const unitsData = [
      {
        id: 'unit-1',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'S1',
        capacity: null,
        grid_row: 0,
        grid_col: 0,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: unitsData, error: null }),
          }),
        }),
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockSupabase = {
      from: mockFrom,
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error('42501 permission denied') }),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)
    expect(result).toEqual([])
  })

  it('returns empty array when space has units but unit_states returns 0 rows (caller not authorized to see pending/rejected space)', async () => {
    const zonesData = [
      {
        id: 'zone-1',
        name: 'Quiet Desks',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const unitsData = [
      {
        id: 'unit-1',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'S1',
        capacity: null,
        grid_row: 0,
        grid_col: 0,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: unitsData, error: null }),
          }),
        }),
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockSupabase = {
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)
    expect(result).toEqual([])
  })

  it('returns no seat map when unit state is missing or unrecognized', async () => {
    const zonesData = [
      {
        id: 'zone-1',
        name: 'Zone 1',
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const unitsData = [
      {
        id: 'unit-a',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'A',
        capacity: null,
        grid_row: 0,
        grid_col: 0,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-b',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'B',
        capacity: null,
        grid_row: 0,
        grid_col: 1,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-c',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'C',
        capacity: null,
        grid_row: 0,
        grid_col: 2,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-d',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'D',
        capacity: null,
        grid_row: 0,
        grid_col: 3,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
      {
        id: 'unit-e',
        space_id: validSpaceId,
        zone_id: 'zone-1',
        unit_type: 'seat' as const,
        label: 'E',
        capacity: null,
        grid_row: 0,
        grid_col: 4,
        col_span: 1,
        created_at: '2026-11-01T01:00:00Z',
      },
    ]

    const unitStatesData = [
      {
        unit_id: 'unit-a',
        seat_state: 'available',
        host_updated_at: '2026-11-01T02:00:00Z',
        wait_window_ends_at: null,
        reservation_id: null,
      },
      {
        unit_id: 'unit-b',
        seat_state: 'pending_payment',
        host_updated_at: '2026-11-01T02:00:00Z',
        wait_window_ends_at: '2026-11-01T02:15:00Z',
        reservation_id: 'res-b',
      },
      {
        unit_id: 'unit-c',
        seat_state: 'reserved',
        host_updated_at: '2026-11-01T02:00:00Z',
        wait_window_ends_at: '2026-11-01T03:00:00Z',
        reservation_id: 'res-c',
      },
      {
        unit_id: 'unit-d',
        seat_state: 'unexpected_state_value',
        host_updated_at: '2026-11-01T02:00:00Z',
        wait_window_ends_at: null,
        reservation_id: null,
      },
      // unit-e is omitted entirely from unitStatesData
    ]

    const mockZonesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: zonesData, error: null }),
          }),
        }),
      }),
    }

    const mockUnitsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: unitsData, error: null }),
          }),
        }),
      }),
    }

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'zones') return mockZonesChain
      if (table === 'units') return mockUnitsChain
      throw new Error(`Unexpected table ${table}`)
    })

    const mockRpc = vi.fn().mockResolvedValue({ data: unitStatesData, error: null })

    const mockSupabase = {
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as SupabaseClient<Database>

    const result = await getSeatMap(mockSupabase, validSpaceId)

    // A partial or unrecognized state result invalidates the whole snapshot:
    // do not render misleading availability or freshness.
    expect(result).toEqual([])
  })
})
