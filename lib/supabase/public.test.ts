import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPublicClient } from './public'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

describe('createPublicClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('creates a stateless anon client with the project URL and publishable key', () => {
    createPublicClient()

    expect(createSupabaseClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  })

  it('fails with a clear message when the environment is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')

    expect(() => createPublicClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
