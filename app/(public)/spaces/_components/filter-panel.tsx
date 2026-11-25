'use client'

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HoursFilter, PriceTier, UnitTypeFilter } from '@/lib/validation/search'

export interface CuratedTagOption {
  id: string
  category: 'wifi' | 'power' | 'noise' | 'ac'
  label: string
  shortLabel: string
}

export interface CuratedTagCategoryGroup {
  category: 'wifi' | 'power' | 'noise' | 'ac'
  title: string
  options: readonly CuratedTagOption[]
}

/**
 * Platform-curated amenity tag catalog across the four static amenity categories
 * (STORY-08 §2, FR-1.2, D-006). Custom tags are never offered as filters (FR-1.3).
 */
export const CURATED_TAG_GROUPS: readonly CuratedTagCategoryGroup[] = [
  {
    category: 'wifi',
    title: 'Wi-Fi Speed',
    options: [
      {
        id: 'wifi_basic',
        category: 'wifi',
        label: 'Wi-Fi: Standard (10+ Mbps)',
        shortLabel: 'Standard (10+ Mbps)',
      },
      {
        id: 'wifi_fast',
        category: 'wifi',
        label: 'Wi-Fi: Fast (50+ Mbps)',
        shortLabel: 'Fast (50+ Mbps)',
      },
      {
        id: 'wifi_ultrafast',
        category: 'wifi',
        label: 'Wi-Fi: Ultra-Fast (100+ Mbps)',
        shortLabel: 'Ultra-Fast (100+ Mbps)',
      },
    ],
  },
  {
    category: 'power',
    title: 'Power Outlets',
    options: [
      {
        id: 'outlets_all',
        category: 'power',
        label: 'Outlets: Every Seat',
        shortLabel: 'Every Seat',
      },
      {
        id: 'outlets_some',
        category: 'power',
        label: 'Outlets: Shared / Common',
        shortLabel: 'Shared / Common',
      },
    ],
  },
  {
    category: 'noise',
    title: 'Noise Level',
    options: [
      {
        id: 'noise_silent',
        category: 'noise',
        label: 'Noise: Silent Study',
        shortLabel: 'Silent Study',
      },
      {
        id: 'noise_quiet',
        category: 'noise',
        label: 'Noise: Quiet Focus',
        shortLabel: 'Quiet Focus',
      },
      {
        id: 'noise_moderate',
        category: 'noise',
        label: 'Noise: Collaborative',
        shortLabel: 'Collaborative',
      },
    ],
  },
  {
    category: 'ac',
    title: 'Air Conditioning',
    options: [
      {
        id: 'ac_full',
        category: 'ac',
        label: 'Air Conditioning',
        shortLabel: 'Air Conditioning',
      },
      {
        id: 'ac_natural',
        category: 'ac',
        label: 'Natural Ventilation',
        shortLabel: 'Natural Ventilation',
      },
    ],
  },
] as const

export const HOURS_FILTER_OPTIONS: ReadonlyArray<{
  id: HoursFilter
  label: string
}> = [
  { id: 'open_now', label: 'Open Now' },
  { id: 'open_late', label: 'Open Late (Past 10 PM)' },
  { id: 'open_24h', label: 'Open 24 Hours' },
]

export const PRICE_TIER_FILTER_OPTIONS: ReadonlyArray<{
  id: PriceTier
  label: string
}> = [
  { id: 'free', label: 'Free' },
  { id: 'budget', label: 'Budget (₱)' },
  { id: 'standard', label: 'Standard (₱₱)' },
  { id: 'premium', label: 'Premium (₱₱₱)' },
]

export const UNIT_TYPE_FILTER_OPTIONS: ReadonlyArray<{
  id: UnitTypeFilter
  label: string
}> = [
  { id: 'seat', label: 'Individual Seat' },
  { id: 'standing_desk', label: 'Standing Desk' },
  { id: 'room', label: 'Whole Room' },
]

