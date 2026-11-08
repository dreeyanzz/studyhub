import { z } from 'zod'

/**
 * Zod validation schemas for the seat map builder and Server Actions (STORY-07 design §2.3).
 *
 * All coordinates count from 0 in form values, Zod schemas, and the database.
 * Limits accurately mirror check constraints on public.zones and public.units.
 * Error messages count rows and columns from 1, as the page does (design §3).
 */

// --- Base Field Schemas & Preprocessors ---

/**
 * Preprocesses empty strings, null, and undefined to undefined, and numeric strings to numbers.
 */
export function toIntOrUndefined(val: unknown): unknown {
  if (val === '' || val === null || val === undefined) return undefined
  if (typeof val === 'string' && val.trim() !== '') return Number(val)
  return val
}

export const zoneNameSchema = z
  .string({ error: 'Zone name is required' })
  .trim()
  .min(1, { error: 'Zone name is required' })
  .max(60, { error: 'Zone name must be 60 characters or fewer' })

export const zonePositionSchema = z.preprocess(
  toIntOrUndefined,
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
  toIntOrUndefined,
  z
    .int({ error: 'Capacity must be an integer' })
    .min(1, { error: 'Capacity must be between 1 and 50' })
    .max(50, { error: 'Capacity must be between 1 and 50' }),
)

export const gridRowSchema = z.preprocess(
  toIntOrUndefined,
  z
    .int({ error: 'Row must be an integer' })
    .min(0, { error: 'Row must be between 1 and 50' })
    .max(49, { error: 'Row must be between 1 and 50' }),
)

export const gridColSchema = z.preprocess(
  toIntOrUndefined,
  z
    .int({ error: 'Column must be an integer' })
    .min(0, { error: 'Column must be between 1 and 6' })
    .max(5, { error: 'Column must be between 1 and 6' }),
)

export const colSpanSchema = z.preprocess(
  toIntOrUndefined,
  z
    .int({ error: 'Column span must be an integer' })
    .min(1, { error: 'Column span must be between 1 and 3' })
    .max(3, { error: 'Column span must be between 1 and 3' }),
)

// --- Helper for FormData to Plain Object ---

function toPlainObject(val: unknown): unknown {
  if (typeof FormData !== 'undefined' && val instanceof FormData) {
    return Object.fromEntries(val.entries())
  }
  return val
}

// --- Cell Coordinate Schema ---

export const cellCoordinateSchema = z.preprocess(
  (val) => {
    const v = toPlainObject(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (obj.colSpan === '' || obj.colSpan === null) delete obj.colSpan
      return obj
    }
    return v
  },
  z
    .object({
      row: gridRowSchema,
      col: gridColSchema,
      colSpan: colSpanSchema.default(1),
    })
    .superRefine((data, ctx) => {
      if (data.col + data.colSpan > 6) {
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
    const v = toPlainObject(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (obj.position === '' || obj.position === null) delete obj.position
      return obj
    }
    return v
  },
  z.object({
    name: zoneNameSchema,
    position: zonePositionSchema.default(0),
  }),
)

export type ZoneInput = z.infer<typeof zoneSchema>

// --- Unit Schema ---

function normalizeUnitInput(val: unknown) {
  const v = toPlainObject(val)
  if (typeof v === 'object' && v !== null) {
    const obj = { ...(v as Record<string, unknown>) }

    // Empty string colSpan becomes undefined so defaults can apply
    if (obj.colSpan === '' || obj.colSpan === null) delete obj.colSpan

    // Empty string capacity from form input becomes null or undefined
    if (obj.capacity === '' || obj.capacity === undefined) {
      if (obj.unitType === 'seat' || obj.unitType === 'standing_desk') {
        obj.capacity = null
      } else {
        delete obj.capacity
      }
    }

    return obj
  }
  return v
}

const baseUnitObject = z.object({
  unitType: unitTypeSchema,
  label: unitLabelSchema,
  capacity: z.preprocess(
    toIntOrUndefined,
    z
      .int({ error: 'Capacity must be an integer' })
      .min(1, { error: 'Capacity must be between 1 and 50' })
      .max(50, { error: 'Capacity must be between 1 and 50' })
      .nullable()
      .optional(),
  ),
  row: gridRowSchema,
  col: gridColSchema,
  colSpan: colSpanSchema.optional(),
})

export const unitSchema = z.preprocess(
  normalizeUnitInput,
  baseUnitObject
    .transform((data) => {
      const type = data.unitType
      const span = data.colSpan ?? (type === 'room' ? 2 : 1)
      const row = data.row
      const col = data.col
      const cap = data.capacity ?? null

      return {
        unitType: type,
        label: data.label,
        capacity: cap,
        row,
        col,
        colSpan: span,
      }
    })
    .superRefine((data, ctx) => {
      const { unitType, capacity, col, colSpan } = data
      const span = colSpan

      if (unitType === 'room') {
        if (capacity === null || capacity === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Room capacity is required',
            path: ['capacity'],
          })
        }
        if (span !== 2 && span !== 3) {
          ctx.addIssue({
            code: 'custom',
            message: 'A whole room must span 2 or 3 columns',
            path: ['colSpan'],
          })
        }
      } else {
        if (capacity !== null && capacity !== undefined) {
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
  (val) => {
    const v = toPlainObject(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (obj.position === '' || obj.position === null) delete obj.position
      return obj
    }
    return v
  },
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    name: zoneNameSchema,
    position: zonePositionSchema.default(0),
  }),
)

export type CreateZoneInput = z.infer<typeof createZoneSchema>

export const updateZoneSchema = z.preprocess(
  (val) => {
    const v = toPlainObject(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }
      if (obj.position === '' || obj.position === null) delete obj.position
      return obj
    }
    return v
  },
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    zoneId: z.uuid({ error: 'Zone ID is required' }),
    name: zoneNameSchema,
    position: zonePositionSchema.optional(),
  }),
)

