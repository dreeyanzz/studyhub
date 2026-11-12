'use client'

import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ActiveFilterState,
  CURATED_TAG_GROUPS,
  HOURS_FILTER_OPTIONS,
  PRICE_TIER_FILTER_OPTIONS,
  UNIT_TYPE_FILTER_OPTIONS,
  countActiveFilters,
} from './filter-panel'
import { cn } from '@/lib/utils'
import type { HoursFilter, PriceTier, UnitTypeFilter } from '@/lib/validation/search'

export interface FilterDrawerProps {
  filters: ActiveFilterState
  resultCount: number
  onToggleTag: (tagId: string) => void
  onTogglePrice: (tier: PriceTier) => void
  onToggleHours: (hours: HoursFilter) => void
  onToggleUnitType: (unitType: UnitTypeFilter) => void
  onClearAll: () => void
  defaultOpen?: boolean
  className?: string
}

/**
 * FilterDrawer provides the mobile responsive bottom-sheet filter drawer (<1024px)
 * with 48x48px minimum touch targets across all 7 curated criteria (STORY-08, FR-1.2, D-031).
 */
export function FilterDrawer({
  filters,
  resultCount,
  onToggleTag,
  onTogglePrice,
  onToggleHours,
  onToggleUnitType,
  onClearAll,
  defaultOpen = false,
  className,
}: FilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const activeCount = countActiveFilters(filters)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Every way of closing the drawer hands focus back to the Filters button, so a
  // keyboard user isn't dropped at the top of the page (TSK-08.6, WCAG 2.4.3).
  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  // While open, the drawer is modal (aria-modal): focus starts on its Close button, and
  // Tab and Shift+Tab cycle through its own controls instead of the page behind it.
  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('[data-testid="filter-drawer-close"]')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const controls = dialog.querySelectorAll<HTMLElement>('button:not([disabled])')
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) return

      const focusInside = dialog.contains(document.activeElement)
      if (event.shiftKey && (!focusInside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!focusInside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeDrawer])

  return (
    <div data-testid="filter-drawer-wrapper" className={cn('lg:hidden', className)}>
      {/* Screen reader polite announcement for active filter count in mobile drawer (§3 Accessibility) */}
      <div aria-live="polite" className="sr-only">
        {activeCount} active {activeCount === 1 ? 'filter' : 'filters'} applied
      </div>

      {/* Mobile Filter Trigger Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-controls="mobile-filter-drawer"
          data-testid="filter-drawer-trigger"
          className={cn(
            'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
            activeCount > 0
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-foreground hover:bg-accent/40',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span
              data-testid="mobile-active-filter-count"
              className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            data-testid="mobile-clear-all-filters"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Clear all ({activeCount})</span>
          </button>
        )}
      </div>

      {/* Bottom Sheet Modal Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close filter drawer overlay"
            data-testid="filter-drawer-backdrop"
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div
            ref={dialogRef}
            id="mobile-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-drawer-title"
            data-testid="filter-drawer-dialog"
            className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2
                  id="filter-drawer-title"
                  className="font-heading text-base font-bold text-foreground"
                >
                  Filter Study Spaces
                </h2>
                <p className="text-xs text-muted-foreground">
                  Spaces must match all selected filters (AND)
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close filter drawer"
                data-testid="filter-drawer-close"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Filter Sections (All 7 Curated Criteria, D-031 48x48px targets) */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {CURATED_TAG_GROUPS.map((group) => (
                <div
                  key={group.category}
                  role="group"
                  aria-label={group.title}
                  className="space-y-2"
                >
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt) => {
                      const isSelected = filters.tags.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={isSelected}
                          data-testid={`drawer-filter-tag-${opt.id}`}
                          onClick={() => onToggleTag(opt.id)}
                          className={cn(
                            'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                              : 'border-border bg-card text-foreground hover:border-primary/50',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Operating Hours */}
              <div role="group" aria-label="Operating Hours" className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Operating Hours
                </h3>
                <div className="flex flex-wrap gap-2">
                  {HOURS_FILTER_OPTIONS.map((opt) => {
                    const isSelected = filters.hours.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={isSelected}
                        data-testid={`drawer-filter-hours-${opt.id}`}
                        onClick={() => onToggleHours(opt.id)}
                        className={cn(
                          'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-card text-foreground hover:border-primary/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Price Tier */}
              <div role="group" aria-label="Price Tier" className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Price Tier
                </h3>
                <div className="flex flex-wrap gap-2">
                  {PRICE_TIER_FILTER_OPTIONS.map((opt) => {
                    const isSelected = filters.price.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={isSelected}
                        data-testid={`drawer-filter-price-${opt.id}`}
                        onClick={() => onTogglePrice(opt.id)}
                        className={cn(
                          'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-card text-foreground hover:border-primary/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Unit Type */}
              <div role="group" aria-label="Unit Type" className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Unit / Room Type
                </h3>
                <div className="flex flex-wrap gap-2">
                  {UNIT_TYPE_FILTER_OPTIONS.map((opt) => {
                    const isSelected = filters.unitType.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={isSelected}
                        data-testid={`drawer-filter-unit-${opt.id}`}
                        onClick={() => onToggleUnitType(opt.id)}
                        className={cn(
                          'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-card text-foreground hover:border-primary/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4">
              <button
                type="button"
                onClick={onClearAll}
                data-testid="drawer-clear-all"
                className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span>Reset all</span>
              </button>

              <button
                type="button"
                onClick={closeDrawer}
                data-testid="drawer-apply-button"
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Show {resultCount} {resultCount === 1 ? 'space' : 'spaces'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
