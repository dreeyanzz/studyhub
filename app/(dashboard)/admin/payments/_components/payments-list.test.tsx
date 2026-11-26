import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('../actions', () => ({
  refundPaymentAction: vi.fn(),
}))

import type { AdminPaymentRecordItem } from '@/lib/data/admin'
import { PaymentsList } from './payments-list'
import { RefundForm } from './refund-dialog'

const PAYMENT_1 = '11111111-1111-4111-8111-111111111111'
const PAYMENT_2 = '22222222-2222-4222-8222-222222222222'

function samplePayment(
  overrides: Partial<AdminPaymentRecordItem> = {},
): AdminPaymentRecordItem {
  return {
    paymentId: PAYMENT_1,
    paymentStatus: 'paid',
    feeAmount: 5000,
    paidAt: '2026-11-24T02:00:00Z',
    paymentIntentId: 'pi_test_14_01',
    refundId: null,
    refundedAt: null,
    refundedBy: null,
    refundedByFullName: null,
    refundReason: null,
    reservationId: '33333333-3333-4333-8333-333333333333',
    reservationStatus: 'cancelled',
    unitLabel: 'S4',
    checkedInAt: null,
    endedAt: '2026-11-24T02:15:00Z',
    spaceId: '44444444-4444-4444-8444-444444444444',
    spaceName: 'Kapihan Study Hall',
    seekerFullName: 'Sam Dela Cruz',
    refundable: true,
    ...overrides,
  }
}

describe('PaymentsList and RefundForm (STORY-14, TSK-14.4)', () => {
  it('renders filter tabs with aria-current, status words, fee, payment intent, and Refund button only when refundable', () => {
    const refunded = samplePayment({
      paymentId: PAYMENT_2,
      paymentStatus: 'refunded',
      refundable: false,
      refundId: 're_test_14_02',
      refundedAt: '2026-11-24T03:00:00Z',
      refundedBy: 'admin-1',
      refundedByFullName: 'Alma Reyes',
      refundReason: 'Host overrode the hold.',
    })

    const html = renderToStaticMarkup(
      <PaymentsList
        items={[samplePayment(), refunded]}
        filter="all"
        shown={25}
        hasMore={false}
      />,
    )

    const allTab =
      html.match(/<a\b[^>]*data-testid="payments-filter-all"[^>]*>/)?.[0] ?? ''
    expect(allTab).toContain('aria-current="page"')
    expect(html).toContain('Payment Records')
    expect(html).toContain('Paid')
    expect(html).toContain('Refunded')
    expect(html).toContain('₱50.00')
    expect(html).toContain('pi_test_14_01')
    expect(html).toContain('re_test_14_02')
    expect(html).toContain('Alma Reyes')
    expect(html).toContain('Host overrode the hold.')
    expect(html).toContain(`data-testid="payment-refund-trigger-${PAYMENT_1}"`)
    expect(html).not.toContain(`data-testid="payment-refund-trigger-${PAYMENT_2}"`)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })

  it('renders empty state and Show more / 100-item cap copy', () => {
    expect(
      renderToStaticMarkup(
        <PaymentsList items={[]} filter="refundable" shown={25} hasMore={false} />,
      ),
    ).toContain('No payments match this filter.')

    const withMore = renderToStaticMarkup(
      <PaymentsList items={[samplePayment()]} filter="paid" shown={25} hasMore={true} />,
    )
    expect(withMore).toContain('href="/admin/payments?status=paid&amp;show=50"')
    expect(withMore).toContain('Show more')

    const atCap = renderToStaticMarkup(
      <PaymentsList items={[samplePayment()]} filter="all" shown={100} hasMore={true} />,
    )
    expect(atCap).toContain('Showing the first 100 payments for this filter.')
    expect(atCap).not.toContain('Show more')
  })

  it('renders RefundForm with full refund amount, 300-char counter, Confirm refund, and Cancel', () => {
    const html = renderToStaticMarkup(
      <RefundForm
        payment={samplePayment()}
        idPrefix="refund-test"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('Kapihan Study Hall · S4')
    expect(html).toContain('Sam Dela Cruz')
    expect(html).toContain('Full refund: ₱50.00')
    expect(html).toContain('Reason')
    expect(html).toContain('maxLength="300"')
    expect(html).toContain('300 / 300 characters remaining')
    expect(html).toContain('Confirm refund')
    expect(html).toContain('Cancel')
    expect(html).toContain('min-h-12')
    expect(html).toContain(`value="${PAYMENT_1}"`)
  })
})
