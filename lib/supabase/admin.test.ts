import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminClient } from './admin'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }))

describe('createAdminClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the project URL and the secret key, with no user session', () => {
    createAdminClient()

    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_secret_test',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  })

  it('throws, naming the settings, when either is missing', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/)

    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(() => createAdminClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