export interface ActiveFilterState {
  tags: string[]
  price: PriceTier[]
  hours: HoursFilter[]
  unitType: UnitTypeFilter[]
}

/**
 * Returns the total number of active multi-criteria filters selected across all 7 categories.
 */
export function countActiveFilters(filters: ActiveFilterState): number {
  return (
    filters.tags.length +
    filters.price.length +
    filters.hours.length +
    filters.unitType.length
  )
}

/**
 * Toggles a value inside a filter array (adds if absent, removes if present).
 */
export function toggleFilterValue<T extends string>(
  current: readonly T[],
  value: T,
): T[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

export interface FilterPanelProps {
  filters: ActiveFilterState
  onToggleTag: (tagId: string) => void
  onTogglePrice: (tier: PriceTier) => void
  onToggleHours: (hours: HoursFilter) => void
  onToggleUnitType: (unitType: UnitTypeFilter) => void
  onClearAll: () => void
  className?: string
}

/**
 * FilterPanel renders the desktop multi-criteria curated filter controls
 * across all 7 criteria (Wi-Fi, Outlets, Noise, AC, Hours, Price Tier, Unit Type)
 * combined with strict AND logic (STORY-08, FR-1.2, D-006, D-031, D-048).
 */
export function FilterPanel({
  filters,
  onToggleTag,
  onTogglePrice,
  onToggleHours,
  onToggleUnitType,
  onClearAll,
  className,
}: FilterPanelProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <section
      aria-label="Curated space filters"
      data-testid="filter-panel"
      className={cn(
        'rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      {/* Screen reader polite announcement for active filter count (§3 Accessibility) */}
      <div aria-live="polite" className="sr-only">
        {activeCount} active {activeCount === 1 ? 'filter' : 'filters'} applied
      </div>

      {/* Filter Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-heading text-sm font-bold text-foreground">
            Curated Amenity & Venue Filters
          </h2>
          {activeCount > 0 && (
            <span
              data-testid="active-filter-count"
              className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
            >
              {activeCount} active
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Matches spaces satisfying all selected criteria (AND)
          </span>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            data-testid="clear-all-filters"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      {/* 7 Curated Filter Criteria Groups */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1-4: Wi-Fi, Power Outlets, Noise Level, Air Conditioning */}
        {CURATED_TAG_GROUPS.map((group) => (
          <div
            key={group.category}
            role="group"
            aria-label={group.title}
            className="flex flex-col gap-1.5"
          >
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((opt) => {
                const isSelected = filters.tags.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={isSelected}
                    data-testid={`filter-tag-${opt.id}`}
                    onClick={() => onToggleTag(opt.id)}
                    className={cn(
                      'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/40',
                    )}
                  >
                    {opt.shortLabel}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* 5: Operating Hours (Asia/Manila UTC+8, D-048) */}
        <div role="group" aria-label="Operating Hours" className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Operating Hours
          </span>
          <div className="flex flex-wrap gap-1.5">
            {HOURS_FILTER_OPTIONS.map((opt) => {
              const isSelected = filters.hours.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`filter-hours-${opt.id}`}
                  onClick={() => onToggleHours(opt.id)}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/40',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 6: Price Tier (spaces.price_tier, D-027) */}
        <div role="group" aria-label="Price Tier" className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Price Tier
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_TIER_FILTER_OPTIONS.map((opt) => {
              const isSelected = filters.price.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`filter-price-${opt.id}`}
                  onClick={() => onTogglePrice(opt.id)}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/40',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 7: Unit / Room Type (units.unit_type, STORY-07) */}
        <div
          role="group"
          aria-label="Unit Type"
          className="flex flex-col gap-1.5 md:col-span-2"
        >
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Unit / Room Type
          </span>
          <div className="flex flex-wrap gap-1.5">
            {UNIT_TYPE_FILTER_OPTIONS.map((opt) => {
              const isSelected = filters.unitType.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`filter-unit-${opt.id}`}
                  onClick={() => onToggleUnitType(opt.id)}
                  className={cn(
                    'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/40',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
