import { describe, expect, it } from 'vitest'

import { HOLD_REFUSAL_FALLBACK, holdRefusalMessage } from './refusals'

// Every hint in STORY-09 design §3's refusal table has its message.

const context = { unitLabel: 'S4' }

describe('holdRefusalMessage', () => {
  it.each([
    ['unit_not_available', 'Someone else just took S4. Pick another unit.'],
    ['space_closed', 'This Space has just closed.'],
    [
      'wait_window_not_allowed',
      'That wait window no longer fits before closing. Pick a shorter one.',
    ],
    [
      'wait_window_past_closing',
      'That wait window no longer fits before closing. Pick a shorter one.',
    ],
    ['unit_not_found', 'We could not find that unit. It may have been removed.'],
  ])('%s', (hint, message) => {
    expect(holdRefusalMessage(hint, context)).toBe(message)
  })

  it('seeker_has_hold names the hold the Seeker already has (D-008)', () => {
    expect(
      holdRefusalMessage('seeker_has_hold', {
        unitLabel: 'S4',
        currentHold: { unitLabel: 'S2', spaceName: 'Kapihan Study Hall' },
      }),
    ).toBe(
      "You're already holding S2 at Kapihan Study Hall. You can hold one unit at a time.",
    )
  })

  it('seeker_has_hold still reads well when the current hold is unknown', () => {
    expect(holdRefusalMessage('seeker_has_hold', context)).toBe(
      "You're already holding a unit. You can hold one unit at a time.",
    )
  })

  it('anything else gets the fallback', () => {
    for (const hint of [undefined, null, '', 'hold_changed', 'something_new']) {
      expect(holdRefusalMessage(hint, context)).toBe(HOLD_REFUSAL_FALLBACK)
    }
    expect(HOLD_REFUSAL_FALLBACK).toBe(
      'We could not hold the unit. Check your connection and try again.',
    )
  })
})
