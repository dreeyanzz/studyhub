import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'

describe('AlertDialog primitive exports and slots (TSK-12.6, D-031)', () => {
  it('exports all standard alert dialog primitive components', () => {
    expect(AlertDialog).toBeDefined()
    expect(AlertDialogAction).toBeDefined()
    expect(AlertDialogCancel).toBeDefined()
    expect(AlertDialogContent).toBeDefined()
    expect(AlertDialogDescription).toBeDefined()
    expect(AlertDialogFooter).toBeDefined()
    expect(AlertDialogHeader).toBeDefined()
    expect(AlertDialogMedia).toBeDefined()
    expect(AlertDialogOverlay).toBeDefined()
    expect(AlertDialogPortal).toBeDefined()
    expect(AlertDialogTitle).toBeDefined()
    expect(AlertDialogTrigger).toBeDefined()
  })

  it('renders header, footer, media, and action button with accessible attributes and 48px touch targets', () => {
    const html = renderToStaticMarkup(
      <div>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <span data-testid="media-icon">Icon</span>
          </AlertDialogMedia>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="destructive">
            Cancel hold and mark Available
          </AlertDialogAction>
        </AlertDialogFooter>
      </div>,
    )

    expect(html).toContain('data-slot="alert-dialog-header"')
    expect(html).toContain('data-slot="alert-dialog-media"')
    expect(html).toContain('Icon')
    expect(html).toContain('data-slot="alert-dialog-footer"')
    expect(html).toContain('data-slot="alert-dialog-action"')
    expect(html).toContain('Cancel hold and mark Available')
    // Destructive variant and 48x48 px touch target (D-031)
    expect(html).toMatch(/\bmin-h-12\b/)
    expect(html).toMatch(/\bmin-w-12\b/)
  })
})
