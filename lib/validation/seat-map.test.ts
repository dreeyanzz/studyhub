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
  toIntOrUndefined,
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

describe('toIntOrUndefined', () => {
  it('returns undefined for empty strings, null, and undefined', () => {
    expect(toIntOrUndefined('')).toBeUndefined()
    expect(toIntOrUndefined(null)).toBeUndefined()
    expect(toIntOrUndefined(undefined)).toBeUndefined()
  })

  it('converts numeric strings to numbers', () => {
    expect(toIntOrUndefined('0')).toBe(0)
    expect(toIntOrUndefined('42')).toBe(42)
    expect(toIntOrUndefined('  15  ')).toBe(15)
  })

  it('preserves existing numbers', () => {
    expect(toIntOrUndefined(0)).toBe(0)
    expect(toIntOrUndefined(10)).toBe(10)
  })

  it('returns non-numeric strings as-is for Zod to reject', () => {
    expect(toIntOrUndefined('abc')).toBeNaN()
  })
})

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

  it('defaults empty string position from HTML forms to 0', () => {
    const formData = new FormData()
    formData.set('name', 'Quiet desks')
    formData.set('position', '')
    const result = zoneSchema.safeParse(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.position).toBe(0)
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
    expect(unitCapacitySchema.safeParse('6').success).toBe(true)
  })

  it('rejects numbers outside 1..50 or floats', () => {
    expect(unitCapacitySchema.safeParse(0).success).toBe(false)
    expect(unitCapacitySchema.safeParse(-1).success).toBe(false)
    expect(unitCapacitySchema.safeParse(51).success).toBe(false)
    expect(unitCapacitySchema.safeParse(3.5).success).toBe(false)
    expect(unitCapacitySchema.safeParse('abc').success).toBe(false)
  })
})

describe('gridRowSchema', () => {
  it('passes rows between 0 and 49', () => {
    expect(gridRowSchema.safeParse(0).success).toBe(true)
    expect(gridRowSchema.safeParse(49).success).toBe(true)
    expect(gridRowSchema.safeParse('24').success).toBe(true)
  })

  it('rejects rows < 0 or >= 50', () => {
    expect(gridRowSchema.safeParse(-1).success).toBe(false)
    expect(gridRowSchema.safeParse(50).success).toBe(false)
    expect(gridRowSchema.safeParse('50').success).toBe(false)
  })

  it('words the range error from 1, as the page counts rows', () => {
    expect(gridRowSchema.safeParse(50).error?.issues[0]?.message).toBe(
      'Row must be between 1 and 50',
    )
    expect(gridRowSchema.safeParse(-1).error?.issues[0]?.message).toBe(
      'Row must be between 1 and 50',
    )
  })
})

describe('gridColSchema', () => {
  it('passes columns between 0 and 5', () => {
    expect(gridColSchema.safeParse(0).success).toBe(true)
    expect(gridColSchema.safeParse(5).success).toBe(true)
    expect(gridColSchema.safeParse('3').success).toBe(true)
  })

  it('rejects columns < 0 or > 5', () => {
    expect(gridColSchema.safeParse(-1).success).toBe(false)
    expect(gridColSchema.safeParse(6).success).toBe(false)
    expect(gridColSchema.safeParse('6').success).toBe(false)
  })

  it('words the range error from 1, as the page counts columns', () => {
    expect(gridColSchema.safeParse(6).error?.issues[0]?.message).toBe(
      'Column must be between 1 and 6',
    )
    expect(gridColSchema.safeParse(-1).error?.issues[0]?.message).toBe(
      'Column must be between 1 and 6',
    )
  })
})

describe('colSpanSchema', () => {
  it('passes spans between 1 and 3', () => {
    expect(colSpanSchema.safeParse(1).success).toBe(true)
    expect(colSpanSchema.safeParse(2).success).toBe(true)
    expect(colSpanSchema.safeParse(3).success).toBe(true)
    expect(colSpanSchema.safeParse('2').success).toBe(true)
  })

  it('rejects spans < 1 or > 3', () => {
    expect(colSpanSchema.safeParse(0).success).toBe(false)
    expect(colSpanSchema.safeParse(4).success).toBe(false)
    expect(colSpanSchema.safeParse('0').success).toBe(false)
  })
})

