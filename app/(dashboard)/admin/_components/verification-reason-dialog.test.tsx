import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The action module is 'use server'; the form only needs its type.
vi.mock('@/app/(dashboard)/admin/actions', () => ({}))

import type { VerificationCardItem } from './verification-card'
import { RejectReasonForm } from './verification-reason-dialog'

const space: VerificationCardItem = {
  id: 'e0000000-0000-4000-8000-000000000010',
  name: 'Rejection Candidate Desk',
  description: null,
  address: '50 Test Street, Cebu City',
  opens_at: '08:00:00',
  closes_at: '17:00:00',
  status: 'pending',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  host_name: 'Hugo Santos',
}

const html = renderToStaticMarkup(
  <RejectReasonForm
    space={space}
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
