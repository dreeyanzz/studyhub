import { describe, expect, it } from 'vitest'
import {
  chooseRolePath,
  dashboardFor,
  evaluateRouteAccess,
  landingPathFor,
  routeNeedsRole,
} from './role-guard'

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

// A Server Action is a POST to its page's own URL. A redirect would make the browser
// post it again to /login and break the page, so it goes through (#137).
describe('evaluateRouteAccess: requests other than page loads', () => {
  it.each(['/seeker', '/host/spaces', '/admin'])(
    'lets an anonymous POST to %s through to the action',
    (path) => {
      expect(evaluateRouteAccess(path, null, '', 'POST')).toEqual(allow)
    },
  )

  it("lets a POST to another role's portal through: the action and RLS decide", () => {
    expect(evaluateRouteAccess('/host', 'seeker', '', 'POST')).toEqual(allow)
    expect(evaluateRouteAccess('/seeker', 'host', '', 'POST')).toEqual(allow)
  })

  it('lets a signed-in POST to /login through', () => {
    expect(evaluateRouteAccess('/login', 'seeker', '', 'POST')).toEqual(allow)
  })

  it('still routes GET and HEAD', () => {
    expect(evaluateRouteAccess('/seeker', null, '', 'GET')).toEqual(
      redirectTo('/login?returnUrl=%2Fseeker'),
    )
    expect(evaluateRouteAccess('/seeker', null, '', 'HEAD')).toEqual(
      redirectTo('/login?returnUrl=%2Fseeker'),
    )
    expect(evaluateRouteAccess('/host', 'seeker', '', 'HEAD')).toEqual(
      redirectTo('/seeker'),
    )
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

  it('never returns a confirmed user to /choose-role', () => {
    expect(landingPathFor('seeker', '/choose-role')).toBe('/seeker')
    expect(landingPathFor('host', '/choose-role?role=host')).toBe('/host')
  })
})

describe('chooseRolePath (STORY-21, D-095)', () => {
  it('builds /choose-role with sanitized returnUrl and valid role hint', () => {
    expect(chooseRolePath()).toBe('/choose-role')
    expect(chooseRolePath('/spaces/1', 'host')).toBe(
      '/choose-role?returnUrl=%2Fspaces%2F1&role=host',
    )
    expect(chooseRolePath('//evil.example', 'seeker')).toBe('/choose-role?role=seeker')
  })
})

describe('evaluateRouteAccess: unconfirmed Google OAuth user and /choose-role (G11, G13)', () => {
  it('redirects a signed-out visitor on /choose-role to /login', () => {
    expect(evaluateRouteAccess('/choose-role', null)).toEqual(redirectTo('/login'))
  })

  it('redirects confirmed users away from /choose-role to their dashboard', () => {
    expect(evaluateRouteAccess('/choose-role', 'seeker', '', 'GET', true)).toEqual(
      redirectTo('/seeker'),
    )
    expect(evaluateRouteAccess('/choose-role', 'host', '', 'GET', true)).toEqual(
      redirectTo('/host'),
    )
    expect(evaluateRouteAccess('/choose-role', 'admin', '', 'GET', true)).toEqual(
      redirectTo('/admin'),
    )
  })

  it('allows an unconfirmed user on /choose-role and public routes', () => {
    for (const path of [
      '/choose-role',
      '/',
      '/spaces',
      '/spaces/1',
      '/choose-role-help',
    ]) {
      expect(evaluateRouteAccess(path, 'seeker', '', 'GET', false)).toEqual(allow)
    }
  })

  it.each(['/seeker', '/seeker/reservations/1', '/host', '/host/spaces', '/admin'])(
    'redirects an unconfirmed user from %s to /choose-role with returnUrl (G11)',
    (path) => {
      expect(evaluateRouteAccess(path, 'seeker', '?tab=1', 'GET', false)).toEqual(
        redirectTo(`/choose-role?returnUrl=${encodeURIComponent(`${path}?tab=1`)}`),
      )
    },
  )

  it('redirects an unconfirmed user from /login and /register to /choose-role keeping safe params', () => {
    expect(
      evaluateRouteAccess('/login', 'seeker', '?returnUrl=%2Fspaces%2F1', 'GET', false),
    ).toEqual(redirectTo('/choose-role?returnUrl=%2Fspaces%2F1'))
    expect(
      evaluateRouteAccess(
        '/register',
        'seeker',
        '?role=host&returnUrl=%2Fspaces%2F1',
        'GET',
        false,
      ),
    ).toEqual(redirectTo('/choose-role?returnUrl=%2Fspaces%2F1&role=host'))
  })

  it('drops unsafe returnUrl and invalid role=admin when forwarding from /register (O-N8, O-N9)', () => {
    expect(
      evaluateRouteAccess(
        '/register',
        'seeker',
        '?role=admin&returnUrl=//evil.example',
        'GET',
        false,
      ),
    ).toEqual(redirectTo('/choose-role'))
  })

  it('still lets POST Server Actions through on /choose-role and portals (#137)', () => {
    expect(evaluateRouteAccess('/choose-role', 'seeker', '', 'POST', false)).toEqual(
      allow,
    )
    expect(evaluateRouteAccess('/seeker', 'seeker', '', 'POST', false)).toEqual(allow)
  })
})

describe('routeNeedsRole', () => {
  it.each(['/', '/spaces', '/spaces/123', '/privacy', '/seekers', '/hostel'])(
    'returns false for public route %s',
    (path) => {
      expect(routeNeedsRole(path, 'GET')).toBe(false)
      expect(routeNeedsRole(path, 'HEAD')).toBe(false)
    },
  )

  it.each(['/login', '/register', '/choose-role', '/seeker', '/host/spaces', '/admin'])(
    'returns true for guarded page loads on %s and false for POST actions',
    (path) => {
      expect(routeNeedsRole(path, 'GET')).toBe(true)
      expect(routeNeedsRole(path, 'HEAD')).toBe(true)
      expect(routeNeedsRole(path, 'POST')).toBe(false)
    },
  )
})
