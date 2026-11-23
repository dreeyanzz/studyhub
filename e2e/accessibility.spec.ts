import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import postgres from 'postgres'

import { KNOWN_VIOLATIONS, type AccessibilityCheckKind } from './support/known-violations'
import {
  SWEEP_ROUTES,
  type RouteRole,
  type SweepFixtures,
  type SweepRoute,
} from './support/routes'
import { STRIPE_STUB_URL } from './support/stripe-stub'

/**
 * WCAG 2.1 AA accessibility sweep across every route in `e2e/support/routes.ts`
 * (STORY-19 design §3, TSK-19.3, SRS §3.2.2, D-031, D-093).
 *
 * Checks axe-core WCAG 2.1 A/AA rules, 48 x 48 px interactive control targets,
 * zero horizontal overflow at 360/768/1024 px (100% & 200% text), zero clipping
 * inside overflow-hidden cards at 200% text, and keyboard navigation with visible
 * focus. Ratcheted by `e2e/support/known-violations.ts`.
 */

const SEED_PASSWORD = 'Worq-demo-2026'
const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const SEEKER_ID = 'c0000000-0000-4000-8000-000000000001'
const SEEDED_HOST_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const FIXTURE_SPACE_NAME = 'A11y Sweep Fixture Space'

const WIDTHS = [360, 768, 1024] as const
const ROOT_FONT_SIZES = ['16px', '32px'] as const
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const ROLE_EMAILS: Record<Exclude<RouteRole, 'anon'>, string> = {
  seeker: 'seeker@example.test',
  host: 'host@example.test',
  admin: 'admin@example.test',
}

interface ObservedFinding {
  check: AccessibilityCheckKind
  rule: string
  detail: string
}

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

async function cleanupFixtureSpace() {
  const sql = db()
  try {
    await sql`
      delete from public.reservations
      where space_id in (
        select id from public.spaces
        where host_id = ${HOST_ID} and name = ${FIXTURE_SPACE_NAME}
      )
    `
    await sql`
      delete from public.spaces
      where host_id = ${HOST_ID} and name = ${FIXTURE_SPACE_NAME}
    `
  } finally {
    await sql.end()
  }
}

async function createSweepFixtures(): Promise<SweepFixtures> {
  await cleanupFixtureSpace()
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${FIXTURE_SPACE_NAME}, '1 Sweep Ave, Cebu City', '00:00', '00:00',
         'verified', interval '1 hour', 10.354, 123.9114, 'budget')
      returning id
    `
    if (!space) throw new Error('Failed to create fixture Space')

    const [zone] = await sql<{ id: string }[]>`
      insert into public.zones (space_id, name, position)
      values (${space.id}, 'Sweep Zone', 0)
      returning id
    `
    if (!zone) throw new Error('Failed to create fixture Zone')

    const [unit] = await sql<{ id: string }[]>`
      insert into public.units (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
      values (${space.id}, ${zone.id}, 'seat', 'A1', 0, 0, 1, 'available')
      returning id
    `
    if (!unit) throw new Error('Failed to create fixture Unit')

    let reservationId = ''
    await sql.begin(async (tx) => {
      await tx.unsafe('set local role authenticated')
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: SEEKER_ID, role: 'authenticated' })}, true)`
      const [held] = await tx<{ reservation_id: string }[]>`
        select * from public.hold_unit(${unit.id}, 30)
      `
      if (!held) throw new Error('Failed to create fixture hold')
      reservationId = held.reservation_id
      await tx`
        select public.attach_checkout_session(
          ${reservationId},
          ${'cs_test_a11y_' + reservationId.slice(0, 8)},
          ${STRIPE_STUB_URL + '/pay/none'}
        )
      `
    })

    return {
      hostSpaceId: SEEDED_HOST_SPACE_ID,
      seekerSpaceId: space.id,
      seekerUnitId: unit.id,
      reservationId,
    }
  } finally {
    await sql.end()
  }
}

async function signInContext(context: BrowserContext, role: Exclude<RouteRole, 'anon'>) {
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(ROLE_EMAILS[role])
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
  await page.close()
}

async function openRoute(
  page: Page,
  route: SweepRoute,
  fixtures: SweepFixtures,
  width: number,
) {
  const path = typeof route.path === 'function' ? route.path(fixtures) : route.path
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ''
  })
  await expect(page.locator('main')).toBeVisible()
  if (route.waitForSelector) {
    await expect(page.locator(route.waitForSelector)).toBeVisible()
  }
  await page.waitForLoadState('networkidle').catch(() => undefined)
}

