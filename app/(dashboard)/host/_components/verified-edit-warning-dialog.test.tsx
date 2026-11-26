import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The real AlertDialog renders in a portal, which a static render can't show. This
// stand-in renders its parts in place, and only while open, as STORY-12's
// override-warning-dialog test does.
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-slot="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => (
    <button type="button" data-slot="alert-dialog-action">
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button" data-slot="alert-dialog-cancel">
      {children}
    </button>
  ),
}))

import { VerifiedEditWarningDialog } from './verified-edit-warning-dialog'

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'")

describe('VerifiedEditWarningDialog (STORY-20 design §3, V6, D-079)', () => {
  const props = {
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    returnFocusTo: { current: null },
  }

  it('says what saving does, with Cancel and "Save and send for review"', () => {
    const html = renderToStaticMarkup(<VerifiedEditWarningDialog open {...props} />)
    expect(text(html)).toContain('Send Space back to Pending verification?')
    expect(text(html)).toContain(
      "Changing a Verified Space's name, address, or map pin hides it from Seekers until an Administrator approves it again. Holds already made here will keep running.",
    )
    expect(html).toContain('<button type="button" data-slot="alert-dialog-cancel">Cancel')
    expect(html).toContain('data-slot="alert-dialog-action">Save and send for review')
  })

  it('renders nothing while closed', () => {
    expect(
      renderToStaticMarkup(<VerifiedEditWarningDialog open={false} {...props} />),
    ).toBe('')
  })
})
