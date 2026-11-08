// Pure mapping from Postgres error codes to the seat map builder's messages
// (STORY-07 design §1). It lives outside actions.ts because a 'use server' file may
// export only async functions: Next refuses to build one that exports anything else
// once a Client Component imports it (TSK-07.6).

/**
 * Maps PostgreSQL error codes from constraint violations and RLS refusals to
 * user-friendly error messages (STORY-07 design §1 sequence diagram).
 */
export function mapPostgresError(
  error: { code?: string; message?: string },
  context: 'unit' | 'zone' = 'unit',
): { formError: string; fieldErrors?: Record<string, string[]> } {
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
