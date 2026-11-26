import { describe, expect, it, vi } from 'vitest'

import {
  parseEmailArg,
  promoteAdminAccount,
  validateProductionEnv,
} from './promote-admin.mjs'

describe('parseEmailArg', () => {
  it('accepts a valid real email with a Gmail-style + tag and normalizes case', () => {
    // Uses RFC 2606 example.org as a synthetic non-@example.test domain (D-013, D-091).
    expect(parseEmailArg(['  Team+Admin@Example.org  '])).toEqual({
      ok: true,
      email: 'team+admin@example.org',
    })
  })

  it('strips a leading -- separator when passed directly', () => {
    expect(parseEmailArg(['--', 'ops+admin@example.org'])).toEqual({
      ok: true,
      email: 'ops+admin@example.org',
    })
  })

  it('rejects missing or extra arguments', () => {
    expect(parseEmailArg([])).toMatchObject({ ok: false })
    expect(parseEmailArg(['a@example.org', 'b@example.org'])).toMatchObject({
      ok: false,
    })
  })

  it('rejects malformed email addresses', () => {
    expect(parseEmailArg(['not-an-email'])).toMatchObject({ ok: false })
    expect(parseEmailArg(['admin@localhost'])).toMatchObject({ ok: false })
  })

  it('refuses @example.test synthetic addresses on production (D-091)', () => {
    const result = parseEmailArg(['Admin@EXAMPLE.TEST'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('@example.test')
    }
  })
})

describe('validateProductionEnv', () => {
  it('accepts distinct HTTPS production credentials', () => {
    expect(
      validateProductionEnv({
        PRODUCTION_SUPABASE_URL: 'https://prod-project.supabase.co/',
        PRODUCTION_SECRET_KEY: 'sb_secret_prod_only',
        NEXT_PUBLIC_SUPABASE_URL: 'https://dev-project.supabase.co',
      }),
    ).toEqual({
      ok: true,
      url: 'https://prod-project.supabase.co',
      host: 'prod-project.supabase.co',
      secretKey: 'sb_secret_prod_only',
    })
  })

  it('requires PRODUCTION_* variables and never falls back to cloud dev names (D-090)', () => {
    const missing = validateProductionEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://dev-project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_dev_only',
    })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error).toContain('PRODUCTION_SUPABASE_URL')
    }
  })

  it('rejects non-HTTPS, invalid, and localhost URLs', () => {
    expect(
      validateProductionEnv({
        PRODUCTION_SUPABASE_URL: 'not-a-url',
        PRODUCTION_SECRET_KEY: 'sb_secret_prod',
      }),
    ).toMatchObject({ ok: false })

    expect(
      validateProductionEnv({
        PRODUCTION_SUPABASE_URL: 'http://prod-project.supabase.co',
        PRODUCTION_SECRET_KEY: 'sb_secret_prod',
      }),
    ).toMatchObject({ ok: false })

    expect(
      validateProductionEnv({
        PRODUCTION_SUPABASE_URL: 'https://127.0.0.1:54321',
        PRODUCTION_SECRET_KEY: 'sb_secret_prod',
      }),
    ).toMatchObject({ ok: false })

    expect(
      validateProductionEnv({
        PRODUCTION_SUPABASE_URL: 'https://localhost:54321',
        PRODUCTION_SECRET_KEY: 'sb_secret_prod',
      }),
    ).toMatchObject({ ok: false })
  })

  it('refuses to run when PRODUCTION_SUPABASE_URL matches NEXT_PUBLIC_SUPABASE_URL (D-090)', () => {
    const result = validateProductionEnv({
      PRODUCTION_SUPABASE_URL: 'https://shared-dev.supabase.co/',
      PRODUCTION_SECRET_KEY: 'sb_secret_prod',
      NEXT_PUBLIC_SUPABASE_URL: 'https://shared-dev.supabase.co',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('matches NEXT_PUBLIC_SUPABASE_URL')
    }
  })
})

type FakeUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

