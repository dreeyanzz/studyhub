import type { Database } from '@/lib/supabase/database.types'
import {
  parseRegistrationRole,
  sanitizeReturnUrl,
  type RegistrationRole,
} from '@/lib/validation/auth'

export type UserRole = Database['public']['Enums']['user_role']

export type RouteAccess = { type: 'allow' } | { type: 'redirect'; to: string }

const dashboards: Record<UserRole, string> = {
  seeker: '/seeker',
  host: '/host',
  admin: '/admin',
}

export function dashboardFor(role: UserRole): string {
  return dashboards[role]
}

/**
 * Builds the `/choose-role` path for an unconfirmed OAuth user, preserving a
 * sanitized `returnUrl` and an optional `seeker` or `host` preselection hint
 * (STORY-21, D-058, D-095).
 */
export function chooseRolePath(returnUrl?: string, role?: RegistrationRole): string {
  const params = new URLSearchParams()
  const safeReturn = sanitizeReturnUrl(returnUrl, '')
  if (safeReturn) params.set('returnUrl', safeReturn)
  if (role) params.set('role', role)
  const query = params.toString()
  return query ? `/choose-role?${query}` : '/choose-role'
}

type Area = 'public' | 'auth' | 'choose-role' | UserRole

// Only the first path segment decides the area, so /seekers or /hostel stay public.
function areaOf(pathname: string): Area {
  const firstSegment = pathname.split('/')[1] ?? ''
  if (firstSegment === 'login' || firstSegment === 'register') return 'auth'
  if (firstSegment === 'choose-role') return 'choose-role'
  if (firstSegment === 'seeker' || firstSegment === 'host' || firstSegment === 'admin') {
    return firstSegment
  }
  return 'public'
}

/**
 * Decides whether a visitor may open a path, following the route access matrix in
 * STORY-03 design §2 and Google OAuth flow §5 (D-095). `role` is null for an
 * anonymous visitor, and both `role` and `roleConfirmed` must come from the user's
 * own profiles row, never from user_metadata. This only routes people; Row-Level
 * Security is the security boundary (D-007, D-010).
 */
export function evaluateRouteAccess(
  pathname: string,
  role: UserRole | null,
  search = '',
  method = 'GET',
  roleConfirmed = true,
): RouteAccess {
  // Only page loads are routed. Any other request that reaches a page is a Server
  // Action, a POST to that page's own URL. Redirecting it would make the browser post
  // it again to the new address, which breaks the page (#137). Every action checks
  // the session itself and sends the person to /login, and RLS guards the data.
  if (method !== 'GET' && method !== 'HEAD') return { type: 'allow' }

  const area = areaOf(pathname)
  if (area === 'public') return { type: 'allow' }

  if (area === 'choose-role') {
    if (!role) return { type: 'redirect', to: '/login' }
    return roleConfirmed
      ? { type: 'redirect', to: dashboardFor(role) }
      : { type: 'allow' }
  }

  if (area === 'auth') {
    if (!role) return { type: 'allow' }
    if (!roleConfirmed) {
      const params = new URLSearchParams(search)
      const returnUrl = sanitizeReturnUrl(params.get('returnUrl'), '')
      const roleHint = parseRegistrationRole(params.get('role'))
      return {
        type: 'redirect',
        to: chooseRolePath(returnUrl || undefined, roleHint),
      }
    }
    return { type: 'redirect', to: dashboardFor(role) }
  }

  if (!role) {
    const returnUrl = encodeURIComponent(pathname + search)
    return { type: 'redirect', to: `/login?returnUrl=${returnUrl}` }
  }

  if (!roleConfirmed) {
    return { type: 'redirect', to: chooseRolePath(pathname + search) }
  }

  // An Administrator may open every portal (D-032); everyone else only their own.
  if (role === 'admin' || role === area) return { type: 'allow' }
  return { type: 'redirect', to: dashboardFor(role) }
}

/**
 * Where to send someone who has just logged in: back to the page that sent them to
 * /login if their role may open it, or else to their dashboard (STORY-03 design §1).
 * `returnUrl` must already be a same-site path from sanitizeReturnUrl().
 */
export function landingPathFor(role: UserRole, returnUrl?: string): string {
  if (returnUrl) {
    const { pathname } = new URL(returnUrl, 'http://localhost')
    if (evaluateRouteAccess(pathname, role).type === 'allow') return returnUrl
  }
  return dashboardFor(role)
}
