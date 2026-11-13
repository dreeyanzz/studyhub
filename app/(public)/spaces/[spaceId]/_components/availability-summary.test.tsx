import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilitySummary } from './availability-summary'
import type { SpaceAvailabilitySummary } from '@/lib/space/availability'

describe('AvailabilitySummary (STORY-11, TSK-11.5)', () => {
  it('renders zone chips with available vs total counts and oldest-available timestamp (D-051)', () => {
    const summary: SpaceAvailabilitySummary = {
      zones: [
        {
          zoneId: 'z1',
          zoneName: 'Quiet desks',
          totalUnits: 8,
          availableUnits: 6,
          oldestAvailableHostUpdatedAt: '2026-11-11T10:00:00Z',
        },
        {
          zoneId: 'z2',
          zoneName: 'Standing desks',
          totalUnits: 4,
          availableUnits: 2,
          oldestAvailableHostUpdatedAt: '2026-11-11T11:45:00Z',
        },
      ],
      totalUnits: 12,
      availableUnits: 8,
      hasAvailableUnits: true,
    }

    const html = renderToStaticMarkup(<AvailabilitySummary summary={summary} />)

    expect(html).toContain('Quiet desks:')
    expect(html).toContain('6 available')
    expect(html).toContain('8 total')
    expect(html).toContain('dateTime="2026-11-11T10:00:00Z"')

    expect(html).toContain('Standing desks:')
    expect(html).toContain('2 available')
    expect(html).toContain('4 total')
    expect(html).toContain('dateTime="2026-11-11T11:45:00Z"')

    // No all-occupied notice when units are available
    expect(html).not.toContain('data-testid="seeker-profile-no-available-unit"')
  })

  it('renders "No available units" badge for a zone with 0 available units', () => {
    const summary: SpaceAvailabilitySummary = {
      zones: [
        {
          zoneId: 'z1',
          zoneName: 'Quiet desks',
          totalUnits: 8,
          availableUnits: 0,
          oldestAvailableHostUpdatedAt: null,
        },
        {
          zoneId: 'z2',
          zoneName: 'Meeting rooms',
          totalUnits: 2,
          availableUnits: 1,
          oldestAvailableHostUpdatedAt: '2026-11-11T11:00:00Z',
        },
      ],
      totalUnits: 10,
      availableUnits: 1,
      hasAvailableUnits: true,
    }

    const html = renderToStaticMarkup(<AvailabilitySummary summary={summary} />)

    expect(html).toContain('Quiet desks:')
    expect(html).toContain('0 available')
    expect(html).toContain('No available units')
  })

  it('displays empty state alert when all units are occupied across the Space (seeker-profile-no-available-unit)', () => {
    const summary: SpaceAvailabilitySummary = {
      zones: [
        {
          zoneId: 'z1',
          zoneName: 'Quiet desks',
          totalUnits: 8,
          availableUnits: 0,
          oldestAvailableHostUpdatedAt: null,
        },
      ],
      totalUnits: 8,
      availableUnits: 0,
      hasAvailableUnits: false,
    }

    const html = renderToStaticMarkup(<AvailabilitySummary summary={summary} />)

    expect(html).toContain('data-testid="seeker-profile-no-available-unit"')
    expect(html).toContain('No units available')
    expect(html).toContain('No units are currently Available. Check back later or')
    expect(html).toContain('explore other spaces')
    expect(html).toContain('href="/spaces"')
  })
})
