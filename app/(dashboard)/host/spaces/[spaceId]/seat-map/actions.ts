'use server'

// Server Actions for the Host seat map builder: zones and units management
// (STORY-07 design §1 and §3, D-010, D-062). Each builder change saves immediately
// through its own Server Action. RLS is the security boundary (D-007, D-003).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { mapPostgresError } from '@/lib/seat-map/errors'
import { createClient } from '@/lib/supabase/server'
import {
  addUnitSchema,
  createZoneSchema,
  deleteUnitSchema,
  deleteZoneSchema,
  moveUnitSchema,
  reorderZonesSchema,
  updateUnitSchema,
  updateZoneSchema,
  type AddUnitInput,
  type CreateZoneInput,
  type DeleteUnitInput,
  type DeleteZoneInput,
  type MoveUnitInput,
  type ReorderZonesInput,
  type UpdateUnitInput,
  type UpdateZoneInput,
} from '@/lib/validation/seat-map'

export type SeatMapActionState<T = unknown> = {
  success?: boolean
  data?: T
  fieldErrors?: Record<string, string[]>
  formError?: string
  values?: Record<string, unknown>
}

// Crucial security invariant (N15): No select or update grant is given on
// units.host_state or units.host_updated_at. Direct select * from units throws
// Postgres error 42501, so we select explicit granted columns only.
const UNIT_SELECT_COLUMNS =
  'id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span, created_at, updated_at' as const

const ZONE_SELECT_COLUMNS =
  'id, space_id, name, position, created_at, updated_at' as const

async function signedInClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?returnUrl=%2Fhost')
  return { supabase, user }
}

async function verifySpaceOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  userId: string,
): Promise<boolean> {
  const { data: space, error } = await supabase
    .from('spaces')
    .select('id')
    .eq('id', spaceId)
    .eq('host_id', userId)
    .maybeSingle()
  return !error && !!space
}

function getRawValues(payload: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    return Object.fromEntries(payload.entries())
  }
  if (typeof payload === 'object' && payload !== null) {
    return { ...(payload as Record<string, unknown>) }
  }
  return {}
}

// -----------------------------------------------------------------------------
// Zone Management Actions
// -----------------------------------------------------------------------------

/**
 * Creates a new zone in a Space. Supports positional arguments, object payload,
 * FormData, and useActionState.
 */
