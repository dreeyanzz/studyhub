import { z } from 'zod'

/**
 * Zod schemas for map discovery and search query validation (STORY-08, FR-1.1, FR-1.2, D-027).
 *
 * Implements empty-string preprocessing to prevent "Null Island" coordinates (0, 0)
 * when query params are submitted empty (e.g., `?lat=&lng=`).
 */

export const priceTierSchema = z.enum(['free', 'budget', 'standard', 'premium'])
export type PriceTier = z.infer<typeof priceTierSchema>

export const unitTypeFilterSchema = z.enum(['seat', 'standing_desk', 'room'])
export type UnitTypeFilter = z.infer<typeof unitTypeFilterSchema>

export const hoursFilterSchema = z.enum(['open_now', 'open_late', 'open_24h'])
export type HoursFilter = z.infer<typeof hoursFilterSchema>

function preprocessArrayParam<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) return undefined
        if (typeof val === 'string') {
          if (val.includes(',')) {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          }
          const trimmed = val.trim()
          return trimmed ? [trimmed] : undefined
        }
        return val
      },
      z.union([itemSchema, z.array(itemSchema)]).optional(),
    )
    .transform((val) => {
      if (!val) return []
      return Array.isArray(val) ? val : [val]
    })
}

export const discoverySearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  lat: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90).optional(),
  ),
  lng: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180)
      .optional(),
  ),
  radiusKm: z
    .preprocess(
      (val) => (val === '' || val === null || val === undefined ? undefined : val),
      z.coerce
        .number()
        .min(0.5, 'Radius must be at least 0.5 km')
        .max(50, 'Radius cannot exceed 50 km')
        .optional(),
    )
    .default(10),
  tags: z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) return undefined
        if (typeof val === 'string') {
          if (val.includes(',')) {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          }
          const trimmed = val.trim()
          return trimmed ? [trimmed] : undefined
        }
        return val
      },
      z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
    )
    .transform((val) => {
      if (!val) return []
      return Array.isArray(val) ? val : [val]
    }),
  price: preprocessArrayParam(priceTierSchema),
  hours: preprocessArrayParam(hoursFilterSchema),
  unitType: preprocessArrayParam(unitTypeFilterSchema),
})

export type DiscoverySearchQuery = z.infer<typeof discoverySearchQuerySchema>
export type DiscoverySearchInput = z.input<typeof discoverySearchQuerySchema>
