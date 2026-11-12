import { Tag, Volume2, Wifi, Wind, Zap, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface CuratedTagData {
  id: string
  label: string
  category?: string
}

export interface SpaceTagsProps {
  curatedTags: CuratedTagData[]
  customTags: string[]
  className?: string
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  power: Zap,
  noise: Volume2,
  ac: Wind,
}

/**
 * Curated and Host Custom Tag Presentation Component (STORY-11 design §3 Screen 1, TSK-11.6, D-006).
 *
 * Implements strict visual distinction rules (D-006):
 * - Curated amenity tags: Solid primary styling (`text-primary bg-primary/10 border-primary/20`) with category icons.
 * - Host custom tags: Distinct outline badges (`text-muted-foreground bg-muted/40 border-muted-foreground/30`)
 *   under a separate "Host custom tags" label.
 * - Custom tags are strictly presentation-only (no link/filter interactivity).
 */
export function SpaceTags({ curatedTags, customTags, className }: SpaceTagsProps) {
  const hasCurated = curatedTags.length > 0
  const hasCustom = customTags.length > 0

  if (!hasCurated && !hasCustom) {
    return null
  }

  return (
    <section
      aria-label="Amenities and Tags"
      data-testid="space-tags"
      className={cn('space-y-3', className)}
    >
      {/* Curated Amenity Tags */}
      {hasCurated && (
        <div className="space-y-1.5" data-testid="curated-tags">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Curated Amenities
          </h3>
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Curated amenity tags"
          >
            {curatedTags.map((tag) => {
              const Icon = (tag.category && CATEGORY_ICONS[tag.category]) || Tag

              return (
                <div
                  key={tag.id}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-xs"
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{tag.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Host Custom Tags (D-006) */}
      {hasCustom && (
        <div className="space-y-1.5" data-testid="custom-tags">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Host custom tags
          </h3>
          <div
            className="flex flex-wrap gap-1.5"
            role="list"
            aria-label="Host custom tags"
          >
            {customTags.map((tag) => (
              <span
                key={tag}
                role="listitem"
                className="inline-flex items-center rounded-full border border-muted-foreground/30 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground select-none"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
