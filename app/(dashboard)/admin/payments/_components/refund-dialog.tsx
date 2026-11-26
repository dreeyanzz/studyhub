'use client'

import { useActionState, useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AdminPaymentRecordItem } from '@/lib/data/admin'
import { formatPeso } from '@/lib/reservations/format'
import {
  REFUND_REASON_MAX_LENGTH,
  type RefundPaymentActionState,
} from '@/lib/validation/admin'
import { refundPaymentAction } from '../actions'

const INITIAL_REFUND_STATE: RefundPaymentActionState = {
  status: 'idle',
  message: null,
}

export interface RefundFormProps {
  payment: AdminPaymentRecordItem
  action?: (
    prevState: RefundPaymentActionState,
    formData: FormData,
  ) => Promise<RefundPaymentActionState>
  onSuccess: (message: string) => void
  onReloadRequested?: () => void
  onCancel: () => void
  idPrefix?: string
}

/**
 * Form inside `RefundDialog` (STORY-14 design §3 Screen 3, TSK-14.4, FR-5.3, D-088).
 * Exported so Vitest can verify the full-refund summary, 1–300 character counter,
 * and 48 × 48 px Confirm refund / Cancel controls directly.
 */
export function RefundForm({
  payment,
  action = refundPaymentAction,
  onSuccess,
  onReloadRequested,
  onCancel,
  idPrefix,
}: RefundFormProps) {
  const reactId = useId()
  const prefix = idPrefix ?? reactId

  const [reason, setReason] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  const [state, formAction, isPending] = useActionState(
    async (prevState: RefundPaymentActionState, formData: FormData) => {
      const trimmed = String(formData.get('reason') ?? '').trim()
      if (trimmed.length === 0) {
        setClientError('Enter a reason for this refund.')
        return {
          status: 'error' as const,
          message: null,
          fieldErrors: { reason: 'Enter a reason for this refund.' },
        }
      }
      if (trimmed.length > REFUND_REASON_MAX_LENGTH) {
        const msg = `Reason must be ${REFUND_REASON_MAX_LENGTH} characters or fewer.`
        setClientError(msg)
        return {
          status: 'error' as const,
          message: null,
          fieldErrors: { reason: msg },
        }
      }

      setClientError(null)
      const next = await action(prevState, formData)
      if (next.status === 'success') {
        onSuccess(next.message ?? 'Refund recorded.')
      } else if (next.reload) {
        onReloadRequested?.()
      }
      return next
    },
    INITIAL_REFUND_STATE,
  )

  const trimmedLength = reason.trim().length
  const remainingChars = Math.max(0, REFUND_REASON_MAX_LENGTH - trimmedLength)
  const reasonError = clientError ?? state.fieldErrors?.reason ?? null
  const reasonId = `${prefix}-reason`
  const reasonCountId = `${prefix}-reason-count`
  const reasonErrorId = `${prefix}-reason-error`

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="paymentId" value={payment.paymentId} />

      <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="font-semibold wrap-anywhere text-foreground">
          {payment.spaceName} · {payment.unitLabel}
        </p>
        <p className="wrap-anywhere text-muted-foreground">
          Seeker:{' '}
          <span className="font-medium text-foreground">{payment.seekerFullName}</span>
        </p>
        <p className="font-semibold text-foreground" data-testid="refund-full-amount">
          Full refund: {formatPeso(payment.feeAmount)}
        </p>
      </div>

      {state.status === 'error' && state.message && (
        <Alert variant="destructive" role="alert" data-testid="refund-form-error">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
          Reason
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={3}
          required
          maxLength={REFUND_REASON_MAX_LENGTH}
          value={reason}
          disabled={isPending}
          onChange={(event) => {
            setReason(event.target.value)
            if (clientError) setClientError(null)
          }}
          aria-describedby={
            reasonError ? `${reasonCountId} ${reasonErrorId}` : reasonCountId
          }
          aria-invalid={reasonError ? 'true' : undefined}
          placeholder="Explain why this sandbox fee is being refunded."
          className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={reasonCountId} className="text-xs text-muted-foreground">
            {remainingChars} / {REFUND_REASON_MAX_LENGTH} characters remaining
          </p>
          {reasonError && (
            <p
              id={reasonErrorId}
              role="alert"
              data-testid="refund-reason-error"
              className="text-sm text-destructive"
            >
              {reasonError}
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          data-testid="refund-confirm-submit"
          className="h-auto min-h-12 max-w-full min-w-12 shrink py-2 whitespace-normal"
        >
          {isPending ? 'Refunding...' : 'Confirm refund'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface RefundDialogProps {
  payment: AdminPaymentRecordItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
  onReloadRequested?: () => void
}

/**
 * Focus-trapped refund confirmation modal on `components/ui/dialog.tsx`
 * (STORY-14 design §3 Screen 3, TSK-14.4, FR-5.3, D-088).
 */
export function RefundDialog({
  payment,
  open,
  onOpenChange,
  onSuccess,
  onReloadRequested,
}: RefundDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund reservation fee</DialogTitle>
          <DialogDescription>
            Issue a full sandbox refund through Stripe and record the reason for
            Administrators.
          </DialogDescription>
        </DialogHeader>

        {open && payment && (
          <RefundForm
            key={payment.paymentId}
            payment={payment}
            onCancel={() => onOpenChange(false)}
            onSuccess={(message) => {
              onOpenChange(false)
              onSuccess(message)
            }}
            onReloadRequested={onReloadRequested}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
