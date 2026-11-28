import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { dashboardFor } from '@/lib/auth/role-guard'
import { getPaymentRecords } from '@/lib/data/admin'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { paymentRecordsSchema, type PaymentRecordFilter } from '@/lib/validation/admin'
import { PaymentsList } from './_components/payments-list'

export const metadata: Metadata = {
  title: 'Payment Records',
}

const FILTER_TABS: ReadonlyArray<{ value: PaymentRecordFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'forfeited', label: 'Forfeited' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'refundable', label: 'Refundable' },
]

interface AdminPaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Administration Payment Records page (`/admin/payments`, STORY-14 design §3
 * Screen 3, TSK-14.4, FR-5.3, D-088).
 *
 * Enforces the Administrator role check (matching `/admin`), parses `?status=`
 * and `?show=` via `paymentRecordsSchema`, and loads sandbox payment records.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?returnUrl=%2Fadmin%2Fpayments')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    redirect(profile ? dashboardFor(profile.role) : '/login')
  }

  const rawParams = await searchParams
  const { status, show } = paymentRecordsSchema.parse(rawParams)

  const records = await getPaymentRecords(supabase, { filter: status, shown: show })

  if (!records) {
    return (
      <div className="space-y-6">
        <div className="space-y-1 border-b border-border/75 pb-5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Payment Records
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Inspect paid, forfeited, and refunded sandbox fees, and refund a fee whose
            hold ended without a check-in.
          </p>
        </div>

        <nav aria-label="Payment filters" className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/payments?status=${tab.value}`}
              aria-current={status === tab.value ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: status === tab.value ? 'default' : 'outline' }),
                'h-auto min-h-12 min-w-12 rounded-full px-5 py-2 whitespace-normal',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <Alert variant="destructive" role="alert" data-testid="payments-load-error">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <AlertTitle>Error loading payment records</AlertTitle>
          <AlertDescription>
            We couldn&apos;t load payment records. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <PaymentsList
      items={records.items}
      filter={status}
      shown={show}
      hasMore={records.hasMore}
    />
  )
}
