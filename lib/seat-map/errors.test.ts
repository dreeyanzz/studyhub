import { describe, expect, it } from 'vitest'
import { mapPostgresError } from './errors'

describe('mapPostgresError (STORY-07 design §1, STORY-09 design §3)', () => {
  describe('STORY-09 hold refusal triggers (P0001)', () => {
    it('maps unit_held on zone delete (N17)', () => {
      const result = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'zone', {
        operation: 'delete',
      })
      expect(result.formError).toBe(
        'A unit here has an active hold. End it from the occupancy view, or wait for it to end.',
      )
    })

    it('maps unit_held on unit delete with explicit label (N17)', () => {
      const result = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        unitLabel: 'S4',
        operation: 'delete',
      })
      expect(result.formError).toBe(
        'S4 has an active hold. End it from the occupancy view, or wait for it to end.',
      )
    })

    it('maps unit_held on unit delete falling back to "This unit" when label is omitted or blank', () => {
      const noLabel = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        operation: 'delete',
      })
      expect(noLabel.formError).toBe(
        'This unit has an active hold. End it from the occupancy view, or wait for it to end.',
      )

      const emptyLabel = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        unitLabel: '   ',
        operation: 'delete',
      })
      expect(emptyLabel.formError).toBe(
        'This unit has an active hold. End it from the occupancy view, or wait for it to end.',
      )
    })

    it('maps unit_held on unit edit or move with explicit label (N23)', () => {
      const result = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        unitLabel: 'S4',
        operation: 'update',
      })
      expect(result.formError).toBe(
        "S4 has an active hold, so its label, type and place can't change until the hold ends.",
      )
    })

    it('maps unit_held on unit edit falling back to "This unit" when label is omitted or blank', () => {
      const noLabel = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        operation: 'update',
      })
      expect(noLabel.formError).toBe(
        "This unit has an active hold, so its label, type and place can't change until the hold ends.",
      )

      const emptyLabel = mapPostgresError({ code: 'P0001', hint: 'unit_held' }, 'unit', {
        unitLabel: '',
        operation: 'update',
      })
      expect(emptyLabel.formError).toBe(
        "This unit has an active hold, so its label, type and place can't change until the hold ends.",
      )
    })

    it('maps hours_cut_hold refusal (N22)', () => {
      const result = mapPostgresError({ code: 'P0001', hint: 'hours_cut_hold' })
      expect(result.formError).toBe(
        "A Seeker's hold runs past these hours. Change them after it ends.",
      )
    })
  })

  describe('PostgreSQL constraint and RLS errors (STORY-07)', () => {
    it('maps 23P01 exclusion violation to grid cell occupied error', () => {
      const result = mapPostgresError({ code: '23P01' }, 'unit')
      expect(result.formError).toBe('That grid cell is already occupied')
      expect(result.fieldErrors?.col).toContain('That grid cell is already occupied')
    })

    it('maps 23505 unique violation for units and zones', () => {
      const unitResult = mapPostgresError({ code: '23505' }, 'unit')
      expect(unitResult.formError).toBe(
        'A unit with this label already exists in this Space',
      )

      const zoneResult = mapPostgresError({ code: '23505' }, 'zone')
      expect(zoneResult.formError).toBe(
        'A zone with this name already exists in this Space',
      )
    })

    it('maps 42501 permission denied', () => {
      const result = mapPostgresError({ code: '42501' })
      expect(result.formError).toBe('Space may not exist or you do not have permission')
    })

    it('maps 23514 check constraint violation', () => {
      expect(mapPostgresError({ code: '23514' }, 'unit').formError).toBe(
        'Unit bounds or configuration are invalid',
      )
      expect(mapPostgresError({ code: '23514' }, 'zone').formError).toBe(
        'Zone configuration is invalid',
      )
    })

    it('maps 23503 foreign key violation', () => {
      expect(mapPostgresError({ code: '23503' }, 'unit').formError).toBe(
        'Zone may not exist or does not belong to this Space',
      )
      expect(mapPostgresError({ code: '23503' }, 'zone').formError).toBe(
        'Space may not exist or you do not have permission',
      )
    })

    it('maps unknown/unhandled errors to generic fallback message', () => {
      expect(mapPostgresError({ code: '99999' }, 'unit').formError).toBe(
        'We could not save this unit. Please try again.',
      )
      expect(mapPostgresError({ code: '99999' }, 'zone').formError).toBe(
        'We could not save this zone. Please try again.',
      )
    })
  })
})
