// Measures end-to-end discovery search latency on /spaces (STORY-19 §3, SRS §3.4).
// Drives Playwright in a headless Chromium browser through 10 read-only searches,
// recording each run's duration from submit until URL/server state and results show,
// plus median and slowest timings.
//
// Usage:
//   node scripts/measure-search.mjs https://worqph.vercel.app
import { chromium } from '@playwright/test'

const SEARCH_TERMS = [
  'USC TC',
  'IT Park',
  'Lahug',
  'UP Cebu',
  'Banilad',
  'Talamban',
  'Mabolo',
  'Capitol',
  'Cebu City',
  'Study',
]

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

const rawUrl = process.argv[2] ?? 'https://worqph.vercel.app'
let baseUrl
try {
  baseUrl = new URL(rawUrl).toString().replace(/\/$/, '')
} catch {
  console.error(`Invalid URL: ${rawUrl}`)
  console.error('Usage: node scripts/measure-search.mjs <url>')
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/spaces`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="discovery-shell"]').waitFor({ state: 'visible' })
  const firstProfileHref = await page
    .locator('[data-testid^="space-card-"] a[href^="/spaces/"]')
    .first()
    .getAttribute('href')
    .catch(() => null)

  const input = page.locator('[data-testid="discovery-search-input"]')
  const submit = page.locator('[data-testid="search-submit-button"]')
  const results = page.locator(
    '[data-testid="space-card-list"] [data-space-id], [data-testid="seeker-search-no-results"]',
  )

  const runs = []
  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i]
    await input.fill(term)

    const startMs = performance.now()
    const navResponse = page
      .waitForResponse(
        (res) => res.url().includes('/spaces') && res.url().includes('q='),
        { timeout: 15_000 },
      )
      .catch(() => null)

    await Promise.all([
      page.waitForURL((u) => u.searchParams.get('q') === term, { timeout: 15_000 }),
      submit.click(),
    ])
    await navResponse
    await results.first().waitFor({ state: 'visible', timeout: 15_000 })
    const durationMs = Math.round(performance.now() - startMs)

    const matchText = await page
      .locator('[data-testid="space-card-list"] [aria-live="polite"]')
      .textContent()
    runs.push({
      run: i + 1,
      term,
      durationMs,
      summary: matchText?.trim() ?? 'rendered',
    })
    console.log(
      `Run ${i + 1}/10 (${term}): ${durationMs} ms — ${matchText?.trim() ?? 'rendered'}`,
    )
  }

  const durations = runs.map((r) => r.durationMs)
  const medianMs = Math.round(median(durations))
  const slowestMs = Math.max(...durations)
  const fastestMs = Math.min(...durations)

  console.log('')
  console.log(`Target: ${baseUrl}/spaces`)
  console.log(`Fastest: ${fastestMs} ms`)
  console.log(`Median:  ${medianMs} ms`)
  console.log(`Slowest: ${slowestMs} ms`)
  if (firstProfileHref) {
    console.log(`Sample profile route: ${baseUrl}${firstProfileHref}`)
  }
} finally {
  await browser.close()
}