export const renameZoneSchema = updateZoneSchema
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>

export const reorderZonesSchema = z.preprocess(
  (val) => {
    const v = toPlainObject(val)
    if (typeof v === 'object' && v !== null) {
      const obj = { ...(v as Record<string, unknown>) }

      if (typeof obj.zoneOrders === 'string') {
        const trimmed = obj.zoneOrders.trim()
        if (trimmed === '') {
          delete obj.zoneOrders
        } else {
          try {
            obj.zoneOrders = JSON.parse(trimmed)
          } catch {}
        }
      }
      if (typeof obj.zoneIds === 'string') {
        const trimmed = obj.zoneIds.trim()
        if (trimmed === '') {
          delete obj.zoneIds
        } else {
          try {
            obj.zoneIds = JSON.parse(trimmed)
          } catch {}
        }
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
  toPlainObject,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    zoneId: z.uuid({ error: 'Zone ID is required' }),
  }),
)

export type DeleteZoneInput = z.infer<typeof deleteZoneSchema>

export const addUnitSchema = z.preprocess(
  toPlainObject,
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      zoneId: z.uuid({ error: 'Zone ID is required' }),
    })
    .and(unitSchema),
)

export type AddUnitInput = z.infer<typeof addUnitSchema>

export const updateUnitSchema = z.preprocess(
  toPlainObject,
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      unitId: z.uuid({ error: 'Unit ID is required' }),
      zoneId: z.uuid({ error: 'Zone ID is required' }).optional(),
    })
    .and(unitSchema),
)

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

// colSpan is the unit's current width. It is required, not defaulted to 1, so
// the right edge (col_bounds: grid_col + col_span <= 6) is checked for a whole
// room too. It is only for that check: moveUnit writes the position, not the width.
export const moveUnitSchema = z.preprocess(
  toPlainObject,
  z
    .object({
      spaceId: z.uuid({ error: 'Space ID is required' }),
      unitId: z.uuid({ error: 'Unit ID is required' }),
      zoneId: z.uuid({ error: 'Zone ID is required' }),
      row: gridRowSchema,
      col: gridColSchema,
      colSpan: colSpanSchema,
    })
    .refine((data) => data.col + data.colSpan <= 6, {
      error: 'Unit must fit within the 6 grid columns',
      path: ['col'],
    }),
)

export type MoveUnitInput = z.infer<typeof moveUnitSchema>

export const deleteUnitSchema = z.preprocess(
  toPlainObject,
  z.object({
    spaceId: z.uuid({ error: 'Space ID is required' }),
    unitId: z.uuid({ error: 'Unit ID is required' }),
  }),
)

export type DeleteUnitInput = z.infer<typeof deleteUnitSchema>

export const unitFormSchema = z.preprocess(
  (val) => {
    const v = toPlainObject(val)
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