describe('cellCoordinateSchema', () => {
  it('passes valid coordinates and defaults colSpan to 1', () => {
    const result = cellCoordinateSchema.safeParse({ row: 0, col: 0 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.row).toBe(0)
      expect(result.data.col).toBe(0)
      expect(result.data.colSpan).toBe(1)
    }
  })

  it('normalizes string coordinates from form inputs', () => {
    const result = cellCoordinateSchema.safeParse({
      row: '3',
      col: '2',
      colSpan: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.row).toBe(3)
      expect(result.data.col).toBe(2)
      expect(result.data.colSpan).toBe(2)
    }
  })

  it('rejects placement when col + colSpan > 6', () => {
    // col 5 with colSpan 2 exceeds 6
    const result = cellCoordinateSchema.safeParse({ row: 0, col: 5, colSpan: 2 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = z.flattenError(result.error)
      expect(errors.fieldErrors.colSpan).toContain(
        'Unit must fit within the 6 grid columns',
      )
    }
  })

  it('accepts FormData for cellCoordinateSchema', () => {
    const formData = new FormData()
    formData.set('row', '1')
    formData.set('col', '2')
    formData.set('colSpan', '3')
    const result = cellCoordinateSchema.safeParse(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.row).toBe(1)
      expect(result.data.col).toBe(2)
      expect(result.data.colSpan).toBe(3)
    }
  })
})

