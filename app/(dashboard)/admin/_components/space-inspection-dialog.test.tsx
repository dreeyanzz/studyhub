import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-slot="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-slot="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h2 data-slot="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div data-slot="dialog-description">{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div data-slot="dialog-footer">{children}</div>
  ),
}))

import { SpaceInspectionDialog } from './space-inspection-dialog'
import type { VerificationCardItem } from './verification-card'

const sampleSpace: VerificationCardItem = {
  id: 'e0000000-0000-4000-8000-000000000001',
  name: 'Cebu City Study Loft',
  description: 'Quiet sanctuary with power outlets and ergonomic chairs.',
  address: '456 Mango Ave, Cebu City',
  opens_at: '07:00:00',
  closes_at: '23:00:00',
  status: 'pending',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  host_name: 'Maria Santos',
  photos: [],
}

describe('SpaceInspectionDialog (STORY-15, STORY-17)', () => {
  it('returns null when closed or space is null', () => {
    expect(
      renderToStaticMarkup(
        <SpaceInspectionDialog
          space={sampleSpace}
          isOpen={false}
          onClose={() => {}}
          onApprove={async () => {}}
          onReject={async () => {}}
        />,
      ),
    ).toBe('')

    expect(
      renderToStaticMarkup(
        <SpaceInspectionDialog
          space={null}
          isOpen={true}
          onClose={() => {}}
          onApprove={async () => {}}
          onReject={async () => {}}
        />,
      ),
    ).toBe('')
  })

  it('renders Space attributes, real details, and decision buttons when open', () => {
    const html = renderToStaticMarkup(
      <SpaceInspectionDialog
        space={sampleSpace}
        isOpen={true}
        onClose={() => {}}
        onApprove={async () => {}}
        onReject={async () => {}}
      />,
    )

    // Name and address
    expect(html).toContain('Cebu City Study Loft')
    expect(html).toContain('456 Mango Ave, Cebu City')

    // Host and description
    expect(html).toContain('Maria Santos')
    expect(html).toContain('Quiet sanctuary with power outlets and ergonomic chairs.')

    // Empty photo state
    expect(html).toContain('No photos attached')

    // Decision buttons
    expect(html).toContain('Reject Space')
    expect(html).toContain('Approve &amp; Publish')

    // External map link (D-012 OpenStreetMap)
    expect(html).toContain('Open in OpenStreetMap')
    expect(html).toContain('https://www.openstreetmap.org/search?query=')

    // No fabricated data
    expect(html).not.toContain('12 Desks')
    expect(html).not.toContain('Wi-Fi (50+ Mbps)')
  })
})