function makeFakeSupabase({
  pages,
  listError = null,
  updateError = null,
  readResult = { data: { role: 'admin', role_confirmed: true }, error: null },
}: {
  pages: FakeUser[][]
  listError?: { message: string } | null
  updateError?: { message: string } | null
  readResult?: {
    data: { role?: string | null; role_confirmed?: boolean | null } | null
    error: { message: string } | null
  }
}) {
  const listUsers = vi.fn(async ({ page }: { page: number; perPage: number }) => {
    if (listError) {
      return { data: null, error: listError }
    }
    const users = pages[page - 1] ?? []
    const nextPage = page < pages.length ? page + 1 : null
    return { data: { users, nextPage }, error: null }
  })

  const updateEq = vi.fn(async () => ({ error: updateError }))
  const update = vi.fn(() => ({ eq: updateEq }))

  const selectSingle = vi.fn(async () => readResult)
  const selectEq = vi.fn(() => ({ single: selectSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))

  const from = vi.fn(() => ({ update, select }))

  return {
    supabase: {
      auth: { admin: { listUsers } },
      from,
    },
    spies: { listUsers, from, update, updateEq, select, selectEq, selectSingle },
  }
}

describe('promoteAdminAccount', () => {
  it('logs target host, promotes a confirmed user to admin + role_confirmed, and verifies read-back', async () => {
    const logs: string[] = []
    const { supabase, spies } = makeFakeSupabase({
      pages: [
        [
          {
            id: 'user-admin-1',
            email: 'Team+Admin@Example.org',
            email_confirmed_at: '2026-11-24T12:00:00Z',
          },
        ],
      ],
    })

    const result = await promoteAdminAccount({
      supabase,
      email: 'team+admin@example.org',
      host: 'prod-project.supabase.co',
      log: (line) => logs.push(line),
    })

    expect(result).toEqual({
      ok: true,
      userId: 'user-admin-1',
      email: 'team+admin@example.org',
      host: 'prod-project.supabase.co',
      role: 'admin',
      roleConfirmed: true,
    })
    expect(logs[0]).toContain('prod-project.supabase.co')
    expect(spies.from).toHaveBeenCalledWith('profiles')
    expect(spies.update).toHaveBeenCalledWith({
      role: 'admin',
      role_confirmed: true,
    })
    expect(spies.updateEq).toHaveBeenCalledWith('id', 'user-admin-1')
    expect(spies.select).toHaveBeenCalledWith('role, role_confirmed')
    expect(spies.selectEq).toHaveBeenCalledWith('id', 'user-admin-1')
  })

  it('paginates across pages to find the user', async () => {
    const firstPage: FakeUser[] = Array.from({ length: 200 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@example.org`,
      email_confirmed_at: '2026-11-24T12:00:00Z',
    }))
    const secondPage: FakeUser[] = [
      {
        id: 'user-admin-page-2',
        email: 'team+admin@example.org',
        email_confirmed_at: '2026-11-24T12:05:00Z',
      },
    ]

    const { supabase, spies } = makeFakeSupabase({
      pages: [firstPage, secondPage],
    })

    const result = await promoteAdminAccount({
      supabase,
      email: 'team+admin@example.org',
      host: 'prod-project.supabase.co',
      log: () => {},
    })

    expect(result).toMatchObject({ ok: true, userId: 'user-admin-page-2' })
    expect(spies.listUsers).toHaveBeenCalledTimes(2)
  })

  it('refuses to promote when the account does not exist', async () => {
    const { supabase, spies } = makeFakeSupabase({
      pages: [
        [
          {
            id: 'other-user',
            email: 'someone@example.org',
            email_confirmed_at: '2026-11-24T12:00:00Z',
          },
        ],
      ],
    })

    const result = await promoteAdminAccount({
      supabase,
      email: 'team+admin@example.org',
      host: 'prod-project.supabase.co',
      log: () => {},
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No account found')
    }
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('refuses to promote an account whose email is not confirmed yet (D-091)', async () => {
    const { supabase, spies } = makeFakeSupabase({
      pages: [
        [
          {
            id: 'unconfirmed-user',
            email: 'team+admin@example.org',
            email_confirmed_at: null,
          },
        ],
      ],
    })

    const result = await promoteAdminAccount({
      supabase,
      email: 'team+admin@example.org',
      host: 'prod-project.supabase.co',
      log: () => {},
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('has not confirmed its email')
    }
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('reports errors from listUsers, profile update, and read-back verification', async () => {
    const listFail = makeFakeSupabase({
      pages: [],
      listError: { message: 'Invalid API key' },
    })
    expect(
      await promoteAdminAccount({
        supabase: listFail.supabase,
        email: 'team+admin@example.org',
        host: 'prod-project.supabase.co',
        log: () => {},
      }),
    ).toEqual({
      ok: false,
      error: 'Could not list accounts on prod-project.supabase.co: Invalid API key',
    })

    const updateFail = makeFakeSupabase({
      pages: [
        [
          {
            id: 'user-1',
            email: 'team+admin@example.org',
            email_confirmed_at: '2026-11-24T12:00:00Z',
          },
        ],
      ],
      updateError: { message: 'permission denied' },
    })
    expect(
      await promoteAdminAccount({
        supabase: updateFail.supabase,
        email: 'team+admin@example.org',
        host: 'prod-project.supabase.co',
        log: () => {},
      }),
    ).toEqual({
      ok: false,
      error:
        'Failed to promote team+admin@example.org on prod-project.supabase.co: permission denied',
    })

    const verifyFail = makeFakeSupabase({
      pages: [
        [
          {
            id: 'user-1',
            email: 'team+admin@example.org',
            email_confirmed_at: '2026-11-24T12:00:00Z',
          },
        ],
      ],
      readResult: { data: { role: 'seeker', role_confirmed: true }, error: null },
    })
    expect(
      await promoteAdminAccount({
        supabase: verifyFail.supabase,
        email: 'team+admin@example.org',
        host: 'prod-project.supabase.co',
        log: () => {},
      }),
    ).toMatchObject({ ok: false })
  })
})
