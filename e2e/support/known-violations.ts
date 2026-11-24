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

export const KNOWN_VIOLATIONS: readonly KnownViolation[] = []
