import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  addUnitSchema,
  cellCoordinateSchema,
  colSpanSchema,
  createZoneSchema,
  deleteUnitSchema,
  deleteZoneSchema,
  gridColSchema,
  gridRowSchema,
  moveUnitSchema,
  reorderZonesSchema,
  unitCapacitySchema,
  unitFormSchema,
  unitLabelSchema,
  unitSchema,
  unitTypeSchema,
  updateUnitSchema,
  updateZoneSchema,
  zoneNameSchema,
  zonePositionSchema,
  zoneSchema,
} from './seat-map'

const validSpaceId = '11111111-1111-4111-8111-111111111111'
const validZoneId = '22222222-2222-4222-8222-222222222222'
const validUnitId = '33333333-3333-4333-8333-333333333333'

describe('zoneNameSchema', () => {
  it('passes a 1-character and 60-character zone name', () => {
    expect(zoneNameSchema.safeParse('A').success).toBe(true)
    expect(zoneNameSchema.safeParse('A'.repeat(60)).success).toBe(true)
  })

  it('trims surrounding whitespace before counting length', () => {
    const result = zoneNameSchema.safeParse('   Quiet Desks   ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('Quiet Desks')
    }
  })

  it('rejects empty or whitespace-only zone name', () => {
    for (const empty of ['', '   ', '\t\n']) {
      const result = zoneNameSchema.safeParse(empty)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(z.flattenError(result.error).formErrors).toContain('Zone name is required')
      }
    }
  })

  it('rejects zone name exceeding 60 characters', () => {
    const result = zoneNameSchema.safeParse('A'.repeat(61))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).formErrors).toContain(
        'Zone name must be 60 characters or fewer',
      )
    }
  })
})

describe('zonePositionSchema', () => {
  it('passes non-negative integers', () => {
    expect(zonePositionSchema.safeParse(0).success).toBe(true)
    expect(zonePositionSchema.safeParse(5).success).toBe(true)
  })

  it('accepts string numbers from HTML form inputs', () => {
    const parsed = zonePositionSchema.safeParse('0')
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toBe(0)
    }
    expect(zonePositionSchema.safeParse('3').success).toBe(true)
  })

  it('rejects negative numbers and non-integers', () => {
    expect(zonePositionSchema.safeParse(-1).success).toBe(false)
    expect(zonePositionSchema.safeParse(1.5).success).toBe(false)
    expect(zonePositionSchema.safeParse('-2').success).toBe(false)
    expect(zonePositionSchema.safeParse('abc').success).toBe(false)
  })
})

describe('zoneSchema', () => {
  it('passes valid zone and defaults position to 0 if omitted', () => {
    const result = zoneSchema.safeParse({ name: 'Quiet desks' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'Quiet desks', position: 0 })
    }
  })

  it('supports FormData input', () => {
    const formData = new FormData()
    formData.set('name', 'Standing area')
    formData.set('position', '2')
    const result = zoneSchema.safeParse(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'Standing area', position: 2 })
    }
  })
})

describe('unitTypeSchema', () => {
  it('accepts only seat, standing_desk, and room', () => {
    expect(unitTypeSchema.safeParse('seat').success).toBe(true)
    expect(unitTypeSchema.safeParse('standing_desk').success).toBe(true)
    expect(unitTypeSchema.safeParse('room').success).toBe(true)
    expect(unitTypeSchema.safeParse('couch').success).toBe(false)
  })
})

describe('unitLabelSchema', () => {
  it('passes 1-character and 12-character labels', () => {
    expect(unitLabelSchema.safeParse('S').success).toBe(true)
    expect(unitLabelSchema.safeParse('L'.repeat(12)).success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = unitLabelSchema.safeParse('  S1  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('S1')
    }
  })

  it('rejects empty or whitespace-only labels', () => {
    const result = unitLabelSchema.safeParse('   ')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).formErrors).toContain('Unit label is required')
    }
  })

  it('rejects labels longer than 12 characters', () => {
    const result = unitLabelSchema.safeParse('L'.repeat(13))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).formErrors).toContain(
        'Unit label must be 12 characters or fewer',
      )
    }
  })
})

