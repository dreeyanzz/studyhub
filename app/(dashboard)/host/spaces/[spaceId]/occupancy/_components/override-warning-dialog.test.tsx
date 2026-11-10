import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-slot="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-slot="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2 data-slot="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div data-slot="alert-dialog-description">{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div data-slot="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({
    children,
    disabled,
    variant,
  }: {
    children: ReactNode
    disabled?: boolean
    variant?: string
  }) => (
    <button
      type="button"
      data-slot="alert-dialog-action"
      data-variant={variant}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: ReactNode
    disabled?: boolean
  }) => (
    <button type="button" data-slot="alert-dialog-cancel" disabled={disabled}>
      {children}
    </button>
  ),
}))

import { OverrideWarningDialog } from './override-warning-dialog'

describe('OverrideWarningDialog (TSK-12.6, FR-3.2, Moves R5, R9, R11, D-050)', () => {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn()

  it('renders status-specific title, description, and action button naming target state for unpaid pending hold (Move R5)', () => {
    const html = renderToStaticMarkup(
      <OverrideWarningDialog
        open={true}
        onOpenChange={onOpenChange}
        unitLabel="Desk A-1"
        currentStatus="pending_payment"
        targetState="available"
        isSubmitting={false}
        onConfirm={onConfirm}
      />,
    )

    expect(html).toContain('Override active hold?')
    expect(html).toContain('Unit: Desk A-1')
    expect(html).toContain(
      'This unit currently has an unpaid hold. Overriding it will cancel the Seeker&#x27;s hold and mark this unit Available. Proceed?',
    )
    expect(html).toContain('Cancel hold and mark Available')
    expect(html).toContain('Cancel')
    expect(html).not.toContain('disabled')
  })

  it('renders status-specific title, description, and action button naming target state for paid reservation hold (Move R9)', () => {
    const html = renderToStaticMarkup(
      <OverrideWarningDialog
        open={true}
        onOpenChange={onOpenChange}
        unitLabel="Room 101"
        currentStatus="reserved"
        targetState="occupied"
        isSubmitting={false}
        onConfirm={onConfirm}
      />,
    )

    expect(html).toContain('Override active hold?')
    expect(html).toContain('Unit: Room 101')
    expect(html).toContain(
      'The Seeker has already paid for this hold. Overriding it will cancel their hold and mark this unit Occupied, and their fee stays paid until an Administrator refunds it. Proceed?',
    )
    expect(html).toContain('Cancel hold and mark Occupied')
  })

  it('renders status-specific title "End this visit?" and consequence for checked-in occupied visit (Move R11)', () => {
    const html = renderToStaticMarkup(
      <OverrideWarningDialog
        open={true}
        onOpenChange={onOpenChange}
        unitLabel="Pod B"
        currentStatus="occupied"
        targetState="available"
        isSubmitting={false}
        onConfirm={onConfirm}
      />,
    )

    expect(html).toContain('End this visit?')
    expect(html).toContain('Unit: Pod B')
    expect(html).toContain(
      'A Seeker is currently checked in at this unit. Setting this state to Available will end their visit. Proceed?',
    )
    expect(html).toContain('End visit and mark Available')
  })

  it('disables cancel and action buttons when isSubmitting is true', () => {
    const html = renderToStaticMarkup(
      <OverrideWarningDialog
        open={true}
        onOpenChange={onOpenChange}
        unitLabel="Desk A-1"
        currentStatus="reserved"
        targetState="available"
        isSubmitting={true}
        onConfirm={onConfirm}
      />,
    )

    expect(html).toContain('disabled=""')
  })

  it('renders nothing when open is false', () => {
    const html = renderToStaticMarkup(
      <OverrideWarningDialog
        open={false}
        onOpenChange={onOpenChange}
        unitLabel="Desk A-1"
        currentStatus="reserved"
        targetState="available"
        isSubmitting={false}
        onConfirm={onConfirm}
      />,
    )

    expect(html).not.toContain('Override active hold?')
    expect(html).not.toContain('Desk A-1')
  })
})
