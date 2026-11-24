import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ReservationHistoryItem } from '@/lib/data/history'

import { HistoryRow } from './history-row'

describe('HistoryRow (STORY-16 design §3)', () => {
  const baseItem: ReservationHistoryItem = {
    reservationId: '10000000-0000-4000-8000-000000000001',
    reservationStatus: 'completed',
    createdAt: '2026-11-20T10:00:00.000Z',
    checkedInAt: '2026-11-20T10:15:00.000Z',
    endedAt: '2026-11-20T12:00:00.000Z',
    spaceId: 'e0000000-0000-4000-8000-000000000001',
    spaceName: 'Kapihan Study Hall',
    spaceListed: true,
    unitId: 'u0000000-0000-4000-8000-000000000001',
    unitLabel: 'Desk 1',
    paymentStatus: 'paid',
    feeAmount: 5000,
    refundedAt: null,
    reviewId: null,
    reviewStatus: null,
  }

  it('renders Space name as a link when spaceListed is true', () => {
    const html = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(html).toContain('href="/spaces/e0000000-0000-4000-8000-000000000001"')
    expect(html).toContain('Kapihan Study Hall')
  })

  it('gives each row a heading and a 48 px Space-name link (Accessibility)', () => {
    const html = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(html).toMatch(/<h2[^>]*>.*Kapihan Study Hall.*<\/h2>/)
    expect(html).toContain('inline-flex min-h-12 min-w-12 items-center')
  })

  it('lets the Hold again label wrap on narrow screens', () => {
    const html = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(html).toMatch(/class="[^"]*whitespace-normal[^"]*"[^>]*>Hold again/)
  })

  it('renders Space name as text when spaceListed is false', () => {
    const html = renderToStaticMarkup(
      <HistoryRow item={{ ...baseItem, spaceListed: false }} />,
    )
    expect(html).not.toContain('href="/spaces/e0000000-0000-4000-8000-000000000001"')
    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('This Space isn&#x27;t listed right now')
  })

  it('renders unit label and appends (removed) if unitId is null', () => {
    const normalHtml = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(normalHtml).toContain('Desk 1')
    expect(normalHtml).not.toContain('Desk 1 (removed)')

    const removedHtml = renderToStaticMarkup(
      <HistoryRow item={{ ...baseItem, unitId: null }} />,
    )
    expect(removedHtml).toContain('Desk 1 (removed)')
    expect(removedHtml).toContain(
      'href="/spaces/e0000000-0000-4000-8000-000000000001?from=history&amp;unit_removed=1"',
    )
  })

  it('links Hold again with unit param when unitId is present and listed', () => {
    const html = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(html).toContain(
      'href="/spaces/e0000000-0000-4000-8000-000000000001?unit=u0000000-0000-4000-8000-000000000001&amp;from=history"',
    )
    expect(html).toContain('Hold again')
  })

  it('formats outcome and fee fate correctly', () => {
    const completedHtml = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(completedHtml).toContain('Visit completed')
    expect(completedHtml).toContain('₱50.00 paid')

    const noShowHtml = renderToStaticMarkup(
      <HistoryRow
        item={{ ...baseItem, reservationStatus: 'no_show', paymentStatus: 'forfeited' }}
      />,
    )
    expect(noShowHtml).toContain('Missed check-in (no-show)')
    expect(noShowHtml).toContain('₱50.00 forfeited')

    const cancelledRefundedHtml = renderToStaticMarkup(
      <HistoryRow
        item={{
          ...baseItem,
          reservationStatus: 'cancelled',
          paymentStatus: 'refunded',
          refundedAt: '2026-11-20T11:00:00.000Z',
        }}
      />,
    )
    expect(cancelledRefundedHtml).toContain('Hold cancelled')
    expect(cancelledRefundedHtml).toContain('₱50.00 refunded (Nov 20, 2026)')

    const expiredHtml = renderToStaticMarkup(
      <HistoryRow item={{ ...baseItem, reservationStatus: 'expired' }} />,
    )
    expect(expiredHtml).toContain('Payment arrived after hold ended')
  })

  it('does not render review action if checkedInAt is null', () => {
    const html = renderToStaticMarkup(
      <HistoryRow
        item={{
          ...baseItem,
          reservationStatus: 'no_show',
          checkedInAt: null,
        }}
      />,
    )
    expect(html).not.toContain('Leave a review')
    expect(html).not.toContain('Edit your review')
    expect(html).not.toContain('Reviewed')
  })

  it('shows no review controls before TSK-16.4 wires ReviewDialog (#385)', () => {
    const html = renderToStaticMarkup(<HistoryRow item={baseItem} />)
    expect(html).not.toContain('Leave a review')
    expect(html).not.toContain('Edit your review')
    expect(html).not.toContain('<button')
  })

  it('renders Reviewed, without an edit control, when review is visible', () => {
    const html = renderToStaticMarkup(
      <HistoryRow
        item={{
          ...baseItem,
          reviewId: 'r0000000-0000-4000-8000-000000000001',
          reviewStatus: 'visible',
        }}
      />,
    )
    expect(html).toContain('Reviewed')
    expect(html).not.toContain('Edit your review')
  })

  it('renders hidden or removed notice when review was moderated', () => {
    const hiddenHtml = renderToStaticMarkup(
      <HistoryRow
        item={{
          ...baseItem,
          reviewId: 'r0000000-0000-4000-8000-000000000001',
          reviewStatus: 'hidden',
        }}
      />,
    )
    expect(hiddenHtml).toContain('Review hidden by an Administrator')
    expect(hiddenHtml).not.toContain('Edit your review')

    const removedHtml = renderToStaticMarkup(
      <HistoryRow
        item={{
          ...baseItem,
          reviewId: 'r0000000-0000-4000-8000-000000000001',
          reviewStatus: 'removed',
        }}
      />,
    )
    expect(removedHtml).toContain('Review removed by an Administrator')
    expect(removedHtml).not.toContain('Edit your review')
  })
})