describe('unitCapacitySchema', () => {
  it('passes capacities between 1 and 50', () => {
    expect(unitCapacitySchema.safeParse(1).success).toBe(true)
    expect(unitCapacitySchema.safeParse(50).success).toBe(true)
    expect(unitCapacitySchema.safeParse(6).success).toBe(true)
  })

  it('accepts string numbers from HTML inputs', () => {
    const parsed = unitCapacitySchema.safeParse('6')
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toBe(6)
    }
  })

  it('rejects capacity below 1, above 50, or non-integer', () => {
    expect(unitCapacitySchema.safeParse(0).success).toBe(false)
    expect(unitCapacitySchema.safeParse(-5).success).toBe(false)
    expect(unitCapacitySchema.safeParse(51).success).toBe(false)
    expect(unitCapacitySchema.safeParse(4.5).success).toBe(false)
    expect(unitCapacitySchema.safeParse('60').success).toBe(false)
    expect(unitCapacitySchema.safeParse('abc').success).toBe(false)
  })
})

describe('gridRowSchema and gridColSchema', () => {
  it('validates row bounds (0 to 49)', () => {
    expect(gridRowSchema.safeParse(0).success).toBe(true)
    expect(gridRowSchema.safeParse('0').success).toBe(true)
    expect(gridRowSchema.safeParse(49).success).toBe(true)
    expect(gridRowSchema.safeParse('49').success).toBe(true)
    expect(gridRowSchema.safeParse(-1).success).toBe(false)
    expect(gridRowSchema.safeParse(50).success).toBe(false)
  })

  it('validates column bounds (0 to 5)', () => {
    expect(gridColSchema.safeParse(0).success).toBe(true)
    expect(gridColSchema.safeParse('0').success).toBe(true)
    expect(gridColSchema.safeParse(5).success).toBe(true)
    expect(gridColSchema.safeParse('5').success).toBe(true)
    expect(gridColSchema.safeParse(-1).success).toBe(false)
    expect(gridColSchema.safeParse(6).success).toBe(false)
  })

  it('validates column span bounds (1 to 3)', () => {
    expect(colSpanSchema.safeParse(1).success).toBe(true)
    expect(colSpanSchema.safeParse('1').success).toBe(true)
    expect(colSpanSchema.safeParse(3).success).toBe(true)
    expect(colSpanSchema.safeParse('3').success).toBe(true)
    expect(colSpanSchema.safeParse(0).success).toBe(false)
    expect(colSpanSchema.safeParse(4).success).toBe(false)
  })
})

describe('cellCoordinateSchema', () => {
  it('passes valid coordinates within 6 columns', () => {
    const result = cellCoordinateSchema.safeParse({ row: 0, col: 3, colSpan: 3 })
    expect(result.success).toBe(true)
  })

  it('rejects coordinates exceeding 6 columns (col + colSpan > 6)', () => {
    const result = cellCoordinateSchema.safeParse({ row: 0, col: 4, colSpan: 3 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.colSpan).toContain(
        'Unit must fit within the 6 grid columns',
      )
    }
  })

  it('supports snake_case grid_row, grid_col, col_span and string values', () => {
    const result = cellCoordinateSchema.safeParse({
      grid_row: '2',
      grid_col: '1',
      col_span: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.row).toBe(2)
      expect(result.data.col).toBe(1)
      expect(result.data.colSpan).toBe(2)
    }
  })
})

