import { describe, expect, it } from 'vitest'

import {
  computeOperatingStatus,
  computeSpaceAvailability,
  computeZoneAvailability,
  formatDateTime,
  formatHostFreshness,
  formatOpeningHours,
  hoursText,
} from './index'

describe('lib/spaces re-exports', () => {
  it('correctly re-exports all format, freshness, and availability modules', () => {
    expect(typeof formatOpeningHours).toBe('function')
    expect(typeof hoursText).toBe('function')
    expect(typeof formatDateTime).toBe('function')
    expect(typeof computeOperatingStatus).toBe('function')
    expect(typeof formatHostFreshness).toBe('function')
    expect(typeof computeZoneAvailability).toBe('function')
    expect(typeof computeSpaceAvailability).toBe('function')
  })
})
