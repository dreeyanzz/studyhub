'use client'

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
import { getOverrideCopy } from '@/lib/occupancy/override'
import type { ExpectedReservationStatus, UnitState } from '@/lib/validation/occupancy'

export interface OverrideWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unitLabel: string
  currentStatus: ExpectedReservationStatus
  targetState: UnitState
  isSubmitting?: boolean
  onConfirm: () => void
}

/**
 * Confirmation dialog for overriding active Seeker holds or ending occupied visits
 * (STORY-12 design §3, Moves R5, R9, R11, D-050).
 *
 * Displays status-specific titles ("Override active hold?" vs "End this visit?"),
 * consequences, and an action button explicitly naming {targetState}.
 */
export function OverrideWarningDialog({
  open,
  onOpenChange,
  unitLabel,
  currentStatus,
  targetState,
  isSubmitting = false,
  onConfirm,
}: OverrideWarningDialogProps) {
  const copy = getOverrideCopy(currentStatus, targetState)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block font-medium text-foreground">Unit: {unitLabel}</span>
            <span>{copy.description}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