describe('unitSchema', () => {
  it('passes a valid seat with colSpan 1 and null capacity', () => {
    const result = unitSchema.safeParse({
      unitType: 'seat',
      label: 'S1',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 1,
    })
    expect(result.success).toBe(true)
  })

  it('passes a valid standing desk and defaults colSpan to 1 and capacity to null', () => {
    const result = unitSchema.safeParse({
      unitType: 'standing_desk',
      label: 'D1',
      row: 1,
      col: 2,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.colSpan).toBe(1)
      expect(result.data.capacity).toBeNull()
    }
  })

  it('passes a valid room with capacity and colSpan 2 or 3', () => {
    const roomA = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 6,
      row: 0,
      col: 0,
      colSpan: 3,
    })
    expect(roomA.success).toBe(true)

    const roomB = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room B',
      capacity: 4,
      row: 0,
      col: 3,
      colSpan: 2,
    })
    expect(roomB.success).toBe(true)
  })

  it('accepts string numbers and FormData directly', () => {
    const fd = new FormData()
    fd.set('unitType', 'seat')
    fd.set('label', 'S1')
    fd.set('row', '0')
    fd.set('col', '2')
    const result = unitSchema.safeParse(fd)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.row).toBe(0)
      expect(result.data.col).toBe(2)
      expect(result.data.colSpan).toBe(1)
      expect(result.data.capacity).toBeNull()
    }
  })

  it('rejects a seat or standing desk with a non-null capacity', () => {
    const result = unitSchema.safeParse({
      unitType: 'seat',
      label: 'S1',
      capacity: 1,
      row: 0,
      col: 0,
      colSpan: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.capacity).toContain(
        'Seats and standing desks cannot have a capacity',
      )
    }
  })

  it('rejects a seat or standing desk spanning more than 1 column', () => {
    const result = unitSchema.safeParse({
      unitType: 'standing_desk',
      label: 'D1',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 2,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.colSpan).toContain(
        'Seats and standing desks must span exactly 1 column',
      )
    }
  })

  it('rejects a room with missing, null, or out-of-range capacity', () => {
    const missingCap = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 3,
    })
    expect(missingCap.success).toBe(false)
    if (!missingCap.success) {
      expect(z.flattenError(missingCap.error).fieldErrors.capacity).toContain(
        'Room capacity is required',
      )
    }

    const invalidCap = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 60,
      row: 0,
      col: 0,
      colSpan: 3,
    })
    expect(invalidCap.success).toBe(false)
  })

  it('rejects a room spanning 1 column', () => {
    const result = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 4,
      row: 0,
      col: 0,
      colSpan: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.colSpan).toContain(
        'A room must span 2 or 3 columns',
      )
    }
  })

  it('rejects a unit where col + colSpan > 6', () => {
    const result = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 6,
      row: 0,
      col: 4,
      colSpan: 3,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.colSpan).toContain(
        'Unit must fit within the 6 grid columns',
      )
    }
  })

  it('supports snake_case unit_type, grid_row, grid_col, col_span', () => {
    const result = unitSchema.safeParse({
      unit_type: 'seat',
      label: 'S1',
      grid_row: 2,
      grid_col: 3,
      col_span: 1,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitType).toBe('seat')
      expect(result.data.unit_type).toBe('seat')
      expect(result.data.row).toBe(2)
      expect(result.data.col).toBe(3)
    }
  })
})

