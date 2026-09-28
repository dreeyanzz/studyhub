import { describe, expect, it } from 'vitest'
import { dashboardFor, evaluateRouteAccess, landingPathFor } from './role-guard'

const allow = { type: 'allow' }
const redirectTo = (to: string) => ({ type: 'redirect', to })

describe('evaluateRouteAccess: anonymous visitor', () => {
  it.each([
    '/seeker',
    '/seeker/profile',
    '/host',
    '/host/spaces',
    '/admin',
    '/admin/spaces',
  ])('sends %s to /login with a returnUrl', (path) => {
    expect(evaluateRouteAccess(path, null)).toEqual(
      redirectTo(`/login?returnUrl=${encodeURIComponent(path)}`),
    )
  })

  it('keeps the query string in the returnUrl', () => {
    expect(evaluateRouteAccess('/host/spaces', null, '?page=2')).toEqual(
      redirectTo('/login?returnUrl=%2Fhost%2Fspaces%3Fpage%3D2'),
    )
  })

  it.each(['/', '/login', '/register', '/api/auth/callback', '/about'])(
    'may open %s',
    (path) => {
      expect(evaluateRouteAccess(path, null)).toEqual(allow)
    },
  )
})

describe('evaluateRouteAccess: seeker', () => {
  it.each(['/seeker', '/seeker/profile'])('may open %s', (path) => {
    expect(evaluateRouteAccess(path, 'seeker')).toEqual(allow)
  })

  it.each(['/host', '/host/spaces', '/admin', '/admin/spaces'])(
    'is sent from %s to /seeker',
    (path) => {
      expect(evaluateRouteAccess(path, 'seeker')).toEqual(redirectTo('/seeker'))
    },
  )
})

describe('evaluateRouteAccess: host', () => {
  it.each(['/host', '/host/spaces'])('may open %s', (path) => {
    expect(evaluateRouteAccess(path, 'host')).toEqual(allow)
  })

  it.each(['/seeker', '/seeker/profile', '/admin', '/admin/spaces'])(
    'is sent from %s to /host',
    (path) => {
      expect(evaluateRouteAccess(path, 'host')).toEqual(redirectTo('/host'))
    },
  )
})

describe('evaluateRouteAccess: admin', () => {
  it.each(['/admin', '/seeker', '/host', '/host/spaces'])(
    'may open %s (D-032)',
    (path) => {
      expect(evaluateRouteAccess(path, 'admin')).toEqual(allow)
    },
  )
})

describe('evaluateRouteAccess: signed-in user on an auth page', () => {
  it.each([
    ['seeker', '/seeker'],
    ['host', '/host'],
    ['admin', '/admin'],
  ] as const)('sends a %s from /login and /register to %s', (role, dashboard) => {
    expect(evaluateRouteAccess('/login', role)).toEqual(redirectTo(dashboard))
    expect(evaluateRouteAccess('/register', role)).toEqual(redirectTo(dashboard))
  })
})

describe('evaluateRouteAccess: path matching', () => {
  it.each(['/seekers', '/hostel', '/administrator', '/login-help'])(
    'treats %s as public, not as a portal',
    (path) => {
      expect(evaluateRouteAccess(path, null)).toEqual(allow)
      expect(evaluateRouteAccess(path, 'seeker')).toEqual(allow)
    },
  )

  it('treats a trailing slash as the portal', () => {
    expect(evaluateRouteAccess('/host/', 'seeker')).toEqual(redirectTo('/seeker'))
  })

  it('lets every signed-in role open public pages', () => {
    for (const role of ['seeker', 'host', 'admin'] as const) {
      expect(evaluateRouteAccess('/', role)).toEqual(allow)
    }
  })
})

describe('dashboardFor', () => {
  it('maps each role to its portal', () => {
    expect(dashboardFor('seeker')).toBe('/seeker')
    expect(dashboardFor('host')).toBe('/host')
    expect(dashboardFor('admin')).toBe('/admin')
  })
})

describe('landingPathFor', () => {
  it.each([
    ['seeker', '/seeker'],
    ['host', '/host'],
    ['admin', '/admin'],
  ] as const)('sends a %s with no returnUrl to %s', (role, dashboard) => {
    expect(landingPathFor(role)).toBe(dashboard)
    expect(landingPathFor(role, '')).toBe(dashboard)
  })

  it('returns to a page the role may open, keeping its query string', () => {
    expect(landingPathFor('seeker', '/seeker/profile?tab=phone')).toBe(
      '/seeker/profile?tab=phone',
    )
    expect(landingPathFor('host', '/host/spaces')).toBe('/host/spaces')
  })

  it("sends a user away from another role's portal to their own dashboard", () => {
    expect(landingPathFor('seeker', '/host/spaces')).toBe('/seeker')
    expect(landingPathFor('host', '/admin')).toBe('/host')
  })

  it('lets an admin return to any portal (D-032)', () => {
    expect(landingPathFor('admin', '/host/spaces')).toBe('/host/spaces')
  })

  it('never returns to /login or /register', () => {
    expect(landingPathFor('seeker', '/login')).toBe('/seeker')
    expect(landingPathFor('host', '/register?returnUrl=%2Fhost')).toBe('/host')
  })

  it('returns to a public page', () => {
    expect(landingPathFor('seeker', '/')).toBe('/')
  })
})