export async function createZone(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | CreateZoneInput | string | unknown,
  formDataOrName?: FormData | CreateZoneInput | string,
  maybePosition?: number | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = {
      spaceId: stateOrPayloadOrSpaceId,
      name: formDataOrName,
      position: maybePosition,
    }
  } else if (
    formDataOrName !== undefined &&
    (formDataOrName instanceof FormData || typeof formDataOrName === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrName
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = createZoneSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  let position = parsed.data.position
  // If position was omitted or empty in raw values, place after the last zone
  if (rawValues.position === undefined || rawValues.position === '') {
    const { data: lastZone } = await supabase
      .from('zones')
      .select('position')
      .eq('space_id', parsed.data.spaceId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastZone && typeof lastZone.position === 'number') {
      position = lastZone.position + 1
    }
  }

  // Explicit columns only: space_id, name, position
  const { data: createdZone, error } = await supabase
    .from('zones')
    .insert({
      space_id: parsed.data.spaceId,
      name: parsed.data.name,
      position,
    })
    .select(ZONE_SELECT_COLUMNS)
    .single()

  if (error) {
    const mapped = mapPostgresError(error, 'zone')
    return { ...mapped, values: rawValues }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: createdZone }
}

/**
 * Renames a zone or updates its position.
 */
export async function renameZone(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | UpdateZoneInput | string | unknown,
  formDataOrZoneId?: FormData | UpdateZoneInput | string,
  maybeName?: string,
  maybePosition?: number | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = {
      spaceId: stateOrPayloadOrSpaceId,
      zoneId: formDataOrZoneId,
      name: maybeName,
      position: maybePosition,
    }
  } else if (
    formDataOrZoneId !== undefined &&
    (formDataOrZoneId instanceof FormData || typeof formDataOrZoneId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrZoneId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = updateZoneSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const updateCols: { name: string; position?: number } = {
    name: parsed.data.name,
  }
  if (parsed.data.position !== undefined) {
    updateCols.position = parsed.data.position
  }

  const { data: updatedZone, error } = await supabase
    .from('zones')
    .update(updateCols)
    .eq('id', parsed.data.zoneId)
    .eq('space_id', parsed.data.spaceId)
    .select(ZONE_SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    const mapped = mapPostgresError(error, 'zone')
    return { ...mapped, values: rawValues }
  }

  if (!updatedZone) {
    return {
      formError: 'Zone may not exist or you do not have permission',
      values: rawValues,
    }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: updatedZone }
}

/**
 * Reorders zones within a Space by setting positions.
 */
export async function reorderZones(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | ReorderZonesInput | string | unknown,
  formDataOrOrders?:
    FormData | ReorderZonesInput | string[] | { zoneId: string; position: number }[],
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    if (Array.isArray(formDataOrOrders)) {
      if (typeof formDataOrOrders[0] === 'string') {
        payload = {
          spaceId: stateOrPayloadOrSpaceId,
          zoneIds: formDataOrOrders,
        }
      } else {
        payload = {
          spaceId: stateOrPayloadOrSpaceId,
          zoneOrders: formDataOrOrders,
        }
      }
    } else {
      payload = {
        spaceId: stateOrPayloadOrSpaceId,
        ...(formDataOrOrders as object),
      }
    }
  } else if (
    formDataOrOrders !== undefined &&
    (formDataOrOrders instanceof FormData || typeof formDataOrOrders === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrOrders
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = reorderZonesSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  let zoneIds: string[] = []
  if (parsed.data.zoneIds) {
    zoneIds = parsed.data.zoneIds
  } else if (parsed.data.zoneOrders) {
    const sorted = [...parsed.data.zoneOrders].sort((a, b) => a.position - b.position)
    zoneIds = sorted.map((o) => o.zoneId)
  }

  const { error } = await supabase.rpc('reorder_zones', {
    p_space_id: parsed.data.spaceId,
    p_zone_ids: zoneIds,
  })

  if (error) {
    const mapped = mapPostgresError(error, 'zone')
    return { ...mapped, values: rawValues }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true }
}

/**
 * Moves a zone one step up in display order. Normalizes positions sequentially
 * to prevent duplicate positions or leapfrogging.
 */
export async function moveZoneUp(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | DeleteZoneInput | string | unknown,
  formDataOrZoneId?: FormData | DeleteZoneInput | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = { spaceId: stateOrPayloadOrSpaceId, zoneId: formDataOrZoneId }
  } else if (
    formDataOrZoneId !== undefined &&
    (formDataOrZoneId instanceof FormData || typeof formDataOrZoneId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrZoneId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = deleteZoneSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Zone ID and Space ID are required.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const { data: zones, error } = await supabase
    .from('zones')
    .select('id, position, created_at')
    .eq('space_id', parsed.data.spaceId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !zones) {
    return {
      formError: 'We could not reorder zones. Please try again.',
      values: rawValues,
    }
  }

  const index = zones.findIndex((z) => z.id === parsed.data.zoneId)
  if (index === -1) {
    return {
      formError: 'Zone may not exist or you do not have permission',
      values: rawValues,
    }
  }

  if (index === 0) {
    return { success: true }
  }

  const targetIndex = index - 1
  const ordered = [...zones]
  const [moved] = ordered.splice(index, 1)
  if (!moved) return { success: true }
  ordered.splice(targetIndex, 0, moved)

  const zoneIds = ordered.map((z) => z.id)
  const { error: rpcError } = await supabase.rpc('reorder_zones', {
    p_space_id: parsed.data.spaceId,
    p_zone_ids: zoneIds,
  })

  if (rpcError) {
    const mapped = mapPostgresError(rpcError, 'zone')
    return { ...mapped, values: rawValues }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true }
}

/**
 * Moves a zone one step down in display order. Normalizes positions sequentially
 * to prevent duplicate positions or leapfrogging.
 */
export async function moveZoneDown(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | DeleteZoneInput | string | unknown,
  formDataOrZoneId?: FormData | DeleteZoneInput | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = { spaceId: stateOrPayloadOrSpaceId, zoneId: formDataOrZoneId }
  } else if (
    formDataOrZoneId !== undefined &&
    (formDataOrZoneId instanceof FormData || typeof formDataOrZoneId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrZoneId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = deleteZoneSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Zone ID and Space ID are required.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const { data: zones, error } = await supabase
    .from('zones')
    .select('id, position, created_at')
    .eq('space_id', parsed.data.spaceId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !zones) {
    return {
      formError: 'We could not reorder zones. Please try again.',
      values: rawValues,
    }
  }

  const index = zones.findIndex((z) => z.id === parsed.data.zoneId)
  if (index === -1) {
    return {
      formError: 'Zone may not exist or you do not have permission',
      values: rawValues,
    }
  }

  if (index >= zones.length - 1) {
    return { success: true }
  }

  const targetIndex = index + 1
  const ordered = [...zones]
  const [moved] = ordered.splice(index, 1)
  if (!moved) return { success: true }
  ordered.splice(targetIndex, 0, moved)

  const zoneIds = ordered.map((z) => z.id)
  const { error: rpcError } = await supabase.rpc('reorder_zones', {
    p_space_id: parsed.data.spaceId,
    p_zone_ids: zoneIds,
  })

  if (rpcError) {
    const mapped = mapPostgresError(rpcError, 'zone')
    return { ...mapped, values: rawValues }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true }
}

/**
 * Deletes a zone and cascades removal of its units.
 */
export async function deleteZone(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | DeleteZoneInput | string | unknown,
  formDataOrZoneId?: FormData | DeleteZoneInput | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = { spaceId: stateOrPayloadOrSpaceId, zoneId: formDataOrZoneId }
  } else if (
    formDataOrZoneId !== undefined &&
    (formDataOrZoneId instanceof FormData || typeof formDataOrZoneId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrZoneId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = deleteZoneSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Zone ID and Space ID are required.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const { data: deleted, error } = await supabase
    .from('zones')
    .delete()
    .eq('id', parsed.data.zoneId)
    .eq('space_id', parsed.data.spaceId)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapPostgresError(error, 'zone', { operation: 'delete' })
    return { ...mapped, values: rawValues }
  }

  if (!deleted) {
    return {
      formError: 'Zone may not exist or you do not have permission',
      values: rawValues,
    }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: { id: parsed.data.zoneId } }
}

// -----------------------------------------------------------------------------
// Unit Management Actions
// -----------------------------------------------------------------------------

/**
 * Adds a new unit to a zone on the snap grid. Supports positional arguments,
 * object payload, FormData, and useActionState.
 */
export async function addUnit(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | AddUnitInput | string | unknown,
  formDataOrZoneId?: FormData | AddUnitInput | string,
  unitType?: string,
  label?: string,
  capacity?: number | null,
  row?: number,
  col?: number,
  colSpan?: number,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = {
      spaceId: stateOrPayloadOrSpaceId,
      zoneId: formDataOrZoneId,
      unitType,
      label,
      capacity,
      row,
      col,
      colSpan,
    }
  } else if (
    formDataOrZoneId !== undefined &&
    (formDataOrZoneId instanceof FormData || typeof formDataOrZoneId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrZoneId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = addUnitSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  // Explicit columns only: no row, col, unitType, colSpan (PostgREST rejects them)
  const insertData = {
    space_id: parsed.data.spaceId,
    zone_id: parsed.data.zoneId,
    unit_type: parsed.data.unitType,
    label: parsed.data.label,
    capacity: parsed.data.capacity,
    grid_row: parsed.data.row,
    grid_col: parsed.data.col,
    col_span: parsed.data.colSpan,
  }

  const { data: createdUnit, error } = await supabase
    .from('units')
    .insert(insertData)
    .select(UNIT_SELECT_COLUMNS)
    .single()

  if (error) {
    const mapped = mapPostgresError(error, 'unit')
    return { ...mapped, values: rawValues }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: createdUnit }
}

/**
 * Updates a unit's details (label, capacity, type, zone, or coordinates).
 */
export async function updateUnit(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | UpdateUnitInput | string | unknown,
  formDataOrUnitId?: FormData | UpdateUnitInput | string,
  zoneId?: string,
  unitType?: string,
  label?: string,
  capacity?: number | null,
  row?: number,
  col?: number,
  colSpan?: number,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = {
      spaceId: stateOrPayloadOrSpaceId,
      unitId: formDataOrUnitId,
      zoneId,
      unitType,
      label,
      capacity,
      row,
      col,
      colSpan,
    }
  } else if (
    formDataOrUnitId !== undefined &&
    (formDataOrUnitId instanceof FormData || typeof formDataOrUnitId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrUnitId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = updateUnitSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const updateData: {
    zone_id?: string
    unit_type: 'seat' | 'standing_desk' | 'room'
    label: string
    capacity: number | null
    grid_row: number
    grid_col: number
    col_span: number
  } = {
    unit_type: parsed.data.unitType,
    label: parsed.data.label,
    capacity: parsed.data.capacity,
    grid_row: parsed.data.row,
    grid_col: parsed.data.col,
    col_span: parsed.data.colSpan,
  }
  if (parsed.data.zoneId) {
    updateData.zone_id = parsed.data.zoneId
  }

  const { data: updatedUnit, error } = await supabase
    .from('units')
    .update(updateData)
    .eq('id', parsed.data.unitId)
    .eq('space_id', parsed.data.spaceId)
    .select(UNIT_SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    let unitLabel = parsed.data.label
    if (error.code === 'P0001' && error.hint === 'unit_held') {
      const { data: originalUnit } = await supabase
        .from('units')
        .select('label')
        .eq('id', parsed.data.unitId)
        .eq('space_id', parsed.data.spaceId)
        .maybeSingle()
      if (originalUnit?.label) {
        unitLabel = originalUnit.label
      }
    }
    const mapped = mapPostgresError(error, 'unit', {
      unitLabel,
      operation: 'update',
    })
    return { ...mapped, values: rawValues }
  }

  if (!updatedUnit) {
    return {
      formError: 'Unit may not exist or you do not have permission',
      values: rawValues,
    }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: updatedUnit }
}

/**
 * Moves a unit to another cell or zone. Verifies space ownership and unit existence
 * prior to schema validation when colSpan is looked up. Writes only zone_id,
 * grid_row, and grid_col (never col_span).
 */
export async function moveUnit(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | MoveUnitInput | string | unknown,
  formDataOrUnitId?: FormData | MoveUnitInput | string,
  zoneId?: string,
  row?: number,
  col?: number,
  colSpan?: number,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = {
      spaceId: stateOrPayloadOrSpaceId,
      unitId: formDataOrUnitId,
      zoneId,
      row,
      col,
      colSpan,
    }
  } else if (
    formDataOrUnitId !== undefined &&
    (formDataOrUnitId instanceof FormData || typeof formDataOrUnitId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrUnitId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  let rawValues = getRawValues(payload)
  const spaceId = rawValues.spaceId as string | undefined
  const unitId = rawValues.unitId as string | undefined
  let currentSpan = rawValues.colSpan

  const { supabase, user } = await signedInClient()

  // Validate spaceId and unitId UUIDs first for ownership and unit lookup
  const spaceIdParsed = z.uuid().safeParse(spaceId)
  if (!spaceIdParsed.success) {
    return {
      fieldErrors: { spaceId: ['Space ID is required'] },
      formError: 'Space ID is required',
      values: rawValues,
    }
  }

  const isOwner = await verifySpaceOwner(supabase, spaceIdParsed.data, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const unitIdParsed = z.uuid().safeParse(unitId)
  if (!unitIdParsed.success) {
    return {
      fieldErrors: { unitId: ['Unit ID is required'] },
      formError: 'Unit ID is required',
      values: rawValues,
    }
  }

  // Lookup the unit to verify existence and get current col_span and label
  const { data: existingUnit, error: unitError } = await supabase
    .from('units')
    .select('label, col_span')
    .eq('id', unitIdParsed.data)
    .eq('space_id', spaceIdParsed.data)
    .maybeSingle()

  if (unitError || !existingUnit) {
    return {
      formError: 'Unit may not exist or you do not have permission',
      values: rawValues,
    }
  }

  if (currentSpan === undefined || currentSpan === '' || currentSpan === null) {
    currentSpan = existingUnit.col_span
    rawValues = { ...rawValues, colSpan: currentSpan }
  }

  const parseTarget =
    typeof FormData !== 'undefined' && payload instanceof FormData
      ? (() => {
          const fd = new FormData()
          for (const [k, v] of payload.entries()) fd.append(k, v)
          if (currentSpan !== undefined && !fd.has('colSpan')) {
            fd.append('colSpan', String(currentSpan))
          }
          return fd
        })()
      : { ...rawValues, colSpan: currentSpan }

  const parsed = moveUnitSchema.safeParse(parseTarget)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Please correct the errors in the form before saving.',
      values: rawValues,
    }
  }

  // Writes ONLY zone_id, grid_row, and grid_col (never the width / col_span)
  const { data: movedUnit, error } = await supabase
    .from('units')
    .update({
      zone_id: parsed.data.zoneId,
      grid_row: parsed.data.row,
      grid_col: parsed.data.col,
    })
    .eq('id', parsed.data.unitId)
    .eq('space_id', parsed.data.spaceId)
    .select(UNIT_SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    const mapped = mapPostgresError(error, 'unit', {
      unitLabel: existingUnit.label,
      operation: 'update',
    })
    return { ...mapped, values: rawValues }
  }

  if (!movedUnit) {
    return {
      formError: 'Unit may not exist or you do not have permission',
      values: rawValues,
    }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: movedUnit }
}

/**
 * Deletes a unit from a Space.
 */
export async function deleteUnit(
  stateOrPayloadOrSpaceId:
    SeatMapActionState | FormData | DeleteUnitInput | string | unknown,
  formDataOrUnitId?: FormData | DeleteUnitInput | string,
): Promise<SeatMapActionState> {
  let payload: unknown
  if (typeof stateOrPayloadOrSpaceId === 'string') {
    payload = { spaceId: stateOrPayloadOrSpaceId, unitId: formDataOrUnitId }
  } else if (
    formDataOrUnitId !== undefined &&
    (formDataOrUnitId instanceof FormData || typeof formDataOrUnitId === 'object') &&
    !(
      typeof stateOrPayloadOrSpaceId === 'object' &&
      stateOrPayloadOrSpaceId !== null &&
      'spaceId' in stateOrPayloadOrSpaceId
    )
  ) {
    payload = formDataOrUnitId
  } else {
    payload = stateOrPayloadOrSpaceId
  }

  const rawValues = getRawValues(payload)
  const parsed = deleteUnitSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: 'Unit ID and Space ID are required.',
      values: rawValues,
    }
  }

  const { supabase, user } = await signedInClient()
  const isOwner = await verifySpaceOwner(supabase, parsed.data.spaceId, user.id)
  if (!isOwner) {
    return {
      formError: 'Space may not exist or you do not have permission',
      values: rawValues,
    }
  }

  const { data: deleted, error } = await supabase
    .from('units')
    .delete()
    .eq('id', parsed.data.unitId)
    .eq('space_id', parsed.data.spaceId)
    .select('id')
    .maybeSingle()

  if (error) {
    let unitLabel: string | undefined
    if (error.code === 'P0001' && error.hint === 'unit_held') {
      const { data: existingUnit } = await supabase
        .from('units')
        .select('label')
        .eq('id', parsed.data.unitId)
        .eq('space_id', parsed.data.spaceId)
        .maybeSingle()
      if (existingUnit?.label) {
        unitLabel = existingUnit.label
      }
    }
    const mapped = mapPostgresError(error, 'unit', {
      unitLabel,
      operation: 'delete',
    })
    return { ...mapped, values: rawValues }
  }

  if (!deleted) {
    return {
      formError: 'Unit may not exist or you do not have permission',
      values: rawValues,
    }
  }

  revalidatePath(`/host/spaces/${parsed.data.spaceId}/seat-map`)
  return { success: true, data: { id: parsed.data.unitId } }
}

// -----------------------------------------------------------------------------
// Action Name Aliases
// -----------------------------------------------------------------------------

export const addZone = createZone
export const createZoneAction = createZone
export const addZoneAction = createZone

export const renameZoneAction = renameZone
export const updateZone = renameZone
export const updateZoneAction = renameZone

export const reorderZonesAction = reorderZones

export const moveZoneUpAction = moveZoneUp
export const moveZoneDownAction = moveZoneDown

export async function moveZoneUpForm(formData: FormData): Promise<void> {
  await moveZoneUp(formData)
}

export async function moveZoneDownForm(formData: FormData): Promise<void> {
  await moveZoneDown(formData)
}

export const deleteZoneAction = deleteZone

export const addUnitAction = addUnit
export const createUnit = addUnit
export const createUnitAction = addUnit

export const updateUnitAction = updateUnit

export const moveUnitAction = moveUnit

export const deleteUnitAction = deleteUnit