async function findSmallTargets(page: Page, routeId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const small: string[] = []
    const selector =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]'
    for (const el of document.querySelectorAll(selector)) {
      if (el.closest('.leaflet-control-attribution')) continue
      if (id === 'public-spaces' && el.matches('h2 a')) continue
      if (el.closest('[aria-hidden="true"]')) continue

      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      let rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      // Radio and checkbox inputs wrapped in a <label> inherit the label's hit area.
      if (
        el instanceof HTMLInputElement &&
        (el.type === 'radio' || el.type === 'checkbox')
      ) {
        const wrappingLabel = el.closest('label')
        if (wrappingLabel) {
          const labelRect = wrappingLabel.getBoundingClientRect()
          rect = new DOMRect(
            labelRect.left,
            labelRect.top,
            Math.max(rect.width, labelRect.width),
            Math.max(rect.height, labelRect.height),
          )
        }
      }

      if (rect.width < 47.5 || rect.height < 47.5) {
        const name =
          el.getAttribute('data-testid') ??
          el.getAttribute('aria-label') ??
          el.textContent?.trim().slice(0, 40) ??
          el.tagName.toLowerCase()
        small.push(`${name} (${Math.round(rect.width)}x${Math.round(rect.height)})`)
      }
    }
    return small
  }, routeId)
}

async function findOverflowAndClipping(
  page: Page,
  fontSize: string,
): Promise<{ overflowPx: number; clipped: string[] }> {
  return page.evaluate((size) => {
    document.documentElement.style.fontSize = size
    const overflowPx = Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )

    const clipped: string[] = []
    if (size === '32px') {
      const checked = new Set<Element>()
      const candidates = [...document.querySelectorAll('[data-slot="card"], main *')]
      for (const el of candidates) {
        if (checked.has(el)) continue
        checked.add(el)
        if (
          el.classList.contains('sr-only') ||
          el.closest('.sr-only') ||
          el.closest('.leaflet-container') ||
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          continue
        }
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip'
        const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip'
        if (!clipsX && !clipsY) continue
        if (el.clientWidth === 0 || el.clientHeight === 0) continue

        const clippedX = clipsX && el.scrollWidth > el.clientWidth + 2
        const clippedY = clipsY && el.scrollHeight > el.clientHeight + 2
        if (clippedX || clippedY) {
          const label =
            el.getAttribute('data-slot') ??
            el.getAttribute('data-testid') ??
            el.textContent?.trim().slice(0, 40) ??
            el.tagName.toLowerCase()
          clipped.push(
            `${el.tagName.toLowerCase()}[${label}] (${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight})`,
          )
        }
      }
    }

    return { overflowPx, clipped }
  }, fontSize)
}

async function checkKeyboardFocusPath(page: Page): Promise<{
  reachedInMain: number
  missingVisibleFocus: string[]
}> {
  // Start focus cleanly at the top of the document before pressing Tab.
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  })

  const missingVisibleFocus = new Set<string>()
  let reachedInMain = 0
  let firstSignature: string | null = null

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement) {
        return {
          ignore: false,
          isBody: true,
          inMain: false,
          visible: true,
          label: 'body',
          sig: 'body',
        }
      }
      // Next.js dev tools injects <nextjs-portal> in `next dev` only.
      if (el.tagName.toLowerCase() === 'nextjs-portal' || el.closest('nextjs-portal')) {
        return {
          ignore: true,
          isBody: false,
          inMain: false,
          visible: true,
          label: 'nextjs-portal',
          sig: 'nextjs-portal',
        }
      }
      const hasFocusStyle = (node: Element | null): boolean => {
        if (!node) return false
        const style = window.getComputedStyle(node)
        const hasOutline =
          style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0
        const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== ''
        return hasOutline || hasShadow
      }
      const wrappingLabel = el.closest('label')
      // Native date/time inputs highlight an internal shadow-DOM spinbutton segment
      // on Tab even when Chromium only matches :focus-within on the outer <input>.
      const isShadowDateTimeInput =
        el instanceof HTMLInputElement &&
        ['time', 'date', 'datetime-local', 'month', 'week'].includes(el.type)
      const visible =
        isShadowDateTimeInput || hasFocusStyle(el) || hasFocusStyle(wrappingLabel)
      const inMain = Boolean(el.closest('main'))
      const label =
        el.getAttribute('data-testid') ??
        el.getAttribute('aria-label') ??
        el.getAttribute('name') ??
        (el.textContent?.trim().slice(0, 40) || el.getAttribute('type')) ??
        el.tagName.toLowerCase()
      const sig = `${el.tagName}:${el.id}:${label}`
      return {
        ignore: false,
        isBody: false,
        inMain,
        visible,
        label: `${el.tagName.toLowerCase()}(${label})`,
        sig,
      }
    })

    if (info.ignore) continue
    if (info.isBody) {
      if (i > 0 && reachedInMain > 0) break
      continue
    }
    if (i === 0) {
      firstSignature = info.sig
    } else if (firstSignature && info.sig === firstSignature && i > 2) {
      break
    }

    if (info.inMain) reachedInMain++
    if (!info.visible) missingVisibleFocus.add(info.label)
  }

  return {
    reachedInMain,
    missingVisibleFocus: [...missingVisibleFocus],
  }
}

