import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests sit next to the code they test: lib/**/x.ts + lib/**/x.test.ts.
// Database policy tests are pgTAP (supabase/tests), and journeys are Playwright (e2e/).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // Next maps `import 'server-only'` to its own copy, and so do these tests: the
      // empty file, as in a Server Component, since the tests run on the server.
      'server-only': fileURLToPath(
        new URL(
          './node_modules/next/dist/compiled/server-only/empty.js',
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'components/**/*.test.{ts,tsx}',
      'app/**/*.test.{ts,tsx}',
    ],
  },
})
