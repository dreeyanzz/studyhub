import { statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { spaceSchema } from '@/lib/validation/space'
import { MAX_PHOTO_FILE_SIZE } from '@/lib/validation/space-photos'
import {
  buildDemoCatalog,
  CURATED_TAG_IDS,
  DEMO_PHOTO_FILES,
  DEMO_SCENARIOS,
} from './cebu-demo-spaces.mjs'

describe('50-space Metro Cebu demo catalog (D-097)', () => {
  const catalog = buildDemoCatalog()

  it('defines exactly 50 unique spaces across all four space_status values', () => {
    expect(catalog.spaces).toHaveLength(50)

    const ids = new Set(catalog.spaces.map((s) => s.id))
    const names = new Set(catalog.spaces.map((s) => s.name))
    expect(ids.size).toBe(50)
    expect(names.size).toBe(50)

    const counts = catalog.spaces.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {})

    expect(counts).toEqual({
      verified: 38,
      pending: 6,
      rejected: 3,
      taken_down: 3,
    })
  })

  it('passes spaceSchema validation for every space', () => {
    for (const s of catalog.spaces) {
      const parsed = spaceSchema.safeParse({
        name: s.name,
        description: s.description,
        address: s.address,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        latitude: s.latitude,
        longitude: s.longitude,
        priceTier: s.priceTier,
        maxWaitWindowMinutes: s.maxWaitWindowMinutes,
      })
      expect(parsed.success, `Space #${s.index} (${s.name}) failed spaceSchema`).toBe(
        true,
      )
    }
  })

  it('covers all 4 price tiers, 24/7 + daytime + overnight hours, and all 10 curated tags', () => {
    const priceTiers = new Set(catalog.spaces.map((s) => s.priceTier))
    expect(priceTiers).toEqual(new Set(['free', 'budget', 'standard', 'premium']))

    expect(catalog.spaces.some((s) => s.opensAt === s.closesAt)).toBe(true) // 24h
    expect(catalog.spaces.some((s) => s.opensAt < s.closesAt)).toBe(true) // daytime
    expect(catalog.spaces.some((s) => s.opensAt > s.closesAt)).toBe(true) // overnight

    const usedCuratedTags = new Set(catalog.spaces.flatMap((s) => s.curatedTags))
    for (const tagId of CURATED_TAG_IDS) {
      expect(usedCuratedTags.has(tagId), `Missing curated tag ${tagId}`).toBe(true)
    }

    // Untagged and no-photo verified spaces are covered
    expect(
      catalog.spaces.some((s) => s.status === 'verified' && s.curatedTags.length === 0),
    ).toBe(true)
    expect(
      catalog.spaces.some((s) => s.status === 'verified' && s.photos.length === 0),
    ).toBe(true)
    expect(
      catalog.spaces.some((s) => s.status === 'pending' && s.latitude === null),
    ).toBe(true)
  })

  it('builds valid non-overlapping seat maps covering all unit types, host states, and empty maps', () => {
    const unitTypes = new Set<string>()
    const hostStates = new Set<string>()
    let emptyVerifiedMaps = 0

    for (const s of catalog.spaces) {
      if (s.status === 'verified' && s.zones.length === 0) emptyVerifiedMaps++

      for (const z of s.zones) {
        const occupiedCells = new Set<string>()
        for (const u of z.units) {
          unitTypes.add(u.unitType)
          hostStates.add(u.hostState)
          for (let offset = 0; offset < u.colSpan; offset++) {
            const key = `${u.gridRow}:${u.gridCol + offset}`
            expect(
              occupiedCells.has(key),
              `Overlapping cell ${key} in space ${s.name} zone ${z.name}`,
            ).toBe(false)
            occupiedCells.add(key)
          }
        }
      }
    }

    expect(unitTypes).toEqual(new Set(['seat', 'standing_desk', 'room']))
    expect(hostStates).toEqual(new Set(['available', 'reserved', 'occupied']))
    expect(emptyVerifiedMaps).toBeGreaterThanOrEqual(1)
  })

  it('references existing demo photo files under the 5 MB upload limit', () => {
    const photosDir = path.resolve(process.cwd(), 'scripts', 'assets', 'demo-photos')
    for (const filename of DEMO_PHOTO_FILES) {
      const stat = statSync(path.join(photosDir, filename))
      expect(stat.size).toBeGreaterThan(0)
      expect(stat.size).toBeLessThanOrEqual(MAX_PHOTO_FILE_SIZE)
    }

    const allowed = new Set(DEMO_PHOTO_FILES)
    for (const s of catalog.spaces) {
      for (const photo of s.photos) {
        expect(allowed.has(photo), `Unknown photo ${photo} on ${s.name}`).toBe(true)
      }
    }
  })

  it('keeps all synthetic demo users on @example.test and covers every role & onboarding substate', () => {
    expect(catalog.users.every((u) => u.email.endsWith('@example.test'))).toBe(true)

    const roles = new Set(catalog.users.map((u) => u.role))
    expect(roles).toEqual(new Set(['admin', 'host', 'seeker']))
    expect(catalog.users.some((u) => !u.roleConfirmed)).toBe(true)
    expect(catalog.users.some((u) => u.phoneNumber === null)).toBe(true)

    // seeker1 (seeker@example.test) stays free of active holds for live booking demos
    expect(DEMO_SCENARIOS.activeHolds.some((h) => h.seekerKey === 'seeker1')).toBe(false)
  })

  it('covers all reservation, payment, review, and report moderation states', () => {
    const resStatuses = new Set([
      ...DEMO_SCENARIOS.activeHolds.map((h) => h.status),
      ...DEMO_SCENARIOS.historicalNonCompleted.map((h) => h.status),
      'completed',
    ])
    expect(resStatuses).toEqual(
      new Set([
        'pending_payment',
        'reserved',
        'occupied',
        'expired',
        'no_show',
        'completed',
        'cancelled',
      ]),
    )

    const payStatuses = new Set([
      ...DEMO_SCENARIOS.activeHolds.map((h) => h.paymentStatus),
      ...DEMO_SCENARIOS.historicalNonCompleted.map((h) => h.paymentStatus),
      'paid',
    ])
    expect(payStatuses).toEqual(new Set(['pending', 'paid', 'forfeited', 'refunded']))

    const revStatuses = new Set(
      DEMO_SCENARIOS.completedVisitsWithReviews
        .filter((v) => v.review)
        .map((v) => v.review!.status),
    )
    expect(revStatuses).toEqual(new Set(['visible', 'hidden', 'removed']))

    const reportReasons = new Set(
      DEMO_SCENARIOS.completedVisitsWithReviews.flatMap((v) => {
        const reasons: string[] = []
        if (v.review?.openReport) reasons.push(v.review.openReport.reason)
        if (v.review?.closedReport) reasons.push(v.review.closedReport.reason)
        return reasons
      }),
    )
    expect(reportReasons).toEqual(
      new Set(['spam', 'offensive', 'not_about_space', 'other']),
    )
  })
})
