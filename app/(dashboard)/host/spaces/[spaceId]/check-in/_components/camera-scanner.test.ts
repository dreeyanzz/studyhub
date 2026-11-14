import { describe, expect, it } from 'vitest'

import { nextScan, type LastScan } from './camera-scanner'

const NONE: LastScan = { value: '', seenAt: 0 }

describe('nextScan (STORY-10 design §3: no double-triggering)', () => {
  it('submits a code the first time the scanner sees it', () => {
    expect(nextScan(NONE, 'H4ST1C0DE7AB', 10_000, false)).toEqual({
      submit: true,
      last: { value: 'H4ST1C0DE7AB', seenAt: 10_000 },
    })
  })

  it('submits a code held in frame for 10 s exactly once', () => {
    let last = NONE
    let submits = 0
    // A frame every 200 ms, with the check-in pending for the first second.
    for (let now = 10_000; now <= 20_000; now += 200) {
      const scan = nextScan(last, 'H4ST1C0DE7AB', now, now > 10_000 && now < 11_000)
      last = scan.last
      if (scan.submit) submits++
    }
    expect(submits).toBe(1)
  })

  it('submits the same code again once it has been out of frame for 2.5 s', () => {
    const seen: LastScan = { value: 'H4ST1C0DE7AB', seenAt: 10_000 }
    expect(nextScan(seen, 'H4ST1C0DE7AB', 12_400, false).submit).toBe(false)
    expect(nextScan(seen, 'H4ST1C0DE7AB', 12_500, false).submit).toBe(true)
  })

  it('submits a different code at once', () => {
    const seen: LastScan = { value: 'H4ST1C0DE7AB', seenAt: 10_000 }
    expect(nextScan(seen, 'C4NC3RD0NE9X', 10_200, false).submit).toBe(true)
  })

  it('holds a new code while a check-in is pending, then submits it', () => {
    const seen: LastScan = { value: 'H4ST1C0DE7AB', seenAt: 10_000 }
    const during = nextScan(seen, 'C4NC3RD0NE9X', 10_200, true)
    expect(during).toEqual({ submit: false, last: seen })
    expect(nextScan(during.last, 'C4NC3RD0NE9X', 10_400, false).submit).toBe(true)
  })
})
