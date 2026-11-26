'use client'

import { useState, type MouseEvent } from 'react'
import { AlertCircle } from 'lucide-react'

import type { SetSpaceStatusResult } from '@/app/(dashboard)/admin/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { VerificationCardItem } from './verification-card'

/** Undo a rejection (V9) or put a taken-down Space back (V10). */
export type ConfirmMode = 'undo' | 'put_back'

/** The design's words for each confirmation (STORY-20 design §3, screen 1). */
export function confirmCopy(mode: ConfirmMode, name: string) {
  return mode === 'undo'
    ? {
        title: 'Undo rejection?',
        body: `${name} will become Verified and visible in public search immediately, and its rejection reason will be cleared. Holds cancelled by the rejection stay cancelled.`,
        confirm: 'Undo rejection',
        pending: 'Undoing...',
      }
    : {
        title: 'Put Space back?',
        body: `${name} will become Verified and visible in public search again, and its take-down reason will be cleared. Holds cancelled by the take-down stay cancelled.`,
        confirm: 'Put back',
        pending: 'Putting back...',
      }
}

export interface VerificationConfirmDialogProps {
  space: VerificationCardItem | null
  mode: ConfirmMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (space: VerificationCardItem) => Promise<SetSpaceStatusResult>
  onReload?: () => void
}

/**
 * Focus-trapped confirmation on `components/ui/alert-dialog.tsx` before Undo (V9) or Put
 * back (V10) runs (STORY-20 design §3). Escape or "Cancel" closes it and returns focus to
 * the card's button. A refusal shows inside the dialog, with "Reload latest version"
 * when the Space has changed (N9, N5).
 */
export function VerificationConfirmDialog({
  space,
  mode,
  open,
  onOpenChange,
  onConfirm,
  onReload,
}: VerificationConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<{ message: string; reload: boolean } | null>(null)
  const copy = space ? confirmCopy(mode, space.name) : null

  async function handleConfirm(event: MouseEvent) {
    // Keep the dialog open until the action answers.
    event.preventDefault()
    if (!space) return
    setIsPending(true)
    setError(null)
    try {
      const result = await onConfirm(space)
      if (result.success) onOpenChange(false)
      else setError({ message: result.error, reload: Boolean(result.reload) })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog
      open={open && Boolean(space)}
      onOpenChange={(next) => {
        if (isPending) return
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      {copy ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription className="wrap-anywhere">
              {copy.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <AlertDescription className="space-y-3">
                <p>{error.message}</p>
                {error.reload && onReload ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onReload}
                    className="h-auto min-h-12 min-w-12 py-2 whitespace-normal"
                  >
                    Reload latest version
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isPending}
              className="h-auto min-h-12 min-w-12 py-2 whitespace-normal"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              aria-busy={isPending}
              onClick={handleConfirm}
              className="h-auto min-h-12 min-w-12 py-2 whitespace-normal"
            >
              {isPending ? copy.pending : copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  )
}
