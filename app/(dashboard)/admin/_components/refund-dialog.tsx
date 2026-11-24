'use client'

import { useState } from 'react'
import { AlertCircle, Building, RotateCcw, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface DisputeTransactionItem {
  id: string
  reservationId: string
  spaceName: string
  seekerName: string
  seekerEmail: string
  amount: number
  paidAt: string
  disputeReason: string
  status: 'disputed' | 'refunded' | 'completed' | 'forfeited'
}

interface RefundDialogProps {
  transaction: DisputeTransactionItem | null
  isOpen: boolean
  onClose: () => void
  onConfirmRefund: (transactionId: string, reasonCategory: string) => Promise<void>
}

const REFUND_CATEGORIES = [
  'Host Overbooking / Double-booked seat',
  'Facility Outage (Electricity / Wi-Fi / AC)',
  'Venue Unexpected Closure during reserved window',
  'Host Unresponsive at Check-in Desk',
]

/**
 * Dispute Resolution & 1-Click Sandbox Refund Modal (STORY-14, FR-5.3).
 * Allows Administrators to review disputed hold fees and issue an immediate sandbox refund.
 */
export function RefundDialog({
  transaction,
  isOpen,
  onClose,
  onConfirmRefund,
}: RefundDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    REFUND_CATEGORIES[0] ?? 'Host Overbooking / Double-booked seat',
  )
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen || !transaction) return null

  async function handleConfirm() {
    if (!transaction) return
    setIsProcessing(true)
    try {
      await onConfirmRefund(transaction.id, selectedCategory)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="animate-fade-in-up relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/70 bg-muted/20 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <RotateCcw className="size-5.5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="refund-dialog-title"
                  className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl"
                >
                  Issue Sandbox Refund
                </h2>
                <Badge
                  variant="outline"
                  className="border-sky-300 bg-sky-50 text-[11px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                >
                  Hold Dispute
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Transaction Reference:{' '}
                <strong className="font-semibold text-foreground">
                  {transaction.reservationId}
                </strong>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
          {/* Dispute Context */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Building className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">
                  {transaction.spaceName}
                </span>
              </div>
              <span className="font-heading text-base font-bold text-foreground">
                ₱{transaction.amount.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                  Seeker
                </span>
                <span className="font-semibold text-foreground">
                  {transaction.seekerName}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                  Paid At
                </span>
                <span className="font-semibold text-foreground">
                  {transaction.paidAt}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-destructive">
                <AlertCircle className="size-3.5" />
                <span>Customer Dispute Claim</span>
              </div>
              <p className="mt-1 text-foreground/90 italic">
                &ldquo;{transaction.disputeReason}&rdquo;
              </p>
            </div>
          </div>

          {/* Refund Cause Picker */}
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Select Official Refund Cause
            </p>
            <div className="space-y-2">
              {REFUND_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-background p-3 text-xs font-medium text-foreground transition hover:bg-muted/30 has-checked:border-sky-500 has-checked:bg-sky-50/50 dark:has-checked:bg-sky-950/30"
                >
                  <input
                    type="radio"
                    name="refund-category"
                    value={cat}
                    checked={selectedCategory === cat}
                    onChange={() => setSelectedCategory(cat)}
                    className="size-4 accent-sky-600"
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="min-h-[44px] gap-2 rounded-xl bg-sky-700 px-5 text-xs font-semibold text-white shadow-xs hover:bg-sky-800"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <RotateCcw className="size-4" />
            <span>
              {isProcessing
                ? 'Processing Refund...'
                : `Confirm ₱${transaction.amount.toFixed(2)} Sandbox Refund`}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
