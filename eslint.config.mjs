// Flat config (Next 16 removed `next lint`; run `eslint .`).
// eslint-config-next already registers the jsx-a11y plugin, so only its
// recommended *rules* are added here: registering the plugin a second time
// throws "Cannot redefine plugin". The SRS requires WCAG 2.1 AA (§3.2.2).
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: jsxA11y.flatConfigs.recommended.rules },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // The secret-key client bypasses Row-Level Security. It may only be used by
      // route handlers that serve external callers, once a design doc justifies it.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/supabase/admin*'],
              message:
                'The secret-key client bypasses RLS. Import it only in app/api route handlers.',
            },
          ],
        },
      ],
    },
  },
  { files: ['app/api/**'], rules: { 'no-restricted-imports': 'off' } },
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'lib/supabase/database.types.ts',
    'docs/course/**',
    'supabase/**',
  ]),
])
