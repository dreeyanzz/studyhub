import { describe, expect, it } from 'vitest'
import {
  discoverySearchQuerySchema,
  hoursFilterSchema,
  priceTierSchema,
  unitTypeFilterSchema,
} from './search'

describe('discoverySearchQuerySchema (STORY-08, FR-1.1, FR-1.2)', () => {
  it('parses empty inputs with default values and empty filter arrays', () => {
    const result = discoverySearchQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.radiusKm).toBe(10)
      expect(result.data.tags).toEqual([])
      expect(result.data.price).toEqual([])
      expect(result.data.hours).toEqual([])
      expect(result.data.unitType).toEqual([])
      expect(result.data.lat).toBeUndefined()
      expect(result.data.lng).toBeUndefined()
      expect(result.data.q).toBeUndefined()
    }
  })

  it('preprocesses empty strings for lat and lng to undefined to prevent Null Island (0, 0)', () => {
    const result = discoverySearchQuerySchema.safeParse({
      lat: '',
      lng: '',
      radiusKm: '',
      tags: '',
      price: '',
      hours: '',
      unitType: '',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lat).toBeUndefined()
      expect(result.data.lng).toBeUndefined()
      expect(result.data.radiusKm).toBe(10)
      expect(result.data.tags).toEqual([])
      expect(result.data.price).toEqual([])
      expect(result.data.hours).toEqual([])
      expect(result.data.unitType).toEqual([])
    }
  })

  it('coerces valid numeric strings for lat, lng, and radiusKm', () => {
    const result = discoverySearchQuerySchema.safeParse({
      lat: '10.3157',
      lng: '123.8854',
      radiusKm: '5.5',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lat).toBe(10.3157)
      expect(result.data.lng).toBe(123.8854)
      expect(result.data.radiusKm).toBe(5.5)
    }
  })

  it('rejects out-of-bounds coordinates and radius', () => {
    expect(discoverySearchQuerySchema.safeParse({ lat: 91 }).success).toBe(false)
    expect(discoverySearchQuerySchema.safeParse({ lat: -90.1 }).success).toBe(false)
    expect(discoverySearchQuerySchema.safeParse({ lng: 180.5 }).success).toBe(false)
    expect(discoverySearchQuerySchema.safeParse({ lng: -181 }).success).toBe(false)
    expect(discoverySearchQuerySchema.safeParse({ radiusKm: 0.1 }).success).toBe(false)
    expect(discoverySearchQuerySchema.safeParse({ radiusKm: 55 }).success).toBe(false)
  })

  it('handles single, array, and comma-separated string filter parameters', () => {
    const singleResult = discoverySearchQuerySchema.safeParse({
      tags: 'wifi_fast',
      price: 'budget',
      hours: 'open_now',
      unitType: 'seat',
    })
    expect(singleResult.success).toBe(true)
    if (singleResult.success) {
      expect(singleResult.data.tags).toEqual(['wifi_fast'])
      expect(singleResult.data.price).toEqual(['budget'])
      expect(singleResult.data.hours).toEqual(['open_now'])
      expect(singleResult.data.unitType).toEqual(['seat'])
    }

    const arrayResult = discoverySearchQuerySchema.safeParse({
      tags: ['wifi_fast', 'outlets_all'],
      price: ['free', 'budget'],
      hours: ['open_now', 'open_late'],
      unitType: ['seat', 'room'],
    })
    expect(arrayResult.success).toBe(true)
    if (arrayResult.success) {
      expect(arrayResult.data.tags).toEqual(['wifi_fast', 'outlets_all'])
      expect(arrayResult.data.price).toEqual(['free', 'budget'])
      expect(arrayResult.data.hours).toEqual(['open_now', 'open_late'])
      expect(arrayResult.data.unitType).toEqual(['seat', 'room'])
    }

    const csvResult = discoverySearchQuerySchema.safeParse({
      tags: 'wifi_fast, outlets_all',
      price: 'free, budget',
      hours: 'open_now, open_late',
      unitType: 'seat, standing_desk',
    })
    expect(csvResult.success).toBe(true)
    if (csvResult.success) {
      expect(csvResult.data.tags).toEqual(['wifi_fast', 'outlets_all'])
      expect(csvResult.data.price).toEqual(['free', 'budget'])
      expect(csvResult.data.hours).toEqual(['open_now', 'open_late'])
      expect(csvResult.data.unitType).toEqual(['seat', 'standing_desk'])
    }
  })

  it('validates enums for priceTier, hoursFilter, and unitTypeFilter', () => {
    expect(priceTierSchema.safeParse('budget').success).toBe(true)
    expect(priceTierSchema.safeParse('luxury').success).toBe(false)

    expect(hoursFilterSchema.safeParse('open_24h').success).toBe(true)
    expect(hoursFilterSchema.safeParse('open_morning').success).toBe(false)

    expect(unitTypeFilterSchema.safeParse('standing_desk').success).toBe(true)
    expect(unitTypeFilterSchema.safeParse('couch').success).toBe(false)
  })

  it('trims the search text query q and limits length to 100 characters', () => {
    const result = discoverySearchQuerySchema.safeParse({
      q: '   USC Talamban   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.q).toBe('USC Talamban')
    }

    expect(
      discoverySearchQuerySchema.safeParse({
        q: 'a'.repeat(101),
      }).success,
    ).toBe(false)
  })
})
