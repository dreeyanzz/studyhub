/**
 * Pre-existing accessibility violations on `main` recorded by STORY-19 (TSK-19.3,
 * D-093). Every entry points to an open `fix(STORY-xx)` bug issue; when that fix
 * merges, its PR removes the entry here so the sweep only tightens over time.
 */

export type AccessibilityCheckKind =
  'axe' | 'target-size' | 'overflow' | 'clipping' | 'focus'

export interface KnownViolation {
  routeId: string
  check: AccessibilityCheckKind
  rule: string
  issueNumber: number
  summary: string
}

export const KNOWN_VIOLATIONS: readonly KnownViolation[] = [
  {
    routeId: 'host-space-seat-map',
    check: 'target-size',
    rule: 'min-target-size-48px',
    issueNumber: 374,
    summary: 'Your Spaces breadcrumb link (79x18) is under 48x48 px at 360px',
  },
  {
    routeId: 'host-space-tags',
    check: 'target-size',
    rule: 'min-target-size-48px',
    issueNumber: 375,
    summary: 'Your Spaces breadcrumb link (79x18) is under 48x48 px at 360px',
  },
  {
    routeId: 'host-space-photos',
    check: 'target-size',
    rule: 'min-target-size-48px',
    issueNumber: 376,
    summary: 'Your Spaces breadcrumb link (79x18) is under 48x48 px at 360px',
  },
  {
    routeId: 'host-space-check-in',
    check: 'target-size',
    rule: 'min-target-size-48px',
    issueNumber: 377,
    summary: 'Your Spaces breadcrumb link (79x18) is under 48x48 px at 360px',
  },
  {
    routeId: 'admin-verification',
    check: 'clipping',
    rule: 'text-clipping-200',
    issueNumber: 378,
    summary:
      'Badge fixed h-5 + overflow-hidden clips vertically (21 > 18) at 200% text size',
  },
]
