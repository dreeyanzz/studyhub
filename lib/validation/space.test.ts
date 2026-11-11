import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { spaceIdSchema, spaceSchema, type SpaceField } from './space'

const validSpace = {
  name: 'Timpla Study Loft',
  description: 'Quiet corner tables with an outlet at every seat.',
  address: '2F Timpla Building, 18 Example Street, Cebu City',
  opensAt: '07:00',
  closesAt: '22:00',
  priceTier: 'budget' as const,
  maxWaitWindowMinutes: 60,
}

// The messages each field would show, as the form reads them.
function fieldErrors(
  input: Record<string, unknown>,
): Partial<Record<SpaceField, string[]>> {
  const result = spaceSchema.safeParse(input)
  expect(result.success).toBe(false)
  return result.success ? {} : z.flattenError(result.error).fieldErrors
}

describe('spaceSchema', () => {
  it('passes five valid fields with same-day hours and keeps them as entered', () => {
    const result = spaceSchema.safeParse(validSpace)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validSpace)
    }
  })

  it('trims the name, description and address but leaves the times as entered', () => {
    const result = spaceSchema.safeParse({
      ...validSpace,
      name: '  Timpla Study Loft  ',
      description: '\n Quiet corner tables. \n',
      address: '  18 Example Street  ',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Timpla Study Loft')
      expect(result.data.description).toBe('Quiet corner tables.')
      expect(result.data.address).toBe('18 Example Street')
      expect(result.data.opensAt).toBe('07:00')
      expect(result.data.closesAt).toBe('22:00')
    }
  })

  it('passes a missing, empty or blank description as an empty string', () => {
    const { description: _omitted, ...withoutDescription } = validSpace

    for (const input of [
      withoutDescription,
      { ...validSpace, description: '' },
      { ...validSpace, description: '   ' },
    ]) {
      const result = spaceSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBe('')
      }
    }
  })

  it('requires a name and an address, even when they are blank or missing', () => {
    expect(fieldErrors({ ...validSpace, name: '', address: '' })).toEqual({
      name: ['Space name is required'],
      address: ['Address is required'],
    })
    expect(fieldErrors({ ...validSpace, name: '   ', address: '\t' })).toEqual({
      name: ['Space name is required'],
      address: ['Address is required'],
    })

    const { name: _name, address: _address, ...withoutEither } = validSpace
    expect(fieldErrors(withoutEither)).toEqual({
      name: ['Space name is required'],
      address: ['Address is required'],
    })
  })

  it('passes a 100-character name and fails a 101-character one', () => {
    expect(spaceSchema.safeParse({ ...validSpace, name: 'A'.repeat(100) }).success).toBe(
      true,
    )
    // Surrounding spaces are trimmed before the length is counted, as the database
    // counts the stored value.
    expect(
      spaceSchema.safeParse({ ...validSpace, name: ` ${'A'.repeat(100)} ` }).success,
    ).toBe(true)
    expect(fieldErrors({ ...validSpace, name: 'A'.repeat(101) })).toEqual({
      name: ['Space name must be 100 characters or fewer'],
    })
  })

  it('passes a 200-character address and fails a 201-character one', () => {
    expect(
      spaceSchema.safeParse({ ...validSpace, address: 'A'.repeat(200) }).success,
    ).toBe(true)
    expect(fieldErrors({ ...validSpace, address: 'A'.repeat(201) })).toEqual({
      address: ['Address must be 200 characters or fewer'],
    })
  })

  it('passes a 2,000-character description and fails a 2,001-character one', () => {
    expect(
      spaceSchema.safeParse({ ...validSpace, description: 'A'.repeat(2000) }).success,
    ).toBe(true)
    expect(fieldErrors({ ...validSpace, description: 'A'.repeat(2001) })).toEqual({
      description: ['Description must be 2,000 characters or fewer'],
    })
  })

  it.each(['00:00', '07:00', '18:00', '23:59'])('passes %s as either time', (time) => {
    const result = spaceSchema.safeParse({ ...validSpace, opensAt: time, closesAt: time })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.opensAt).toBe(time)
      expect(result.data.closesAt).toBe(time)
    }
  })

  it('requires both times, showing only the required message', () => {
    expect(fieldErrors({ ...validSpace, opensAt: '', closesAt: '' })).toEqual({
      opensAt: ['Opening time is required'],
      closesAt: ['Closing time is required'],
    })

    const { opensAt: _opensAt, closesAt: _closesAt, ...withoutTimes } = validSpace
    expect(fieldErrors(withoutTimes)).toEqual({
      opensAt: ['Opening time is required'],
      closesAt: ['Closing time is required'],
    })
  })

  it.each([
    '7:00',
    '24:00',
    '12:60',
    '07:00:00',
    'seven',
    '2026-09-28',
    '2026-09-28T07:00',
  ])('fails %s as either time', (time) => {
    expect(fieldErrors({ ...validSpace, opensAt: time, closesAt: time })).toEqual({
      opensAt: ['Enter a valid opening time'],
      closesAt: ['Enter a valid closing time'],
    })
  })

  it('passes a closing time earlier than the opening time: it closes after midnight (D-027)', () => {
    const result = spaceSchema.safeParse({
      ...validSpace,
      opensAt: '18:00',
      closesAt: '02:00',
    })

    expect(result.success).toBe(true)
  })

  it('passes equal opening and closing times: it is open 24 hours (D-027)', () => {
    for (const time of ['00:00', '09:00']) {
      const result = spaceSchema.safeParse({
        ...validSpace,
        opensAt: time,
        closesAt: time,
      })
      expect(result.success).toBe(true)
    }
  })

  it('drops keys that are not form fields, such as host_id and status', () => {
    const result = spaceSchema.safeParse({
      ...validSpace,
      id: 'e0000000-0000-4000-8000-000000000001',
      host_id: 'b0000000-0000-4000-8000-000000000002',
      status: 'verified',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validSpace)
      expect(Object.keys(result.data)).not.toContain('host_id')
      expect(Object.keys(result.data)).not.toContain('status')
    }
  })

  it('validates coordinates and price tier (STORY-08, D-027)', () => {
    // Valid coordinates and explicit price tier
    const withGeo = spaceSchema.safeParse({
      ...validSpace,
      latitude: '10.3157',
      longitude: 123.8854,
      priceTier: 'premium',
    })
    expect(withGeo.success).toBe(true)
    if (withGeo.success) {
      expect(withGeo.data.latitude).toBe(10.3157)
      expect(withGeo.data.longitude).toBe(123.8854)
      expect(withGeo.data.priceTier).toBe('premium')
    }

    // Preprocesses empty string coordinates to undefined and preserves null
    const withEmptyGeo = spaceSchema.safeParse({
      ...validSpace,
      latitude: '',
      longitude: null,
    })
    expect(withEmptyGeo.success).toBe(true)
    if (withEmptyGeo.success) {
      expect(withEmptyGeo.data.latitude).toBeUndefined()
      expect(withEmptyGeo.data.longitude).toBeNull()
    }

    // Rejects out-of-bounds coordinates
    expect(spaceSchema.safeParse({ ...validSpace, latitude: 91 }).success).toBe(false)
    expect(spaceSchema.safeParse({ ...validSpace, latitude: -90.5 }).success).toBe(false)
    expect(spaceSchema.safeParse({ ...validSpace, longitude: 181 }).success).toBe(false)
    expect(spaceSchema.safeParse({ ...validSpace, longitude: -180.5 }).success).toBe(
      false,
    )

    // Rejects invalid price tier
    expect(spaceSchema.safeParse({ ...validSpace, priceTier: 'luxury' }).success).toBe(
      false,
    )

    // Validates maxWaitWindowMinutes (STORY-09, D-067)
    const { maxWaitWindowMinutes: _omitted, ...withoutWait } = validSpace
    const defaulted = spaceSchema.safeParse(withoutWait)
    expect(defaulted.success).toBe(true)
    if (defaulted.success) {
      expect(defaulted.data.maxWaitWindowMinutes).toBe(60)
    }

    const customWait = spaceSchema.safeParse({
      ...validSpace,
      maxWaitWindowMinutes: '45',
    })
    expect(customWait.success).toBe(true)
    if (customWait.success) {
      expect(customWait.data.maxWaitWindowMinutes).toBe(45)
    }

    expect(
      spaceSchema.safeParse({ ...validSpace, maxWaitWindowMinutes: 50 }).success,
    ).toBe(false)
  })

  it('shows readable messages for out-of-range or non-numeric coordinates (TSK-08.5)', () => {
    expect(fieldErrors({ ...validSpace, latitude: '91', longitude: '123.9' })).toEqual({
      latitude: ['Latitude must be between -90 and 90'],
    })
    expect(fieldErrors({ ...validSpace, latitude: '10.3', longitude: '-181' })).toEqual({
      longitude: ['Longitude must be between -180 and 180'],
    })
    expect(fieldErrors({ ...validSpace, latitude: 'north', longitude: '123.9' })).toEqual(
      {
        latitude: ['Enter the latitude as a number'],
      },
    )
  })

  it('refuses one coordinate without the other, naming the missing one (TSK-08.5)', () => {
    expect(fieldErrors({ ...validSpace, latitude: '10.3157', longitude: '' })).toEqual({
      longitude: ['Enter the longitude too, or clear the latitude'],
    })
    expect(fieldErrors({ ...validSpace, latitude: '', longitude: '123.8854' })).toEqual({
      latitude: ['Enter the latitude too, or clear the longitude'],
    })
  })

  it('passes no pin at all, and defaults the price tier to budget (TSK-08.5)', () => {
    const { priceTier: _priceTier, ...withoutTier } = validSpace
    const result = spaceSchema.safeParse({ ...withoutTier, latitude: '', longitude: '' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.latitude).toBeUndefined()
      expect(result.data.longitude).toBeUndefined()
      expect(result.data.priceTier).toBe('budget')
    }
  })

  it('treats whitespace coordinates as blank, avoiding Null Island (0, 0)', () => {
    const result = spaceSchema.safeParse({
      ...validSpace,
      latitude: '   ',
      longitude: '   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.latitude).toBeUndefined()
      expect(result.data.longitude).toBeUndefined()
    }

    expect(fieldErrors({ ...validSpace, latitude: '10.3157', longitude: '   ' })).toEqual(
      {
        longitude: ['Enter the longitude too, or clear the latitude'],
      },
    )
    expect(
      fieldErrors({ ...validSpace, latitude: '   ', longitude: '123.8854' }),
    ).toEqual({
      latitude: ['Enter the latitude too, or clear the longitude'],
    })
  })
})

describe('spaceIdSchema', () => {
  it('passes a Space id', () => {
    for (const id of [
      'e0000000-0000-4000-8000-000000000001',
      '3f1c2b4a-8d7e-4f6a-9b2c-1d0e5f4a3b2c',
    ]) {
      expect(spaceIdSchema.safeParse(id).success).toBe(true)
    }
  })

  it('fails a malformed or missing id with one generic message', () => {
    for (const id of [
      'not-a-space-id',
      '',
      'e0000000-0000-4000-8000-00000000001',
      "' or 1=1 --",
      null,
      undefined,
    ]) {
      const result = spaceIdSchema.safeParse(id)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toEqual([
          'We could not find that Space.',
        ])
      }
    }
  })
})
