'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Armchair,
  Check,
  ChevronDown,
  Clock,
  Plug,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  Volume2,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react'
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

const CATEGORY_ICONS = {
  wifi: Wifi,
  power: Plug,
  noise: Volume2,
  ac: Wind,
} as const

interface DropdownOption {
  id: string
  label: string
  testId: string
  selected: boolean
  onToggle: () => void
}

function FilterDropdown({
  id,
  title,
  icon: Icon,
  options,
  isOpen,
  alignRight,
  triggerRef,
  onToggleOpen,
}: {
  id: string
  title: string
  icon: LucideIcon
  options: DropdownOption[]
  isOpen: boolean
  alignRight: boolean
  triggerRef: (el: HTMLButtonElement | null) => void
  onToggleOpen: () => void
}) {
  const selectedCount = options.filter((opt) => opt.selected).length
  const menuId = `filter-menu-${id}`

  return (
    <div role="group" aria-label={title} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={onToggleOpen}
        className={cn(
          'inline-flex min-h-12 min-w-12 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold whitespace-normal transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
          selectedCount > 0
            ? 'border-primary bg-accent text-accent-foreground shadow-2xs'
            : isOpen
              ? 'border-primary/50 bg-surface-subtle text-foreground'
              : 'border-border/80 bg-card text-foreground hover:border-primary/40 hover:bg-surface-subtle',
        )}
      >
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>{title}</span>
        {selectedCount > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {selectedCount}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      <div
        id={menuId}
        className={cn(
          'absolute top-full z-30 mt-2 max-w-[calc(100vw-2rem)] min-w-60 rounded-2xl border border-white/90 bg-white/96 p-1.5 shadow-float backdrop-blur-xl',
          alignRight ? 'right-0' : 'left-0',
          !isOpen && 'hidden',
        )}
      >
        <div className="flex flex-col gap-1">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={opt.selected}
              data-testid={opt.testId}
              onClick={opt.onToggle}
              className={cn(
                'flex min-h-12 w-full min-w-12 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                opt.selected
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'text-foreground hover:bg-surface-subtle',
              )}
            >
              <span>{opt.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                  opt.selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background',
                )}
              >
                {opt.selected && <Check className="size-3" />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * FilterPanel renders the desktop multi-criteria curated filter dropdowns
 * across all 7 criteria (Wi-Fi, Outlets, Noise, AC, Hours, Price Tier, Unit Type)
 * combined with strict AND logic (STORY-08, FR-1.2, D-006, D-031, D-048, STORY-17).
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
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [alignRightKey, setAlignRightKey] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!openKey) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenKey(null)
        setAlignRightKey(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const closedKey = openKey
        setOpenKey(null)
        setAlignRightKey(null)
        if (containerRef.current?.contains(document.activeElement)) {
          triggerRefs.current[closedKey]?.focus()
        }
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openKey])

  const toggleMenu = (key: string) => {
    if (openKey === key) {
      setOpenKey(null)
      setAlignRightKey(null)
      return
    }
    const trigger = triggerRefs.current[key]
    let shouldAlignRight = false
    if (trigger && typeof window !== 'undefined') {
      const rect = trigger.getBoundingClientRect()
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const menuMinWidth = 15 * rootPx
      shouldAlignRight = rect.left + menuMinWidth > window.innerWidth - 16
    }
    setAlignRightKey(shouldAlignRight ? key : null)
    setOpenKey(key)
  }

  return (
    <section
      ref={containerRef}
      aria-label="Curated space filters"
      data-testid="filter-panel"
      className={cn(
        'relative z-30 flex flex-wrap items-center justify-between gap-2 border-y border-border/80 bg-background py-3',
        className,
      )}
    >
      {/* Screen reader polite announcement for active filter count (§3 Accessibility) */}
      <div aria-live="polite" className="sr-only">
        {activeCount} active {activeCount === 1 ? 'filter' : 'filters'} applied
      </div>

      {/* 7 Cohesive Filter Dropdowns in a single compact architectural toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" />
          <span className="sr-only">Filter Spaces</span>
        </span>
        {CURATED_TAG_GROUPS.map((group) => (
          <FilterDropdown
            key={group.category}
            id={group.category}
            title={group.title}
            icon={CATEGORY_ICONS[group.category]}
            isOpen={openKey === group.category}
            alignRight={alignRightKey === group.category}
            triggerRef={(el) => {
              triggerRefs.current[group.category] = el
            }}
            onToggleOpen={() => toggleMenu(group.category)}
            options={group.options.map((opt) => ({
              id: opt.id,
              label: opt.shortLabel,
              testId: `filter-tag-${opt.id}`,
              selected: filters.tags.includes(opt.id),
              onToggle: () => onToggleTag(opt.id),
            }))}
          />
        ))}

        <FilterDropdown
          id="hours"
          title="Operating Hours"
          icon={Clock}
          isOpen={openKey === 'hours'}
          alignRight={alignRightKey === 'hours'}
          triggerRef={(el) => {
            triggerRefs.current.hours = el
          }}
          onToggleOpen={() => toggleMenu('hours')}
          options={HOURS_FILTER_OPTIONS.map((opt) => ({
            id: opt.id,
            label: opt.label,
            testId: `filter-hours-${opt.id}`,
            selected: filters.hours.includes(opt.id),
            onToggle: () => onToggleHours(opt.id),
          }))}
        />

        <FilterDropdown
          id="price"
          title="Price Tier"
          icon={Tag}
          isOpen={openKey === 'price'}
          alignRight={alignRightKey === 'price'}
          triggerRef={(el) => {
            triggerRefs.current.price = el
          }}
          onToggleOpen={() => toggleMenu('price')}
          options={PRICE_TIER_FILTER_OPTIONS.map((opt) => ({
            id: opt.id,
            label: opt.label,
            testId: `filter-price-${opt.id}`,
            selected: filters.price.includes(opt.id),
            onToggle: () => onTogglePrice(opt.id),
          }))}
        />

        <FilterDropdown
          id="unitType"
          title="Unit / Room Type"
          icon={Armchair}
          isOpen={openKey === 'unitType'}
          alignRight={alignRightKey === 'unitType'}
          triggerRef={(el) => {
            triggerRefs.current.unitType = el
          }}
          onToggleOpen={() => toggleMenu('unitType')}
          options={UNIT_TYPE_FILTER_OPTIONS.map((opt) => ({
            id: opt.id,
            label: opt.label,
            testId: `filter-unit-${opt.id}`,
            selected: filters.unitType.includes(opt.id),
            onToggle: () => onToggleUnitType(opt.id),
          }))}
        />
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span
            data-testid="active-filter-count"
            className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
          >
            {activeCount} active
          </span>
          <button
            type="button"
            onClick={onClearAll}
            data-testid="clear-all-filters"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Clear all</span>
          </button>
        </div>
      )}
    </section>
  )
}
