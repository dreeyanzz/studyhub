import { z } from 'zod'

/**
 * Zod validation schemas for the seat map builder and Server Actions (STORY-07 design §2.3).
 *
 * All coordinates count from 0 in form values, Zod schemas, and the database.
 * Limits mirror check constraints on public.zones and public.units.
 */

// --- Base Field Schemas ---

export const zoneNameSchema = z
  .string({ error: 'Zone name is required' })
  .trim()
  .min(1, { error: 'Zone name is required' })
  .max(60, { error: 'Zone name must be 60 characters or fewer' })

export const zonePositionSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
  z
    .int({ error: 'Position must be an integer' })
    .min(0, { error: 'Position must be 0 or greater' }),
)

export const unitTypeSchema = z.enum(['seat', 'standing_desk', 'room'], {
  error: 'Unit type must be seat, standing desk, or room',
})

export const unitLabelSchema = z
  .string({ error: 'Unit label is required' })
  .trim()
  .min(1, { error: 'Unit label is required' })
  .max(12, { error: 'Unit label must be 12 characters or fewer' })

export const unitCapacitySchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
  z
    .int({ error: 'Capacity must be an integer' })
    .min(1, { error: 'Capacity must be between 1 and 50' })
    .max(50, { error: 'Capacity must be between 1 and 50' }),
)

export const gridRowSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
  z
    .int({ error: 'Row must be an integer' })
    .min(0, { error: 'Row must be between 0 and 49' })
    .max(49, { error: 'Row must be between 0 and 49' }),
)

export const gridColSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
  z
    .int({ error: 'Column must be an integer' })
    .min(0, { error: 'Column must be between 0 and 5' })
    .max(5, { error: 'Column must be between 0 and 5' }),
)

export const colSpanSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
  z
    .int({ error: 'Column span must be an integer' })
    .min(1, { error: 'Column span must be between 1 and 3' })
    .max(3, { error: 'Column span must be between 1 and 3' }),
)

// --- Helper for FormData & Action ID Normalization ---

function normalizeActionIds(val: unknown): unknown {
  if (typeof FormData !== 'undefined' && val instanceof FormData) {
    val = Object.fromEntries(val.entries())
  }
  if (typeof val === 'object' && val !== null) {
    const v = { ...(val as Record<string, unknown>) }
    if ('space_id' in v && !('spaceId' in v)) v.spaceId = v.space_id
    if ('zone_id' in v && !('zoneId' in v)) v.zoneId = v.zone_id
    if ('unit_id' in v && !('unitId' in v)) v.unitId = v.unit_id
    return v
  }
  return val
}

// --- Cell Coordinate Schema ---

export const cellCoordinateSchema = z.preprocess(
  (val) => {
    if (typeof FormData !== 'undefined' && val instanceof FormData) {
      val = Object.fromEntries(val.entries())
    }
    if (typeof val === 'object' && val !== null) {
      const v = { ...(val as Record<string, unknown>) }
      if ('grid_row' in v && !('row' in v)) v.row = v.grid_row
      if ('row' in v && !('grid_row' in v)) v.grid_row = v.row
      if ('grid_col' in v && !('col' in v)) v.col = v.grid_col
      if ('col' in v && !('grid_col' in v)) v.grid_col = v.col
      if ('col_span' in v && !('colSpan' in v)) v.colSpan = v.col_span
      if ('colSpan' in v && !('col_span' in v)) v.col_span = v.colSpan
      return v
    }
    return val
  },
  z
    .object({
      row: gridRowSchema,
      grid_row: gridRowSchema.optional(),
      col: gridColSchema,
      grid_col: gridColSchema.optional(),
      colSpan: colSpanSchema.default(1),
      col_span: colSpanSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const span = data.colSpan ?? data.col_span ?? 1
      const col = data.col ?? data.grid_col ?? 0
      if (col + span > 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'Unit must fit within the 6 grid columns',
          path: ['colSpan'],
        })
      }
    }),
)

export type CellCoordinateInput = z.infer<typeof cellCoordinateSchema>

// --- Zone Schema ---

export const zoneSchema = z.preprocess(
  (val) => {
    if (typeof FormData !== 'undefined' && val instanceof FormData) {
      val = Object.fromEntries(val.entries())
    }
    return val
  },
  z.object({
    name: zoneNameSchema,
    position: zonePositionSchema.default(0),
  }),
)

export type ZoneInput = z.infer<typeof zoneSchema>

// --- Unit Schema ---

function normalizeUnitInput(val: unknown) {
  if (typeof FormData !== 'undefined' && val instanceof FormData) {
    val = Object.fromEntries(val.entries())
  }
  if (typeof val === 'object' && val !== null) {
    const v = { ...(val as Record<string, unknown>) }
    if ('unit_type' in v && !('unitType' in v)) v.unitType = v.unit_type
    if ('unitType' in v && !('unit_type' in v)) v.unit_type = v.unitType
    if ('grid_row' in v && !('row' in v)) v.row = v.grid_row
    if ('row' in v && !('grid_row' in v)) v.grid_row = v.row
    if ('grid_col' in v && !('col' in v)) v.col = v.grid_col
    if ('col' in v && !('grid_col' in v)) v.grid_col = v.col
    if ('col_span' in v && !('colSpan' in v)) v.colSpan = v.col_span
    if ('colSpan' in v && !('col_span' in v)) v.col_span = v.colSpan
    if (!('col_span' in v) && !('colSpan' in v)) {
      v.colSpan = 1
      v.col_span = 1
    }
    if (typeof v.capacity === 'string') {
      v.capacity = v.capacity.trim() === '' ? null : Number(v.capacity)
    }
    if (!('capacity' in v)) {
      v.capacity = null
    }
    return v
  }
  return val
}

