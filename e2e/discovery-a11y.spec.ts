import { expect, test, type Page } from '@playwright/test'

/**
 * TSK-08.6 (STORY-08 design §3 Accessibility, SRS §3.2.2, D-031): the discovery page,
 * measured in a browser. The unit tests next to the components read their markup, which
 * can't show a size, an overflow or where keyboard focus goes. Runs as a signed-out
 * visitor against the seeded Verified Spaces (supabase/seed.sql).
 */

const WIDTHS = [360, 768, 1024] as const

// 100% and 200% text. Tailwind sizes are in rem, so doubling the root font size scales
// the page the way a browser's text-size setting does.
const ROOT_FONT_SIZES = ['16px', '32px'] as const

async function openDiscovery(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/spaces')
  // A click before React hydrates does nothing, so wait until it has.
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="search-submit-button"]')
    return (
      button !== null && Object.keys(button).some((key) => key.startsWith('__reactProps'))
    )
  })
}

/** Below 1024 px the map sits behind the Map/List toggle. */
async function showMap(page: Page, width: number) {
  if (width < 1024) await page.getByTestId('mobile-view-toggle').click()
  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible()
}

async function horizontalOverflow(page: Page, rootFontSize: string) {
  return page.evaluate((size) => {
    document.documentElement.style.fontSize = size
    return document.documentElement.scrollWidth - document.documentElement.clientWidth
  }, rootFontSize)
}

/**
 * Visible controls in the discovery shell smaller than 48 × 48 px. Two kinds are below it
 * on purpose (STORY-08 design §9): a card's title link, whose card also has a 48 px "View
 * Space" link to the same page, and the map's attribution, which is inline text.
 */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="discovery-shell"]')
    if (!shell) return ['no discovery shell']
    const small: string[] = []
    for (const control of shell.querySelectorAll(
      'button, a[href], input, [role="button"]',
    )) {
      if (control.matches('h2 a') || control.closest('.leaflet-control-attribution'))
        continue
      const box = control.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue // not shown at this width
      if (box.width < 47.5 || box.height < 47.5) {
        const name =
          control.getAttribute('data-testid') ??
          control.getAttribute('aria-label') ??
          control.textContent?.trim()
        small.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }
    return small
  })
}

test.describe('discovery page accessibility (TSK-08.6)', () => {
  for (const width of WIDTHS) {
    test(`no sideways scrolling at ${width} px, with text at 100% and 200%`, async ({
      page,
    }) => {
      await openDiscovery(page, width)
      for (const size of ROOT_FONT_SIZES) {
        expect(await horizontalOverflow(page, size), `list view, root font ${size}`).toBe(
          0,
        )
      }

      await page.evaluate(() => {
        document.documentElement.style.fontSize = ''
      })
      await showMap(page, width)
      for (const size of ROOT_FONT_SIZES) {
        expect(await horizontalOverflow(page, size), `map view, root font ${size}`).toBe(
          0,
        )
      }
    })

    test(`every control is at least 48 x 48 px at ${width} px`, async ({ page }) => {
      await openDiscovery(page, width)
      expect(await smallTargets(page)).toEqual([])

      await showMap(page, width)
      expect(await smallTargets(page)).toEqual([])
    })
  }

  test('the filter drawer keeps keyboard focus until it closes', async ({ page }) => {
    await openDiscovery(page, 360)
    const trigger = page.getByTestId('filter-drawer-trigger')
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Filter Study Spaces' })
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('filter-drawer-close')).toBeFocused()

    // Past the last control and back past the first, focus stays in the drawer.
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press(key)
        expect(
          await dialog.evaluate((d) => d.contains(document.activeElement)),
          key,
        ).toBe(true)
      }
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('"Reset all filters" brings results back and leaves focus on the list', async ({
    page,
  }) => {
    await openDiscovery(page, 1024)
    const search = page.getByTestId('discovery-search-input')
    await search.fill('Nowhere Invented Place')
    await search.press('Enter')
    await expect(page.getByTestId('seeker-search-no-results')).toBeVisible()

    await page.getByTestId('reset-all-filters-button').focus()
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('seeker-search-no-results')).toBeHidden()
    await expect(page.getByTestId('space-card-list')).toBeFocused()
  })
})
