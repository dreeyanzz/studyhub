import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ReservationHistoryCard } from './reservation-history-card'

describe('ReservationHistoryCard (STORY-16 design §3)', () => {
  it('renders heading, description, and link to /seeker/reservations', () => {
    const html = renderToStaticMarkup(<ReservationHistoryCard />)

    expect(html).toContain('aria-labelledby="reservation-history-heading"')
    expect(html).toMatch(
      /<h2 id="reservation-history-heading"[^>]*>Reservation history<\/h2>/,
    )
    expect(html).toContain(
      'See past paid holds, hold the same unit again, or leave a review.',
    )
    expect(html).toMatch(
      /<a[^>]*href="\/seeker\/reservations"[^>]*>.*View reservation history<\/a>/,
    )
  })
})
