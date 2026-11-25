/**
 * Route inventory for the WCAG 2.1 AA accessibility sweep (STORY-19 design §3,
 * TSK-19.3, D-093).
 *
 * Every story that adds a route adds it here so `e2e/accessibility.spec.ts`
 * visits it as its role (or signed out for public routes).
 */

export type RouteRole = 'anon' | 'seeker' | 'host' | 'admin' | 'oauth_pending'

export interface SweepFixtures {
  /** Seeded Verified Space owned by `host@example.test` (Kapihan Study Hall). */
  hostSpaceId: string
  /** Isolated 24-hour fixture Space id for Seeker hold routes. */
  seekerSpaceId: string
  /** Isolated unit id on `seekerSpaceId`. */
  seekerUnitId: string
  /** Pending-payment reservation id held by `seeker@example.test`. */
  reservationId: string
}

export interface SweepRoute {
  id: string
  label: string
  role: RouteRole
  path: string | ((fixtures: SweepFixtures) => string)
  /** Wait for this selector inside the page before running checks. */
  waitForSelector?: string
}

export const SWEEP_ROUTES: readonly SweepRoute[] = [
  // Public & auth routes (signed-out visitor)
  {
    id: 'public-home',
    label: 'Landing page',
    role: 'anon',
    path: '/',
  },
  {
    id: 'public-spaces',
    label: 'Discovery map and list',
    role: 'anon',
    path: '/spaces',
    waitForSelector: '[data-testid="discovery-shell"]',
  },
  {
    id: 'public-space-profile',
    label: 'Verified Space profile',
    role: 'anon',
    path: (f) => `/spaces/${f.hostSpaceId}`,
  },
  {
    id: 'public-privacy',
    label: 'Privacy policy',
    role: 'anon',
    path: '/privacy',
  },
  {
    id: 'auth-login',
    label: 'Log in',
    role: 'anon',
    path: '/login',
  },
  {
    id: 'auth-register',
    label: 'Create account',
    role: 'anon',
    path: '/register',
  },
  {
    id: 'auth-choose-role',
    label: 'Choose role (OAuth onboarding)',
    role: 'oauth_pending',
    path: '/choose-role',
  },

  // Seeker routes (seeker@example.test)
  {
    id: 'seeker-dashboard',
    label: 'Seeker dashboard',
    role: 'seeker',
    path: '/seeker',
  },
  {
    id: 'seeker-history',
    label: 'Seeker reservation history',
    role: 'seeker',
    path: '/seeker/reservations',
  },
  {
    id: 'seeker-hold',
    label: 'Seeker hold page',
    role: 'seeker',
    path: (f) => `/seeker/reservations/${f.reservationId}`,
  },
  {
    id: 'seeker-hold-confirmation',
    label: 'Seeker payment confirmation page',
    role: 'seeker',
    path: (f) => `/seeker/reservations/${f.reservationId}/confirmation?status=cancelled`,
  },

  // Host routes (host@example.test)
  {
    id: 'host-dashboard',
    label: 'Host portal',
    role: 'host',
    path: '/host',
  },
  {
    id: 'host-space-edit',
    label: 'Host edit Space',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/edit`,
  },
  {
    id: 'host-space-delete',
    label: 'Host delete Space',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/delete`,
  },
  {
    id: 'host-space-seat-map',
    label: 'Host seat map builder',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/seat-map`,
  },
  {
    id: 'host-space-tags',
    label: 'Host amenities and tags',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/tags`,
  },
  {
    id: 'host-space-photos',
    label: 'Host Space photos',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/photos`,
  },
  {
    id: 'host-space-occupancy',
    label: 'Host Space occupancy',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/occupancy`,
  },
  {
    id: 'host-space-check-in',
    label: 'Host Check-in desk',
    role: 'host',
    path: (f) => `/host/spaces/${f.hostSpaceId}/check-in`,
  },

  // Administrator routes (admin@example.test)
  {
    id: 'admin-verification',
    label: 'Admin Space verification queue',
    role: 'admin',
    path: '/admin',
  },
]
