import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('../actions', () => ({
  moderateReviewAction: vi.fn(),
}))

import type { AdminReviewQueueItem, ModerationEventItem } from '@/lib/data/admin'
import { ModerationQueue } from './moderation-queue'

const REVIEW_ID = '11111111-1111-4111-8111-111111111111'
const SPACE_ID = '22222222-2222-4222-8222-222222222222'

function sampleItem(overrides: Partial<AdminReviewQueueItem> = {}): AdminReviewQueueItem {
  return {
    reviewId: REVIEW_ID,
    status: 'visible',
    spaceId: SPACE_ID,
    spaceName: 'Kapihan Study Hall',
    spaceStatus: 'verified',
    authorId: '33333333-3333-4333-8333-333333333333',
    authorFullName: 'Rina Bautista',
    quietness: 5,
    wifiReliability: 4,
    cleanliness: 5,
    comfort: 4,
    overall: 4.5,
    comment: '<script>alert(1)</script> Quiet desks.',
    version: 2,
    editedAt: '2026-11-24T04:00:00Z',
    createdAt: '2026-11-24T02:00:00Z',
    statusChangedBy: null,
    statusChangedByFullName: null,
    statusChangedAt: null,
    openReportCount: 2,
    reports: [
      {
        id: 'rep-1',
        reporterId: '44444444-4444-4444-8444-444444444444',
        reporterFullName: 'Sam Dela Cruz',
        reason: 'spam',
        note: 'Repeated link.',
        reviewVersion: 1,
        createdAt: '2026-11-24T03:00:00Z',
        outcome: null,
        closedBy: null,
        closedByFullName: null,
        closedAt: null,
      },
    ],
    ...overrides,
  }
}

const sampleHistory: Record<string, ModerationEventItem[]> = {
  [REVIEW_ID]: [
    {
      id: 'ev-1',
      reviewId: REVIEW_ID,
      action: 'restore',
      actorId: 'admin-1',
      actorFullName: 'Alma Reyes',
      createdAt: '2026-11-24T05:00:00Z',
    },
  ],
}

