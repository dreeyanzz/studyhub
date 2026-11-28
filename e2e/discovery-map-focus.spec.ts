import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * STORY-08 (FR-1.1): clicking a Space card on /spaces centres the discovery map on that
 * Space's pin and zooms in to street level, without leaving the page.
 *
 * Creates its own Verified Space with a map pin as postgres and removes it afterwards,
 * so it never depends on seeded rows or other specs.
 */

const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HOST_ID = 'b0000000-0000-4000-8000-000000000001' // host@example.test (seed.sql)
const NAME_PREFIX = 'Map Focus'
const ADDRESS = '7 Pin Drop Street, Cebu City'
const CARD_FOCUS_ZOOM = 16

let spaceId = ''

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

async function cleanup() {
  const sql = db()
  try {
    await sql`
      delete from public.spaces
      where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}
    `
  } finally {
    await sql.end()
  }
}

test.beforeAll(async () => {
  await cleanup()
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${`${NAME_PREFIX} Space ${Date.now()}`}, ${ADDRESS}, '00:00', '00:00',
         'verified', interval '1 hour', 10.3105, 123.8915, 'budget')
      returning id
    `
    if (!space) throw new Error('Failed to create the map focus fixture Space')
    spaceId = space.id
  } finally {
    await sql.end()
  }
})

test.afterAll(cleanup)

async function openDiscovery(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/spaces')
  // A click before React hydrates does nothing, so wait until it has.
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="search-submit-button"]')
    return (
      button !== null && Object.keys(button).some((key) => key.startsWith('__reactProps'))
    )
  })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
}

/**
 * The map's current zoom, read from the tiles Leaflet shows on top. Leaflet stacks one
 * tile container per zoom level and gives the current level the highest z-index.
 */
function currentZoom(page: Page) {
  return page.evaluate(() => {
    let best: { z: number; zoom: number } | null = null
    for (const container of document.querySelectorAll<HTMLElement>(
      '.leaflet-tile-container',
    )) {
      const src = container.querySelector('img')?.getAttribute('src')
      const zoom = src ? Number(/\/(\d+)\/\d+\/\d+\.png/.exec(src)?.[1]) : NaN
      const z = Number(container.style.zIndex)
      if (!Number.isNaN(zoom) && (best === null || z > best.z)) best = { z, zoom }
    }
    return best?.zoom ?? null
  })
}

test.describe('card click centres the discovery map (FR-1.1)', () => {
  test('flies to the pin, zooms in, opens its popup and stays on /spaces', async ({
    page,
  }) => {
    await openDiscovery(page)
    expect(await currentZoom(page)).toBeLessThan(CARD_FOCUS_ZOOM)

    const card = page.getByTestId(`space-card-${spaceId}`)
    await card.getByText(ADDRESS).click()

    await expect(page).toHaveURL(/\/spaces$/)
    await expect.poll(() => currentZoom(page)).toBe(CARD_FOCUS_ZOOM)
    await expect(page.locator('.leaflet-popup')).toContainText(ADDRESS)
    await expect(card).toHaveClass(/ring-primary/)
  })

  test('clicking the same card again re-centres after the map was zoomed out', async ({
    page,
  }) => {
    await openDiscovery(page)
    const address = page.getByTestId(`space-card-${spaceId}`).getByText(ADDRESS)

    await address.click()
    await expect.poll(() => currentZoom(page)).toBe(CARD_FOCUS_ZOOM)

    await page.locator('.leaflet-control-zoom-out').click()
    await expect.poll(() => currentZoom(page)).toBe(CARD_FOCUS_ZOOM - 1)

    await address.click()
    await expect.poll(() => currentZoom(page)).toBe(CARD_FOCUS_ZOOM)
  })

  test('the View Space link still opens the Space profile', async ({ page }) => {
    await openDiscovery(page)
    await page
      .getByTestId(`space-card-${spaceId}`)
      .getByRole('link', { name: /View Space/ })
      .click()
    await expect(page).toHaveURL(new RegExp(`/spaces/${spaceId}$`))
  })
})
