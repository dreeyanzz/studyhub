import { createBrowserClient } from '@supabase/ssr'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createClient } from './client'

vi.mock('@supabase/ssr', () => ({ createBrowserClient: vi.fn(() => ({})) }))

describe('createClient (browser)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the project URL and the publishable key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')

    createClient()

    expect(createBrowserClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
    )
  })

  it('fails with a clear message when the environment is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