describe('Server Action form schemas', () => {
  it('validates createZoneSchema with string position and snake_case space_id', () => {
    const valid = createZoneSchema.safeParse({
      space_id: validSpaceId,
      name: 'Quiet desks',
      position: '0',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.spaceId).toBe(validSpaceId)
      expect(valid.data.position).toBe(0)
    }

    const invalid = createZoneSchema.safeParse({
      spaceId: 'not-a-uuid',
      name: '',
    })
    expect(invalid.success).toBe(false)
  })

  it('validates updateZoneSchema with snake_case zone_id', () => {
    const valid = updateZoneSchema.safeParse({
      space_id: validSpaceId,
      zone_id: validZoneId,
      name: 'Silent Area',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.zoneId).toBe(validZoneId)
    }
  })

  it('validates reorderZonesSchema with zoneOrders or zoneIds', () => {
    const withOrders = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneOrders: [{ zoneId: validZoneId, position: 1 }],
    })
    expect(withOrders.success).toBe(true)

    const withIds = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneIds: [validZoneId],
    })
    expect(withIds.success).toBe(true)

    const withJsonString = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneIds: JSON.stringify([validZoneId]),
    })
    expect(withJsonString.success).toBe(true)

    const withoutEither = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
    })
    expect(withoutEither.success).toBe(false)
  })

  it('validates deleteZoneSchema and deleteUnitSchema', () => {
    expect(
      deleteZoneSchema.safeParse({ spaceId: validSpaceId, zoneId: validZoneId }).success,
    ).toBe(true)
    expect(
      deleteZoneSchema.safeParse({ space_id: validSpaceId, zone_id: validZoneId })
        .success,
    ).toBe(true)
    expect(
      deleteUnitSchema.safeParse({ spaceId: validSpaceId, unitId: validUnitId }).success,
    ).toBe(true)
    expect(
      deleteUnitSchema.safeParse({ space_id: validSpaceId, unit_id: validUnitId })
        .success,
    ).toBe(true)
  })

  it('validates addUnitSchema and updateUnitSchema with snake_case and string inputs', () => {
    const addResult = addUnitSchema.safeParse({
      space_id: validSpaceId,
      zone_id: validZoneId,
      unit_type: 'seat',
      label: 'S1',
      grid_row: '0',
      grid_col: '0',
    })
    expect(addResult.success).toBe(true)

    const updateResult = updateUnitSchema.safeParse({
      space_id: validSpaceId,
      unit_id: validUnitId,
      unitType: 'room',
      label: 'Room A',
      capacity: '6',
      row: '0',
      col: '0',
      colSpan: '3',
    })
    expect(updateResult.success).toBe(true)
  })

  it('validates moveUnitSchema with string row/col and snake_case IDs', () => {
    const valid = moveUnitSchema.safeParse({
      space_id: validSpaceId,
      unit_id: validUnitId,
      zone_id: validZoneId,
      row: '2',
      col: '4',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.row).toBe(2)
      expect(valid.data.col).toBe(4)
      expect(valid.data.spaceId).toBe(validSpaceId)
    }

    const withSnakeGrid = moveUnitSchema.safeParse({
      spaceId: validSpaceId,
      unitId: validUnitId,
      zoneId: validZoneId,
      grid_row: '3',
      grid_col: '1',
    })
    expect(withSnakeGrid.success).toBe(true)
    if (withSnakeGrid.success) {
      expect(withSnakeGrid.data.row).toBe(3)
      expect(withSnakeGrid.data.col).toBe(1)
    }

    const invalid = moveUnitSchema.safeParse({
      spaceId: validSpaceId,
      unitId: validUnitId,
      zoneId: validZoneId,
      row: 50,
      col: 6,
    })
    expect(invalid.success).toBe(false)
  })

  it('validates unitFormSchema with FormData, stringified inputs, and empty optional IDs', () => {
    const formData = new FormData()
    formData.set('space_id', validSpaceId)
    formData.set('zone_id', validZoneId)
    formData.set('unit_id', '')
    formData.set('unitType', 'seat')
    formData.set('label', ' S1 ')
    formData.set('capacity', '')
    formData.set('row', '1')
    formData.set('col', '2')
    formData.set('colSpan', '1')

    const result = unitFormSchema.safeParse(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.spaceId).toBe(validSpaceId)
      expect(result.data.zoneId).toBe(validZoneId)
      expect(result.data.unitId).toBeUndefined()
      expect(result.data.label).toBe('S1')
      expect(result.data.capacity).toBeNull()
      expect(result.data.row).toBe(1)
      expect(result.data.col).toBe(2)
      expect(result.data.colSpan).toBe(1)
    }
  })
})
