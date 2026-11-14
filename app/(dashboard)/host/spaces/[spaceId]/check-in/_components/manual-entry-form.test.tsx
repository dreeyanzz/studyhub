import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({
  checkInAction: vi.fn(),
}))

import type { CheckInResult } from '../actions'
import { CheckInResultBanner } from './check-in-result-banner'
import { CheckInShell } from './check-in-shell'
import { ManualEntryForm, formatManualTokenInput } from './manual-entry-form'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000002'

describe('formatManualTokenInput (STORY-10, TSK-10.4, D-059)', () => {
  it('uppercases, drops punctuation, normalizes O/I/L, and groups in 4-char blocks', () => {
    expect(formatManualTokenInput('abcd efgh jkmn')).toBe('ABCD-EFGH-JKMN')
    expect(formatManualTokenInput('oila-2345-6789')).toBe('011A-2345-6789')
    expect(formatManualTokenInput('abcd-')).toBe('ABCD')
    expect(formatManualTokenInput('abcde')).toBe('ABCD-E')
    expect(formatManualTokenInput('abcdefghjkmn999')).toBe('ABCD-EFGH-JKMN')
  })
})

describe('ManualEntryForm (STORY-10, TSK-10.4)', () => {
  it('renders keyboard-accessible booking token field and disabled Check In submit when empty', () => {
    const html = renderToStaticMarkup(
      <ManualEntryForm onSubmitToken={vi.fn()} isPending={false} />,
    )

    expect(html).toContain('Booking token')
    expect(html).toContain('placeholder="ABCD-EFGH-JKMN"')
    expect(html).toContain('autoComplete="off"')
    expect(html).toContain('spellCheck="false"')
    expect(html).toContain('maxLength="14"')
    expect(html).toContain('min-h-12')
    expect(html).toContain('disabled=""')
    expect(html).toContain('Check In')
  })
})

describe('CheckInResultBanner (STORY-10, C1–C7)', () => {
  it.each<[CheckInResult, string, string]>([
    [
      { outcome: 'success', unitLabel: 'S4', zoneName: 'Quiet desks' },
      'role="status"',
      'Checked in unit S4 (Quiet desks)',
    ],
    [
      { outcome: 'wait_window_lapsed', unitLabel: 'S4' },
      'role="alert"',
      'Wait window lapsed. Unit has been released and reservation fee forfeited.',
    ],
    [
      { outcome: 'token_already_used' },
      'role="alert"',
      'This token was already checked in. Unit is currently Occupied.',
    ],
    [
      { outcome: 'reservation_cancelled' },
      'role="alert"',
      'This reservation was cancelled.',
    ],
    [
      { outcome: 'wrong_space' },
      'role="alert"',
      'This reservation is for a different Space. No changes were made.',
    ],
    [
      { outcome: 'invalid_token' },
      'role="alert"',
      'Invalid booking token. Please check the code.',
    ],
    [
      { outcome: 'forbidden' },
      'role="alert"',
      'Access denied. You must be signed in as the host of this Space.',
    ],
  ])('renders %o with %s and message %s', (result, expectedRole, expectedText) => {
    const html = renderToStaticMarkup(
      <CheckInResultBanner spaceId={SPACE_ID} result={result} />,
    )
    expect(html).toContain(expectedRole)
    expect(html).toContain(expectedText)
  })

  it('links to the Space occupancy seat map when check-in succeeds (C1)', () => {
    const html = renderToStaticMarkup(
      <CheckInResultBanner
        spaceId={SPACE_ID}
        result={{ outcome: 'success', unitLabel: 'S4', zoneName: 'Quiet desks' }}
      />,
    )
    expect(html).toContain(`href="/host/spaces/${SPACE_ID}/occupancy"`)
    expect(html).toContain('View occupancy seat map')
  })
})

describe('CheckInShell (STORY-10, TSK-10.4)', () => {
  it('renders manual-entry-only view with §3 note when BarcodeDetector is absent', () => {
    const html = renderToStaticMarkup(
      <CheckInShell spaceId={SPACE_ID} spaceName="Kapihan Study Hall" />,
    )
    expect(html).toContain('Verify booking at Kapihan Study Hall')
    expect(html).toContain(
      'This browser can&#x27;t scan QR codes. Type the code instead.',
    )
    expect(html).not.toContain('role="tablist"')
    expect(html).toContain('placeholder="ABCD-EFGH-JKMN"')
    expect(html).toContain('Check In')
  })
})
