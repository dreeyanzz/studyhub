// Pure mapping from Postgres error codes to the seat map builder's messages
// (STORY-07 design §1). It lives outside actions.ts because a 'use server' file may
// export only async functions: Next refuses to build one that exports anything else
// once a Client Component imports it (TSK-07.6).

export interface MapPostgresErrorOptions {
  unitLabel?: string
  operation?: 'create' | 'update' | 'delete'
}

/**
 * Maps PostgreSQL error codes from constraint violations, RLS refusals, and STORY-09
 * hold refusal triggers to user-friendly error messages (STORY-07 design §1, STORY-09 design §3).
 */
export function mapPostgresError(
  error: { code?: string; message?: string; hint?: string },
  context: 'unit' | 'zone' = 'unit',
  options?: MapPostgresErrorOptions,
): { formError: string; fieldErrors?: Record<string, string[]> } {
  if (error.code === 'P0001') {
    if (error.hint === 'unit_held') {
      if (context === 'zone') {
        return {
          formError:
            'A unit here has an active hold. End it from the occupancy view, or wait for it to end.',
        }
      }
      const label = options?.unitLabel ?? 'This unit'
      if (options?.operation === 'delete') {
        return {
          formError: `${label} has an active hold. End it from the occupancy view, or wait for it to end.`,
        }
      }
      return {
        formError: `${label} has an active hold, so its label, type and place can't change until the hold ends.`,
      }
    }
    if (error.hint === 'hours_cut_hold') {
      return {
        formError: "A Seeker's hold runs past these hours. Change them after it ends.",
      }
    }
  }

  switch (error.code) {
    case '23P01':
      // Exclusion violation: overlapping cells on the snap grid
      return {
        formError: 'That grid cell is already occupied',
        fieldErrors: {
          col: ['That grid cell is already occupied'],
          row: ['That grid cell is already occupied'],
          grid_col: ['That grid cell is already occupied'],
          grid_row: ['That grid cell is already occupied'],
        },
      }
    case '23505':
      // Unique violation: duplicate label or zone name in Space
      if (context === 'zone') {
        return {
          formError: 'A zone with this name already exists in this Space',
          fieldErrors: {
            name: ['A zone with this name already exists in this Space'],
          },
        }
      }
      return {
        formError: 'A unit with this label already exists in this Space',
        fieldErrors: {
          label: ['A unit with this label already exists in this Space'],
        },
      }
    case '42501':
      // RLS refusal or unauthorized action
      return {
        formError: 'Space may not exist or you do not have permission',
      }
    case '23514':
      // Check constraint violation (e.g. col_bounds, capacity_matches_type, col_span_matches_type)
      return {
        formError:
          context === 'zone'
            ? 'Zone configuration is invalid'
            : 'Unit bounds or configuration are invalid',
      }
    case '23503':
      // Foreign key violation
      return {
        formError:
          context === 'zone'
            ? 'Space may not exist or you do not have permission'
            : 'Zone may not exist or does not belong to this Space',
      }
    default:
      return {
        formError:
          context === 'zone'
            ? 'We could not save this zone. Please try again.'
            : 'We could not save this unit. Please try again.',
      }
  }
}