describe('unitSchema', () => {
  const validSeat = {
    unitType: 'seat' as const,
    label: 'S1',
    capacity: null,
    row: 0,
    col: 0,
    colSpan: 1,
  }

  it('passes a valid seat and provides normalized fields', () => {
    const result = unitSchema.safeParse(validSeat)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitType).toBe('seat')
      expect(result.data.label).toBe('S1')
      expect(result.data.capacity).toBeNull()
      expect(result.data.row).toBe(0)
      expect(result.data.col).toBe(0)
      expect(result.data.colSpan).toBe(1)
    }
  })

  it('passes a valid standing desk with colSpan 1', () => {
    const result = unitSchema.safeParse({
      unitType: 'standing_desk',
      label: 'D1',
      capacity: null,
      row: 0,
      col: 1,
      colSpan: 1,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitType).toBe('standing_desk')
      expect(result.data.colSpan).toBe(1)
    }
  })

  it('passes a valid room with 2 or 3 columns and 1..50 capacity', () => {
    const room2 = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room B',
      capacity: 4,
      row: 1,
      col: 0,
      colSpan: 2,
    })
    expect(room2.success).toBe(true)
    if (room2.success) {
      expect(room2.data.capacity).toBe(4)
      expect(room2.data.colSpan).toBe(2)
    }

    const room3 = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 6,
      row: 1,
      col: 2,
      colSpan: 3,
    })
    expect(room3.success).toBe(true)
    if (room3.success) {
      expect(room3.data.capacity).toBe(6)
      expect(room3.data.colSpan).toBe(3)
    }
  })

  it('defaults colSpan to 2 for rooms when omitted', () => {
    const roomDefault = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 4,
      row: 0,
      col: 0,
    })
    expect(roomDefault.success).toBe(true)
    if (roomDefault.success) {
      expect(roomDefault.data.colSpan).toBe(2)
    }
  })

  it('defaults empty string colSpan in FormData correctly per unit type', () => {
    const roomForm = new FormData()
    roomForm.set('unitType', 'room')
    roomForm.set('label', 'Room A')
    roomForm.set('capacity', '4')
    roomForm.set('row', '0')
    roomForm.set('col', '0')
    roomForm.set('colSpan', '')
    const roomResult = unitSchema.safeParse(roomForm)
    expect(roomResult.success).toBe(true)
    if (roomResult.success) {
      expect(roomResult.data.colSpan).toBe(2)
    }

    const seatForm = new FormData()
    seatForm.set('unitType', 'seat')
    seatForm.set('label', 'S1')
    seatForm.set('row', '0')
    seatForm.set('col', '0')
    seatForm.set('colSpan', '')
    const seatResult = unitSchema.safeParse(seatForm)
    expect(seatResult.success).toBe(true)
    if (seatResult.success) {
      expect(seatResult.data.colSpan).toBe(1)
    }
  })

  it('rejects capacity on seats and standing desks (FR-3.1, D-049)', () => {
    const seatWithCap = unitSchema.safeParse({
      ...validSeat,
      capacity: 1,
    })
    expect(seatWithCap.success).toBe(false)
    if (!seatWithCap.success) {
      const errors = z.flattenError(seatWithCap.error)
      expect(errors.fieldErrors.capacity).toContain(
        'Seats and standing desks cannot have a capacity',
      )
    }
  })

  it('rejects colSpan > 1 for seats and standing desks', () => {
    const seatWide = unitSchema.safeParse({
      ...validSeat,
      colSpan: 2,
    })
    expect(seatWide.success).toBe(false)
    if (!seatWide.success) {
      const errors = z.flattenError(seatWide.error)
      expect(errors.fieldErrors.colSpan).toContain(
        'Seats and standing desks must span exactly 1 column',
      )
    }
  })

  it('rejects null or omitted capacity on rooms', () => {
    const roomNullCap = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: null,
      row: 0,
      col: 0,
      colSpan: 2,
    })
    expect(roomNullCap.success).toBe(false)
    if (!roomNullCap.success) {
      const errors = z.flattenError(roomNullCap.error)
      expect(errors.fieldErrors.capacity).toContain('Room capacity is required')
    }
  })

  it('rejects colSpan !== 2 && colSpan !== 3 for rooms', () => {
    const roomSpan1 = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 4,
      row: 0,
      col: 0,
      colSpan: 1,
    })
    expect(roomSpan1.success).toBe(false)
    if (!roomSpan1.success) {
      const errors = z.flattenError(roomSpan1.error)
      expect(errors.fieldErrors.colSpan).toContain(
        'A whole room must span 2 or 3 columns',
      )
    }
  })

  it('rejects unit with col + colSpan > 6', () => {
    const roomOverflow = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: 6,
      row: 0,
      col: 4,
      colSpan: 3,
    })
    expect(roomOverflow.success).toBe(false)
    if (!roomOverflow.success) {
      const errors = z.flattenError(roomOverflow.error)
      expect(errors.fieldErrors.colSpan).toContain(
        'Unit must fit within the 6 grid columns',
      )
    }
  })

  it('normalizes string coordinates and capacity from form inputs', () => {
    const result = unitSchema.safeParse({
      unitType: 'room',
      label: 'Room A',
      capacity: '8',
      row: '2',
      col: '1',
      colSpan: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unitType).toBe('room')
      expect(result.data.capacity).toBe(8)
      expect(result.data.row).toBe(2)
      expect(result.data.col).toBe(1)
      expect(result.data.colSpan).toBe(2)
    }
  })
})