describe('ModerationQueue (STORY-14, TSK-14.3)', () => {
  it('renders Reported review details, escaped plain-text comment, edited-after-report badge, history, and Hide/Remove/Dismiss actions', () => {
    const html = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem()]}
        historyByReviewId={sampleHistory}
        list="reported"
        shown={25}
        hasMore={false}
      />,
    )

    const reportedTab =
      html.match(/<a\b[^>]*data-testid="moderation-tab-reported"[^>]*>/)?.[0] ?? ''
    expect(reportedTab).toContain('aria-current="page"')
    expect(reportedTab).toContain('href="/admin/moderation?list=reported"')
    expect(html).toContain(`href="/spaces/${SPACE_ID}"`)
    expect(html).toContain('Kapihan Study Hall')
    expect(html).toContain('Rina Bautista')
    expect(html).toContain('2 open reports')
    expect(html).toContain('edited after this report')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    // SRS §3.5.2: comment is escaped as text, never emitted as an executable <script> tag
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Quiet desks.')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('Moderation history')
    expect(html).toContain('Restored')
    expect(html).toContain('Alma Reyes')
    expect(html).toContain(`data-testid="moderation-dismiss-${REVIEW_ID}"`)
    expect(html).toContain(`data-testid="moderation-hide-${REVIEW_ID}"`)
    expect(html).toContain(`data-testid="moderation-remove-${REVIEW_ID}"`)
    expect(html).not.toContain(`data-testid="moderation-restore-${REVIEW_ID}"`)
  })

  it('shows Restore and Remove on Hidden (with plain-text unverified Space name) and no action buttons on Removed', () => {
    const hiddenHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[
          sampleItem({
            status: 'hidden',
            spaceStatus: 'pending',
            statusChangedByFullName: 'Alma Reyes',
            statusChangedAt: '2026-11-24T06:00:00Z',
          }),
        ]}
        historyByReviewId={sampleHistory}
        list="hidden"
        shown={25}
        hasMore={false}
      />,
    )

    expect(hiddenHtml).not.toContain(`href="/spaces/${SPACE_ID}"`)
    expect(hiddenHtml).toContain('Kapihan Study Hall')
    expect(hiddenHtml).toContain('Hidden by Alma Reyes')
    expect(hiddenHtml).toContain(`data-testid="moderation-restore-${REVIEW_ID}"`)
    expect(hiddenHtml).toContain(`data-testid="moderation-remove-${REVIEW_ID}"`)
    expect(hiddenHtml).not.toContain(`data-testid="moderation-hide-${REVIEW_ID}"`)
    expect(hiddenHtml).not.toContain(`data-testid="moderation-dismiss-${REVIEW_ID}"`)

    const removedHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[
          sampleItem({
            status: 'removed',
            statusChangedByFullName: 'Alma Reyes',
            statusChangedAt: '2026-11-24T06:00:00Z',
          }),
        ]}
        historyByReviewId={sampleHistory}
        list="removed"
        shown={25}
        hasMore={false}
      />,
    )

    expect(removedHtml).toContain('Removed by Alma Reyes')
    expect(removedHtml).not.toContain(`data-testid="moderation-restore-${REVIEW_ID}"`)
    expect(removedHtml).not.toContain(`data-testid="moderation-remove-${REVIEW_ID}"`)
    expect(removedHtml).not.toContain(`data-testid="moderation-hide-${REVIEW_ID}"`)
    expect(removedHtml).not.toContain(`data-testid="moderation-dismiss-${REVIEW_ID}"`)
  })

  it('names every action button after its review, so repeated cards stay distinguishable (#431, D-031)', () => {
    const OTHER_ID = '55555555-5555-4555-8555-555555555555'
    const buttonHtml = (html: string, testId: string) =>
      html.match(
        new RegExp(`<button\\b[^>]*data-testid="${testId}"[^>]*>.*?</button>`),
      )?.[0] ?? ''
    const identity =
      '<span class="sr-only"> Kapihan Study Hall, review by Rina Bautista</span>'

    const reportedHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem(), sampleItem({ reviewId: OTHER_ID })]}
        historyByReviewId={{}}
        list="reported"
        shown={25}
        hasMore={false}
      />,
    )
    for (const [action, label] of [
      ['dismiss', 'Dismiss reports'],
      ['hide', 'Hide'],
      ['remove', 'Remove'],
    ] as const) {
      for (const id of [REVIEW_ID, OTHER_ID]) {
        const button = buttonHtml(reportedHtml, `moderation-${action}-${id}`)
        expect(button).toContain(`>${label}${identity}</button>`)
      }
    }

    const hiddenHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem({ status: 'hidden' })]}
        historyByReviewId={{}}
        list="hidden"
        shown={25}
        hasMore={false}
      />,
    )
    for (const [action, label] of [
      ['restore', 'Restore'],
      ['remove', 'Remove'],
    ] as const) {
      expect(buttonHtml(hiddenHtml, `moderation-${action}-${REVIEW_ID}`)).toContain(
        `>${label}${identity}</button>`,
      )
    }
  })

  it('lists only open reports on Reported, and every report with its outcome on Hidden', () => {
    const closedReport = {
      ...sampleItem().reports[0]!,
      id: 'rep-closed',
      reason: 'offensive' as const,
      note: 'Dismissed earlier.',
      outcome: 'dismissed' as const,
      closedBy: 'admin-1',
      closedByFullName: 'Alma Reyes',
      closedAt: '2026-11-24T03:30:00Z',
    }
    const withClosed = sampleItem({
      openReportCount: 1,
      reports: [closedReport, ...sampleItem().reports],
    })

    const reportedHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[withClosed]}
        historyByReviewId={sampleHistory}
        list="reported"
        shown={25}
        hasMore={false}
      />,
    )
    expect(reportedHtml).toContain('Open reports (1)')
    expect(reportedHtml).toContain('data-testid="moderation-report-rep-1"')
    expect(reportedHtml).not.toContain('data-testid="moderation-report-rep-closed"')
    expect(reportedHtml).not.toContain('Dismissed earlier.')

    const hiddenHtml = renderToStaticMarkup(
      <ModerationQueue
        items={[{ ...withClosed, status: 'hidden', openReportCount: 0 }]}
        historyByReviewId={sampleHistory}
        list="hidden"
        shown={25}
        hasMore={false}
      />,
    )
    expect(hiddenHtml).toContain('Reports (2)')
    expect(hiddenHtml).toContain('data-testid="moderation-report-rep-closed"')
    expect(hiddenHtml).toContain('Outcome: Dismissed')
  })

  it('keeps the live status region empty until an action finishes', () => {
    const html = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem()]}
        historyByReviewId={sampleHistory}
        list="reported"
        shown={25}
        hasMore={false}
      />,
    )
    const status =
      html.match(/<div[^>]*data-testid="moderation-live-status"[^>]*>([^<]*)<\/div>/) ??
      []
    expect(status[0]).toContain('sr-only')
    expect(status[1]).toBe('')
    expect(html).toContain('tabindex="-1"')
  })

  it('renders empty states for each list and Show more / 100-item cap copy', () => {
    expect(
      renderToStaticMarkup(
        <ModerationQueue
          items={[]}
          historyByReviewId={{}}
          list="reported"
          shown={25}
          hasMore={false}
        />,
      ),
    ).toContain('No reported reviews')

    expect(
      renderToStaticMarkup(
        <ModerationQueue
          items={[]}
          historyByReviewId={{}}
          list="hidden"
          shown={25}
          hasMore={false}
        />,
      ),
    ).toContain('No hidden reviews')

    expect(
      renderToStaticMarkup(
        <ModerationQueue
          items={[]}
          historyByReviewId={{}}
          list="removed"
          shown={25}
          hasMore={false}
        />,
      ),
    ).toContain('No removed reviews')

    const withMore = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem()]}
        historyByReviewId={{}}
        list="reported"
        shown={25}
        hasMore={true}
      />,
    )
    expect(withMore).toContain('href="/admin/moderation?list=reported&amp;show=50"')
    expect(withMore).toContain('Show more')

    const atCap = renderToStaticMarkup(
      <ModerationQueue
        items={[sampleItem()]}
        historyByReviewId={{}}
        list="reported"
        shown={100}
        hasMore={true}
      />,
    )
    expect(atCap).toContain('Showing the first 100 reviews in this list.')
    expect(atCap).not.toContain('Show more')
  })
})