async function inspectRoute(
  page: Page,
  route: SweepRoute,
  fixtures: SweepFixtures,
): Promise<ObservedFinding[]> {
  const findings: ObservedFinding[] = []
  const seen = new Set<string>()
  const add = (check: AccessibilityCheckKind, rule: string, detail: string) => {
    const key = `${check}::${rule}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push({ check, rule, detail })
  }

  // 1. Desktop 1024 px: axe WCAG 2.1 A/AA + keyboard focus path
  await openRoute(page, route, fixtures, 1024)
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  for (const v of axe.violations) {
    const targets = v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join('; ')
    add('axe', v.id, `${v.help} [${targets}]`)
  }

  const focusCheck = await checkKeyboardFocusPath(page)
  if (focusCheck.reachedInMain === 0) {
    add(
      'focus',
      'no-keyboard-focus-in-main',
      'Tab did not reach any control inside <main>',
    )
  }
  if (focusCheck.missingVisibleFocus.length > 0) {
    add(
      'focus',
      'missing-visible-focus',
      `No outline or box-shadow ring on Tab focus: ${focusCheck.missingVisibleFocus.slice(0, 5).join(', ')}`,
    )
  }

  // 2. Responsive widths (360, 768, 1024 px) at 100% and 200% text
  for (const width of WIDTHS) {
    await openRoute(page, route, fixtures, width)

    const small = await findSmallTargets(page, route.id)
    if (small.length > 0) {
      add(
        'target-size',
        'min-target-size-48px',
        `At ${width}px: ${small.slice(0, 5).join(', ')}`,
      )
    }

    for (const fontSize of ROOT_FONT_SIZES) {
      const { overflowPx, clipped } = await findOverflowAndClipping(page, fontSize)
      if (overflowPx > 0) {
        add(
          'overflow',
          'horizontal-overflow',
          `At ${width}px (${fontSize}): ${overflowPx}px horizontal overflow`,
        )
      }
      if (clipped.length > 0) {
        add(
          'clipping',
          'text-clipping-200',
          `At ${width}px (${fontSize}): ${clipped.slice(0, 4).join(', ')}`,
        )
      }
    }
  }

  return findings
}

test.describe('WCAG 2.1 AA accessibility sweep (STORY-19, TSK-19.3, D-093)', () => {
  let fixtures: SweepFixtures
  const roleContexts = new Map<RouteRole, BrowserContext>()

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    fixtures = await createSweepFixtures()

    const anonContext = await browser.newContext()
    roleContexts.set('anon', anonContext)

    for (const role of ['seeker', 'host', 'admin'] as const) {
      const context = await browser.newContext()
      await signInContext(context, role)
      roleContexts.set(role, context)
    }
  })

  test.afterAll(async () => {
    for (const context of roleContexts.values()) {
      await context.close()
    }
    await cleanupFixtureSpace()
  })

  for (const route of SWEEP_ROUTES) {
    test(`${route.id} (${route.label}, role=${route.role})`, async () => {
      test.setTimeout(60_000)
      const context = roleContexts.get(route.role)
      if (!context) throw new Error(`Missing browser context for ${route.role}`)
      const page = await context.newPage()

      try {
        const observed = await inspectRoute(page, route, fixtures)
        const expectedKnown = KNOWN_VIOLATIONS.filter((k) => k.routeId === route.id)

        const unexpected = observed.filter(
          (obs) =>
            !expectedKnown.some(
              (known) => known.check === obs.check && known.rule === obs.rule,
            ),
        )

        const resolvedKnown = expectedKnown.filter(
          (known) =>
            !observed.some((obs) => obs.check === known.check && obs.rule === known.rule),
        )

        expect(
          unexpected,
          `Unexpected accessibility violations on ${route.id}:\n${unexpected
            .map((u) => `  - [${u.check}] ${u.rule}: ${u.detail}`)
            .join('\n')}`,
        ).toEqual([])

        expect(
          resolvedKnown,
          `Known violations on ${route.id} are now fixed — remove them from e2e/support/known-violations.ts:\n${resolvedKnown
            .map((r) => `  - [${r.check}] ${r.rule} (#${r.issueNumber})`)
            .join('\n')}`,
        ).toEqual([])
      } finally {
        await page.close()
      }
    })
  }
})
