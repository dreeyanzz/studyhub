import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CheckInResult } from '../actions'
import { CheckInResultBanner } from './check-in-result-banner'

const SPACE_ID = 'e0000000-0000-4000-8000-000000000003'

const RESULTS: CheckInResult[] = [
  { outcome: 'success', unitLabel: 'U1', zoneName: 'Open desks' },
  { outcome: 'wait_window_lapsed', unitLabel: 'U1' },
  { outcome: 'token_already_used' },
  { outcome: 'reservation_cancelled' },
  { outcome: 'wrong_space' },
  { outcome: 'invalid_token' },
  { outcome: 'forbidden' },
  { outcome: 'error' },
]

describe('CheckInResultBanner (STORY-10 design §3, C1–C7)', () => {
  it.each(RESULTS)(
    '$outcome uses light colours only, with no dark: classes',
    (result) => {
      const html = renderToStaticMarkup(
        <CheckInResultBanner spaceId={SPACE_ID} result={result} />,
      )

      // The app has no dark theme (D-031), so a dark: class would follow the OS setting
      // and put pale text on a muddy banner on the light page (#306).
      expect(html).not.toContain('dark:')
    },
  )

  it('keeps the emerald success and amber warning palettes', () => {
    const success = renderToStaticMarkup(
      <CheckInResultBanner
        spaceId={SPACE_ID}
        result={{ outcome: 'success', unitLabel: 'U1', zoneName: 'Open desks' }}
      />,
    )
    const warning = renderToStaticMarkup(
      <CheckInResultBanner
        spaceId={SPACE_ID}
        result={{ outcome: 'token_already_used' }}
      />,
    )

    expect(success).toContain('bg-emerald-50 text-emerald-950')
    expect(success).toContain('Checked in unit U1 (Open desks)')
    expect(warning).toContain('bg-amber-50 text-amber-950')
    expect(warning).toContain('This token was already checked in.')
  })
})
