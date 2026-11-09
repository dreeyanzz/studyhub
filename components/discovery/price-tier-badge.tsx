import { cn } from '@/lib/utils'
import type { PriceTier } from '@/lib/validation/search'

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  free: 'Free',
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
}

export const PRICE_TIER_SYMBOLS: Record<PriceTier, string> = {
  free: 'Free',
  budget: '₱',
  standard: '₱₱',
  premium: '₱₱₱',
}

interface PriceTierBadgeProps {
  tier: PriceTier
  className?: string
  /** If true, appends currency symbol indicator (e.g. "Budget (₱)") */
  showSymbol?: boolean
}

/**
 * PriceTierBadge displays the curated price tier of a Space (STORY-08, D-027).
 * Color contrasts meet WCAG 2.1 AA (4.5:1) in both light and dark modes.
 */
export function PriceTierBadge({
  tier,
  className,
  showSymbol = false,
}: PriceTierBadgeProps) {
  const label = PRICE_TIER_LABELS[tier] ?? tier
  const symbol = PRICE_TIER_SYMBOLS[tier]
  const displayText = showSymbol && tier !== 'free' ? `${label} (${symbol})` : label

  const colorStyles: Record<PriceTier, string> = {
    free: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    budget:
      'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    standard:
      'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    premium:
      'border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300',
  }

  return (
    <span
      data-testid={`price-tier-badge-${tier}`}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors',
        colorStyles[tier],
        className,
      )}
    >
      {displayText}
    </span>
  )
}
