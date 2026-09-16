import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests sit next to the code they test: lib/**/x.ts + lib/**/x.test.ts.
// Database policy tests are pgTAP (supabase/tests), and journeys are Playwright (e2e/).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
