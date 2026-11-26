import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The action module is 'use server'; the form only needs its type.
vi.mock('@/app/(dashboard)/admin/actions', () => ({}))

import type { VerificationCardItem } from './verification-card'
import { showsHoldWarning, VerificationReasonForm } from './verification-reason-dialog'

const space: VerificationCardItem = {
  id: 'e0000000-0000-4000-8000-000000000010',
  name: 'Rejection Candidate Desk',
  description: null,
  address: '50 Test Street, Cebu City',
  opens_at: '08:00:00',
  closes_at: '17:00:00',
  status: 'pending',
  status_reason: null,
  status_changed_at: '2026-11-01T08:00:00Z',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  host_name: 'Hugo Santos',
  origin: null,
  events: [],
}

const html = renderToStaticMarkup(
  <VerificationReasonForm
    space={space}
    mode="rejected"
    onConfirm={async () => ({ success: true, spaceId: space.id, status: 'rejected' })}
    onDone={() => {}}
    onCancel={() => {}}
  />,
)

describe('RejectReasonForm (STORY-20 design §3, TSK-20.1, N10)', () => {
  it('asks for a labelled reason of at most 500 characters', () => {
    const id = html.match(/<label for="([^"]+)"[^>]*>Reason<\/label>/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`<textarea[^>]*id="${id}"[^>]*maxLength="500"`))
    expect(html).toMatch(/<textarea[^>]*required=""/)
  })

  it('counts the characters left, and the textarea points to the count', () => {
    expect(html).toContain('500 / 500 characters remaining')
    const countId = html.match(/<p id="([^"]+)"[^>]*>500 \/ 500/)?.[1]
    expect(html).toMatch(new RegExp(`<textarea[^>]*aria-describedby="${countId}"`))
  })

  it('offers Cancel and Confirm rejection, each at least 48 px', () => {
    for (const label of ['Cancel', 'Confirm rejection']) {
      expect(html).toMatch(
        new RegExp(
          `<button[^>]*class="[^"]*min-h-12[^"]*min-w-12[^"]*"[^>]*>${label}</button>`,
        ),
      )
    }
    expect(html).toMatch(/<button type="submit"[^>]*>Confirm rejection<\/button>/)
  })

  it('shows no error before the Administrator submits', () => {
    expect(html).not.toContain('role="alert"')
  })
})

describe('VerificationReasonForm take-down mode and hold warning (STORY-20, TSK-20.3)', () => {
  const renderForm = (mode: 'rejected' | 'taken_down', item = space) =>
    renderToStaticMarkup(
      <VerificationReasonForm
        space={item}
        mode={mode}
        onConfirm={async () => ({ success: true, spaceId: item.id, status: mode })}
        onDone={() => {}}
        onCancel={() => {}}
      />,
    )

  it('offers "Take down Space" and warns that unstarted holds are cancelled (V7)', () => {
    const html = renderForm('taken_down')
    expect(html).toMatch(/<button type="submit"[^>]*>Take down Space<\/button>/)
    expect(html).toContain('Taking this Space down hides it from Seekers at once.')
  })

  it('warns about holds when rejecting an Edited Space only (V3 after V6)', () => {
    expect(renderForm('rejected')).not.toContain('Unstarted holds')
    expect(renderForm('rejected', { ...space, origin: 'edited' })).toContain(
      'Unstarted holds (Pending Payment and Reserved) will be cancelled',
    )
  })

  it('showsHoldWarning follows the design', () => {
    expect(showsHoldWarning('taken_down', space)).toBe(true)
    expect(showsHoldWarning('rejected', space)).toBe(false)
    expect(showsHoldWarning('rejected', { ...space, origin: 'resubmitted' })).toBe(false)
    expect(showsHoldWarning('rejected', { ...space, origin: 'edited' })).toBe(true)
  })
})