export const unitSchema = z.preprocess(
  normalizeUnitInput,
  z
    .object({
      unitType: unitTypeSchema,
      unit_type: unitTypeSchema.optional(),
      label: unitLabelSchema,
      capacity: unitCapacitySchema.nullable().default(null),
      row: gridRowSchema,
      grid_row: gridRowSchema.optional(),
      col: gridColSchema,
      grid_col: gridColSchema.optional(),
      colSpan: colSpanSchema.default(1),
      col_span: colSpanSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const type = data.unitType ?? data.unit_type
      const span = data.colSpan ?? data.col_span ?? 1
      const col = data.col ?? data.grid_col ?? 0

      if (type === 'room') {
        if (data.capacity === null || data.capacity === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Room capacity is required',
            path: ['capacity'],
          })
        }
        if (span !== 2 && span !== 3) {
          ctx.addIssue({
            code: 'custom',
            message: 'A room must span 2 or 3 columns',
            path: ['colSpan'],
          })
        }
      } else if (type === 'seat' || type === 'standing_desk') {
        if (data.capacity !== null && data.capacity !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Seats and standing desks cannot have a capacity',
            path: ['capacity'],
          })
        }
        if (span !== 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'Seats and standing desks must span exactly 1 column',
            path: ['colSpan'],
          })
        }
      }

      if (col + span > 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'Unit must fit within the 6 grid columns',
          path: ['colSpan'],
        })
      }
    }),
)

export type UnitInput = z.infer<typeof unitSchema>

// --- Action & Form Schemas ---

export const createZoneSchema = z.preprocess(
  normalizeActionIds,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    name: zoneNameSchema,
    position: zonePositionSchema.default(0),
  }),
)

export type CreateZoneInput = z.infer<typeof createZoneSchema>

export const updateZoneSchema = z.preprocess(
  normalizeActionIds,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    zoneId: z.uuid({ error: 'Zone ID is required' }),
    name: zoneNameSchema,
  }),
)

export const renameZoneSchema = updateZoneSchema
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>

export const reorderZonesSchema = z.preprocess(
  (val) => {
    const v = normalizeActionIds(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (typeof obj.zoneOrders === 'string') {
        try {
          obj.zoneOrders = JSON.parse(obj.zoneOrders)
        } catch {}
      }
      if (typeof obj.zoneIds === 'string') {
        try {
          obj.zoneIds = JSON.parse(obj.zoneIds)
        } catch {}
      }
      return obj
    }
    return v
  },
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      zoneOrders: z
        .array(
          z.object({
            zoneId: z.uuid({ error: 'Invalid zone ID' }),
            position: zonePositionSchema,
          }),
        )
        .optional(),
      zoneIds: z.array(z.uuid({ error: 'Invalid zone ID' })).optional(),
    })
    .refine((data) => data.zoneOrders !== undefined || data.zoneIds !== undefined, {
      error: 'Either zoneOrders or zoneIds must be provided',
    }),
)

export type ReorderZonesInput = z.infer<typeof reorderZonesSchema>

export const deleteZoneSchema = z.preprocess(
  normalizeActionIds,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    zoneId: z.uuid({ error: 'Zone ID is required' }),
  }),
)

export type DeleteZoneInput = z.infer<typeof deleteZoneSchema>

export const addUnitSchema = z.preprocess(
  normalizeActionIds,
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      zoneId: z.uuid({ error: 'Zone ID is required' }),
    })
    .and(unitSchema),
)

export type AddUnitInput = z.infer<typeof addUnitSchema>

export const updateUnitSchema = z.preprocess(
  normalizeActionIds,
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      unitId: z.uuid({ error: 'Unit ID is required' }),
      zoneId: z.uuid({ error: 'Zone ID is required' }).optional(),
    })
    .and(unitSchema),
)

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

export const moveUnitSchema = z.preprocess(
  (val) => {
    const v = normalizeActionIds(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if ('grid_row' in obj && !('row' in obj)) obj.row = obj.grid_row
      if ('grid_col' in obj && !('col' in obj)) obj.col = obj.grid_col
      return obj
    }
    return v
  },
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    unitId: z.uuid({ error: 'Unit ID is required' }),
    zoneId: z.uuid({ error: 'Zone ID is required' }),
    row: gridRowSchema,
    col: gridColSchema,
  }),
)

export type MoveUnitInput = z.infer<typeof moveUnitSchema>

export const deleteUnitSchema = z.preprocess(
  normalizeActionIds,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    unitId: z.uuid({ error: 'Unit ID is required' }),
  }),
)

export type DeleteUnitInput = z.infer<typeof deleteUnitSchema>

export const unitFormSchema = z.preprocess(
  (val) => {
    const v = normalizeActionIds(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (typeof obj.spaceId === 'string' && obj.spaceId.trim() === '') delete obj.spaceId
      if (typeof obj.zoneId === 'string' && obj.zoneId.trim() === '') delete obj.zoneId
      if (typeof obj.unitId === 'string' && obj.unitId.trim() === '') delete obj.unitId
      return obj
    }
    return v
  },
  z
    .object({
      spaceId: z.uuid({ error: 'Invalid Space ID' }).optional(),
      zoneId: z.uuid({ error: 'Invalid Zone ID' }).optional(),
      unitId: z.uuid({ error: 'Invalid Unit ID' }).optional(),
    })
    .and(unitSchema),
)

export type UnitFormInput = z.infer<typeof unitFormSchema>