describe('Server Action form schemas', () => {
  it('validates createZoneSchema with string position and spaceId', () => {
    const valid = createZoneSchema.safeParse({
      spaceId: validSpaceId,
      name: 'Quiet desks',
      position: '0',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.spaceId).toBe(validSpaceId)
      expect(valid.data.position).toBe(0)
    }

    const withEmptyPos = createZoneSchema.safeParse({
      spaceId: validSpaceId,
      name: 'Quiet desks',
      position: '',
    })
    expect(withEmptyPos.success).toBe(true)
    if (withEmptyPos.success) {
      expect(withEmptyPos.data.position).toBe(0)
    }

    const invalid = createZoneSchema.safeParse({
      spaceId: 'not-a-uuid',
      name: '',
    })
    expect(invalid.success).toBe(false)
  })

  it('validates updateZoneSchema with spaceId, zoneId and optional position', () => {
    const valid = updateZoneSchema.safeParse({
      spaceId: validSpaceId,
      zoneId: validZoneId,
      name: 'Silent Area',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.zoneId).toBe(validZoneId)
    }

    const withPosition = updateZoneSchema.safeParse({
      spaceId: validSpaceId,
      zoneId: validZoneId,
      name: 'Silent Area',
      position: '3',
    })
    expect(withPosition.success).toBe(true)
    if (withPosition.success) {
      expect(withPosition.data.position).toBe(3)
    }
  })

  it('validates reorderZonesSchema with zoneOrders or zoneIds', () => {
    const withOrders = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneOrders: [{ zoneId: validZoneId, position: 1 }],
    })
    expect(withOrders.success).toBe(true)

    const withStringOrders = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneOrders: [{ zoneId: validZoneId, position: '2' }],
    })
    expect(withStringOrders.success).toBe(true)

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

    const withEmptyStrings = reorderZonesSchema.safeParse({
      spaceId: validSpaceId,
      zoneOrders: '',
      zoneIds: '',
    })
    expect(withEmptyStrings.success).toBe(false)

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
      deleteUnitSchema.safeParse({ spaceId: validSpaceId, unitId: validUnitId }).success,
    ).toBe(true)
  })

  it('validates addUnitSchema and updateUnitSchema with string inputs', () => {
    const addResult = addUnitSchema.safeParse({
      spaceId: validSpaceId,
      zoneId: validZoneId,
      unitType: 'seat',
      label: 'S1',
      row: '0',
      col: '0',
    })
    expect(addResult.success).toBe(true)

    const updateResult = updateUnitSchema.safeParse({
      spaceId: validSpaceId,
      unitId: validUnitId,
      unitType: 'room',
      label: 'Room A',
      capacity: '6',
      row: '0',
      col: '0',
      colSpan: '3',
    })
    expect(updateResult.success).toBe(true)
  })

  it('validates moveUnitSchema with string row/col and camelCase IDs', () => {
    const valid = moveUnitSchema.safeParse({
      spaceId: validSpaceId,
      unitId: validUnitId,
      zoneId: validZoneId,
      row: '2',
      col: '4',
      colSpan: '1',
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.row).toBe(2)
      expect(valid.data.col).toBe(4)
      expect(valid.data.colSpan).toBe(1)
      expect(valid.data.spaceId).toBe(validSpaceId)
      expect(valid.data.unitId).toBe(validUnitId)
      expect(valid.data.zoneId).toBe(validZoneId)
    }

    const invalid = moveUnitSchema.safeParse({
      spaceId: validSpaceId,
      unitId: validUnitId,
      zoneId: validZoneId,
      row: 50,
      col: 6,
      colSpan: 1,
    })
    expect(invalid.success).toBe(false)
  })

  it('rejects a moveUnitSchema move that would push the unit past the right edge', () => {
    const ids = { spaceId: validSpaceId, unitId: validUnitId, zoneId: validZoneId }

    // A 3-wide whole room at column index 4 would cover columns 4–6: past the edge.
    const pastEdge = moveUnitSchema.safeParse({ ...ids, row: 0, col: 4, colSpan: 3 })
    expect(pastEdge.success).toBe(false)
    if (!pastEdge.success) {
      const issue = pastEdge.error.issues.find((i) => i.path.includes('col'))
      expect(issue?.message).toBe('Unit must fit within the 6 grid columns')
    }

    // The same room at column index 3 ends exactly on the edge.
    expect(moveUnitSchema.safeParse({ ...ids, row: 0, col: 3, colSpan: 3 }).success).toBe(
      true,
    )
    // A seat fits in the last column.
    expect(moveUnitSchema.safeParse({ ...ids, row: 0, col: 5, colSpan: 1 }).success).toBe(
      true,
    )
    // A 2-wide room in the last column does not.
    expect(moveUnitSchema.safeParse({ ...ids, row: 0, col: 5, colSpan: 2 }).success).toBe(
      false,
    )
  })

  it('requires the width in moveUnitSchema, so a room cannot skip the edge check', () => {
    const ids = { spaceId: validSpaceId, unitId: validUnitId, zoneId: validZoneId }
    expect(moveUnitSchema.safeParse({ ...ids, row: 0, col: 4 }).success).toBe(false)
    expect(
      moveUnitSchema.safeParse({ ...ids, row: 0, col: 4, colSpan: '' }).success,
    ).toBe(false)
  })

  it('validates unitFormSchema with FormData, stringified inputs, and empty optional IDs', () => {
    const formData = new FormData()
    formData.set('spaceId', validSpaceId)
    formData.set('zoneId', validZoneId)
    formData.set('unitId', '')
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
