import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog'

describe('Dialog primitive exports and slots (STORY-13, TSK-13.5, D-031)', () => {
  it('exports all standard dialog primitive components', () => {
    expect(Dialog).toBeDefined()
    expect(DialogClose).toBeDefined()
    expect(DialogContent).toBeDefined()
    expect(DialogDescription).toBeDefined()
    expect(DialogFooter).toBeDefined()
    expect(DialogHeader).toBeDefined()
    expect(DialogOverlay).toBeDefined()
    expect(DialogPortal).toBeDefined()
    expect(DialogTitle).toBeDefined()
    expect(DialogTrigger).toBeDefined()
  })

  it('renders header and footer slots cleanly', () => {
    const html = renderToStaticMarkup(
      <div>
        <DialogHeader>
          <span>Report review</span>
        </DialogHeader>
        <DialogFooter>
          <span>Footer actions</span>
        </DialogFooter>
      </div>,
    )

    expect(html).toContain('data-slot="dialog-header"')
    expect(html).toContain('data-slot="dialog-footer"')
    expect(html).toContain('Report review')
    expect(html).toContain('Footer actions')
  })
})
