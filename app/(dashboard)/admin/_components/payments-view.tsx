'use client'

import { useState } from 'react'
import { CheckCircle2, CreditCard, RotateCcw, UserX, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefundDialog, type DisputeTransactionItem } from './refund-dialog'

/** Initial realistic transactions for financial audit & QA */
const INITIAL_TRANSACTIONS: DisputeTransactionItem[] = [
  {
    id: 'tx-01',
    reservationId: 'HOLD-8492',
    spaceName: 'The Study Nook - USC Main',
    seekerName: 'Sam Dela Cruz',
    seekerEmail: 'seeker@example.test',
    amount: 50.0,
    paidAt: 'Nov 23, 2026, 1:30 PM',
    disputeReason:
      'Host double-booked quiet desk unit D-04 and power outlets in the room were completely non-functional.',
    status: 'disputed',
  },
  {
    id: 'tx-02',
    reservationId: 'HOLD-8470',
    spaceName: 'Kapihan Study Hub',
    seekerName: 'Maria Santos',
    seekerEmail: 'maria@example.test',
    amount: 50.0,
    paidAt: 'Nov 23, 2026, 11:15 AM',
    disputeReason: '',
    status: 'completed',
  },
  {
    id: 'tx-03',
    reservationId: 'HOLD-8431',
    spaceName: 'Cebu Innovate Lab',
    seekerName: 'Juan Dela Cruz',
    seekerEmail: 'juan@example.test',
    amount: 50.0,
    paidAt: 'Nov 22, 2026, 4:00 PM',
    disputeReason: '',
    status: 'forfeited',
  },
]

/**
 * Payments & Sandbox Refunds portal view for Administrators (STORY-14, FR-5.3).
 * Financial transaction audit ledger for all reservation holds and sandbox refund dispute management.
 */
export function PaymentsView() {
  const [transactions, setTransactions] =
    useState<DisputeTransactionItem[]>(INITIAL_TRANSACTIONS)
  const [inspectingDispute, setInspectingDispute] =
    useState<DisputeTransactionItem | null>(null)
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
  } | null>(null)

  const refundedCount = transactions.filter((t) => t.status === 'refunded').length
  const forfeitedCount = transactions.filter((t) => t.status === 'forfeited').length
  const totalProcessedAmount = transactions.reduce((acc, t) => acc + t.amount, 0)

  async function handleConfirmRefund(transactionId: string, reasonCategory: string) {
    const target = transactions.find((t) => t.id === transactionId)
    if (!target) return

    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'refunded' } : t)),
    )

    setNotice({
      type: 'success',
      title: `Sandbox refund issued (₱${target.amount.toFixed(2)})`,
      message: `Reservation #${target.reservationId} for ${target.seekerName} refunded. Cause: ${reasonCategory}.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Payments & Sandbox Refunds
          </h1>
          <p className="mt-1 text-sm font-medium text-foreground/85">
            Financial transaction audit ledger for all reservation holds and sandbox
            refund dispute management.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-xl border border-border/80 bg-secondary/80 px-3.5 py-1.5 text-sm font-bold text-foreground shadow-2xs"
        >
          Sandbox Financial Ledger
        </Badge>
      </div>

      {/* Professional Guidance Banner */}
      <div
        className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-sky-300/60 bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent p-4 shadow-2xs dark:border-sky-700/60"
        style={{ animationDelay: '40ms' }}
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-700 font-bold text-white shadow-2xs">
          <CreditCard className="size-4" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed text-foreground">
          <strong className="font-bold text-foreground">Financial Audit Guide:</strong>{' '}
          Reservation fees run in sandbox test mode. When a host is unable to honour a
          confirmed seat, administrators can issue an immediate sandbox refund.
        </div>
      </div>

      {/* Overview Metrics Bar */}
      <div
        className="animate-fade-in-up grid grid-cols-1 gap-3 sm:grid-cols-3"
        style={{ animationDelay: '80ms' }}
      >
        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-sky-300/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-md dark:border-sky-700/80">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-700 font-bold text-white shadow-xs">
            <span className="text-lg font-bold">₱</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-sky-800 uppercase dark:text-sky-300">
              Processed Holds
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              ₱{totalProcessedAmount.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/80 hover:shadow-md">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-800 shadow-2xs ring-1 ring-amber-300/50 dark:bg-amber-950/70 dark:text-amber-300">
            <UserX className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Forfeited Holds
            </p>
            <p className="text-sm font-bold text-foreground">{forfeitedCount} no-shows</p>
          </div>
        </div>

        <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/80 hover:shadow-md">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-800 shadow-2xs ring-1 ring-emerald-300/50 dark:bg-emerald-950/70 dark:text-emerald-300">
            <RotateCcw className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-foreground/80 uppercase">
              Refunded Holds
            </p>
            <p className="text-sm font-bold text-foreground">{refundedCount} disputes</p>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice ? (
        <Alert
          role="status"
          aria-live="polite"
          className="animate-fade-in relative rounded-2xl border-border/80 pr-12 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <AlertTitle className="font-semibold">{notice.title}</AlertTitle>
            <AlertDescription className="text-sm">{notice.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </Alert>
      ) : null}

      {/* Transactions Ledger */}
      {transactions.length === 0 ? (
        <Card className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-xs">
            <CreditCard className="size-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground">No Recent Transactions</h2>
          <p className="mt-1.5 max-w-md text-sm font-medium text-foreground/85">
            Paid reservation holds and forfeit records will appear here as seekers book
            study spaces across Cebu.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <Card
              key={tx.id}
              className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-heading text-lg font-bold text-foreground">
                      {tx.spaceName}
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      #{tx.reservationId}
                    </span>
                    {tx.status === 'disputed' ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-[11px] font-semibold text-destructive"
                      >
                        Dispute Under Review
                      </Badge>
                    ) : tx.status === 'refunded' ? (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                      >
                        <CheckCircle2 className="size-3" />
                        <span>Sandbox Refunded</span>
                      </Badge>
                    ) : tx.status === 'forfeited' ? (
                      <Badge
                        variant="outline"
                        className="text-[11px] text-muted-foreground"
                      >
                        Forfeited (No-show)
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-sky-500/10 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
                      >
                        Completed Check-in
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Seeker: {tx.seekerName}</span>
                    <span>·</span>
                    <span>Date: {tx.paidAt}</span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">
                      Amount: ₱{tx.amount.toFixed(2)}
                    </span>
                  </div>

                  {tx.disputeReason ? (
                    <p className="mt-1 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive/90 italic">
                      Dispute note: &ldquo;{tx.disputeReason}&rdquo;
                    </p>
                  ) : null}
                </div>

                {tx.status === 'disputed' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInspectingDispute(tx)}
                    className="min-h-[44px] shrink-0 gap-2 rounded-xl border-sky-400 bg-sky-50/50 font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
                  >
                    <RotateCcw className="size-4" />
                    <span>Issue Sandbox Refund</span>
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dispute Resolution & 1-Click Sandbox Refund Modal */}
      <RefundDialog
        transaction={inspectingDispute}
        isOpen={!!inspectingDispute}
        onClose={() => setInspectingDispute(null)}
        onConfirmRefund={handleConfirmRefund}
      />
    </div>
  )
}
