'use client'

import type { RefObject } from 'react'

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

export interface VerifiedEditWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** Where focus goes when the dialog closes: the form's "Save changes" button. */
  returnFocusTo: RefObject<HTMLElement | null>
}

/**
 * The warning before a Host saves a new name, address or map pin for a Verified
 * Space, which sends it back to Pending verification (V6, STORY-20 design §3, D-079).
 * The AlertDialog traps focus while open. Escape and "Cancel" close it without
 * saving, and focus returns to "Save changes" (design §3, Accessibility).
 */
export function VerifiedEditWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  returnFocusTo,
}: VerifiedEditWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent finalFocus={returnFocusTo}>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Space back to Pending verification?</AlertDialogTitle>
          <AlertDialogDescription>
            Changing a Verified Space&apos;s name, address, or map pin hides it from
            Seekers until an Administrator approves it again. Holds already made here will
            keep running.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Save and send for review
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
