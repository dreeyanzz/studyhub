import type { Database } from '@/lib/supabase/database.types'

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

type Area = 'public' | 'auth' | UserRole

// Only the first path segment decides the area, so /seekers or /hostel stay public.
function areaOf(pathname: string): Area {
  const firstSegment = pathname.split('/')[1] ?? ''
  if (firstSegment === 'login' || firstSegment === 'register') return 'auth'
  if (firstSegment === 'seeker' || firstSegment === 'host' || firstSegment === 'admin') {
    return firstSegment
  }
  return 'public'
}

/**
 * Decides whether a visitor may open a path, following the route access matrix in
 * STORY-03 design §2. `role` is null for an anonymous visitor, and must come from
 * the user's own profiles row, never from user_metadata. This only routes people;
 * Row-Level Security is the security boundary (D-007, D-010).
 */
export function evaluateRouteAccess(
  pathname: string,
  role: UserRole | null,
  search = '',
): RouteAccess {
  const area = areaOf(pathname)
  if (area === 'public') return { type: 'allow' }

  if (area === 'auth') {
    return role ? { type: 'redirect', to: dashboardFor(role) } : { type: 'allow' }
  }

  if (!role) {
    const returnUrl = encodeURIComponent(pathname + search)
    return { type: 'redirect', to: `/login?returnUrl=${returnUrl}` }
  }

  // An Administrator may open every portal (D-032); everyone else only their own.
  if (role === 'admin' || role === area) return { type: 'allow' }
  return { type: 'redirect', to: dashboardFor(role) }
}
