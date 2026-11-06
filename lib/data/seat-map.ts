import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { SeatMapUnit, SeatMapZone, SeatState } from '@/lib/seat-map/grid'
import { spaceIdSchema } from '@/lib/validation/space'

/**
 * Server-only query helper for the shared seat map renderer (STORY-07, TSK-07.4, D-047).
 *
 * Reads a Space's zones in `position` order (ties resolved by `created_at`), and their
 * units ordered by grid row and column. Seat states and freshness timestamps are joined
 * exclusively from `public.unit_states(space_id)`.
 *
 * Security invariant (N15): Direct SELECT access to `units.host_state` and `units.host_updated_at`
 * is revoked in Postgres. `units` columns are explicitly selected, avoiding `*` which fails with 42501.
 *
 * A Space that the caller may not see (e.g. pending/rejected for a non-host/non-admin) returns no zones.
 */
export async function getSeatMap(
  supabase: SupabaseClient<Database>,
  spaceId: string,
): Promise<SeatMapZone[]> {
  const parsedId = spaceIdSchema.safeParse(spaceId)
  if (!parsedId.success) {
    return []
  }

  const { data: zonesData, error: zonesError } = await supabase
    .from('zones')
    .select('id, name, position, created_at')
    .eq('space_id', parsedId.data)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (zonesError || !zonesData || zonesData.length === 0) {
    return []
  }

  const [unitsResult, statesResult] = await Promise.all([
    supabase
      .from('units')
      .select(
        'id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span',
      )
      .eq('space_id', parsedId.data)
      .order('grid_row', { ascending: true })
      .order('grid_col', { ascending: true }),
    supabase.rpc('unit_states', { p_space_id: parsedId.data }),
  ])

  if (
    unitsResult.error ||
    !unitsResult.data ||
    statesResult.error ||
    !statesResult.data
  ) {
    return []
  }

  // If a Space has units but unit_states returned 0 rows, the caller is not
  // authorized to see the units (e.g. pending/rejected space, D-055, N19).
  if (unitsResult.data.length > 0 && statesResult.data.length === 0) {
    return []
  }

  const stateMap = new Map<
    string,
    {
      seat_state: string
      host_updated_at: string
      wait_window_ends_at: string | null
      reservation_id: string | null
    }
  >()

  if (statesResult.data) {
    for (const state of statesResult.data) {
      stateMap.set(state.unit_id, {
        seat_state: state.seat_state,
        host_updated_at: state.host_updated_at,
        wait_window_ends_at: state.wait_window_ends_at ?? null,
        reservation_id: state.reservation_id ?? null,
      })
    }
  }

  const unitsByZone = new Map<string, SeatMapUnit[]>()
  for (const zone of zonesData) {
    unitsByZone.set(zone.id, [])
  }

  for (const unit of unitsResult.data) {
    const list = unitsByZone.get(unit.zone_id)
    if (!list) continue

    const stateInfo = stateMap.get(unit.id)
    if (!stateInfo) {
      // Do not render a partial map when a unit has no authoritative state.
      return []
    }

    const rawState = stateInfo.seat_state
    if (
      rawState !== 'available' &&
      rawState !== 'pending_payment' &&
      rawState !== 'reserved' &&
      rawState !== 'occupied'
    ) {
      // Unknown state data must not be presented as a real seat state.
      return []
    }
    const seatState = rawState as SeatState

    list.push({
      id: unit.id,
      unitType: unit.unit_type,
      label: unit.label,
      capacity: unit.capacity,
      row: unit.grid_row,
      col: unit.grid_col,
      colSpan: unit.col_span,
      seatState,
      hostUpdatedAt: stateInfo.host_updated_at,
      waitWindowEndsAt: stateInfo?.wait_window_ends_at ?? null,
      reservationId: stateInfo?.reservation_id ?? null,
    })
  }

  for (const list of unitsByZone.values()) {
    list.sort((a, b) => a.row - b.row || a.col - b.col)
  }

  return zonesData.map((zone) => ({
    id: zone.id,
    name: zone.name,
    position: zone.position,
    units: unitsByZone.get(zone.id) ?? [],
  }))
}
