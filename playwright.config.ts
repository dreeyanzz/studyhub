import { execSync } from 'node:child_process'

import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
// localhost, not 127.0.0.1: Next 16 blocks its dev resources (the HMR socket) for
// any other host name unless next.config.ts lists it in allowedDevOrigins.
const BASE_URL = `http://localhost:${PORT}`

// The local stack's own URL and publishable key, from `supabase status` (STORY-06
// design §1), so the app never gets .env.local's cloud values or a stand-in key
// (D-013, D-028). Fails here if the stack is not running: `npm run db:start`.
const localStack = new Map(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: 'pipe' })
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^(\w+)="(.*)"$/.exec(line)
      return match?.[1] && match[2] ? [[match[1], match[2]] as const] : []
    }),
)

/**
 * Playwright configuration for StudyHub (STORY-06).
 *
 * Runs against the local Supabase stack only (D-013, D-028). Starts its own copy
 * of the app on port 3100 so it never reuses a running dev server pointed at
 * the cloud project.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: localStack.get('API_URL') ?? '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localStack.get('PUBLISHABLE_KEY') ?? '',
    },
  },
})
