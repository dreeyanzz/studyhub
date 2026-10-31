import { z } from 'zod'

/**
 * Unit states that a Host can directly set (FR-3.2, D-004).
 * A Host can set available, reserved, or occupied.
 * 'pending_payment' is intentionally excluded because it can only be set
 * by an online Seeker hold (D-004, N12).
 */
export const unitStateEnum = z.enum(['available', 'reserved', 'occupied'], {
  error: 'State must be available, reserved, or occupied',
})

export type UnitState = z.infer<typeof unitStateEnum>

export const expectedReservationStatusEnum = z.enum(
  ['pending_payment', 'reserved', 'occupied'],
  {
    error: 'Invalid expected reservation status',
  },
)

export type ExpectedReservationStatus = z.infer<typeof expectedReservationStatusEnum>

/**
 * Validation schema for the setUnitState Server Action (STORY-12 design §2).
 *
 * Validates the unitId and target state, and requires that expectedReservationId
 * and expectedReservationStatus are either both provided (for hold overrides, D-050)
 * or both omitted (for walk-ins or Host-set units).
 */
export const setUnitStateSchema = z
  .object({
    unitId: z.uuid({ error: 'Invalid unit ID' }),
    state: unitStateEnum,
    expectedReservationId: z
      .uuid({ error: 'Invalid reservation ID' })
      .optional()
      .nullable(),
    expectedReservationStatus: expectedReservationStatusEnum.optional().nullable(),
  })
  .refine(
    (data) =>
      (data.expectedReservationId == null && data.expectedReservationStatus == null) ||
      (data.expectedReservationId != null && data.expectedReservationStatus != null),
    {
      error: 'Expected reservation ID and status must be provided together',
      path: ['expectedReservationId'],
    },
  )

export type SetUnitStateInput = z.infer<typeof setUnitStateSchema>
