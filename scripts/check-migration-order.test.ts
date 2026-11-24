import { describe, expect, it } from 'vitest'

import {
  parseMigrationTimestamp,
  parseNameStatusOutput,
  validateMigrationChanges,
} from './check-migration-order.mjs'

describe('parseMigrationTimestamp', () => {
  it('extracts the 14-digit timestamp from a valid migration path', () => {
    expect(
      parseMigrationTimestamp('supabase/migrations/20261124053742_review_moderation.sql'),
    ).toBe('20261124053742')
  })

  it('normalizes Windows backslashes', () => {
    expect(
      parseMigrationTimestamp(
        'supabase\\migrations\\20261124053742_review_moderation.sql',
      ),
    ).toBe('20261124053742')
  })

  it('rejects missing timestamps, wrong extensions, and nested paths', () => {
    expect(parseMigrationTimestamp('supabase/migrations/init.sql')).toBeNull()
    expect(parseMigrationTimestamp('supabase/migrations/20261124_short.sql')).toBeNull()
    expect(
      parseMigrationTimestamp('supabase/migrations/20261124053742_notes.txt'),
    ).toBeNull()
    expect(
      parseMigrationTimestamp('supabase/migrations/nested/20261124053742_foo.sql'),
    ).toBeNull()
  })
})

describe('parseNameStatusOutput', () => {
  it('parses tab-separated git diff name-status lines', () => {
    const output = [
      'A\tsupabase/migrations/20261124060000_history.sql',
      'M\tsupabase/migrations/20261124053742_review_moderation.sql',
      '',
    ].join('\n')

    expect(parseNameStatusOutput(output)).toEqual([
      { status: 'A', path: 'supabase/migrations/20261124060000_history.sql' },
      {
        status: 'M',
        path: 'supabase/migrations/20261124053742_review_moderation.sql',
      },
    ])
  })
})

describe('validateMigrationChanges', () => {
  const baseFiles = [
    'supabase/migrations/20260926032341_profiles.sql',
    'supabase/migrations/20261124053742_review_moderation.sql',
  ]

  it('passes when a new migration timestamp is strictly greater than main', () => {
    const result = validateMigrationChanges(baseFiles, [
      {
        status: 'A',
        path: 'supabase/migrations/20261124060000_reservation_history.sql',
      },
    ])

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.addedCount).toBe(1)
    expect(result.latestBase?.timestamp).toBe('20261124053742')
  })

  it('passes when multiple new migrations are newer and have unique timestamps', () => {
    const result = validateMigrationChanges(baseFiles, [
      { status: 'A', path: 'supabase/migrations/20261124060000_first.sql' },
      { status: 'A', path: 'supabase/migrations/20261124060100_second.sql' },
    ])

    expect(result.ok).toBe(true)
    expect(result.addedCount).toBe(2)
  })

  it('fails when a new migration timestamp is older than or equal to main', () => {
    const older = validateMigrationChanges(baseFiles, [
      { status: 'A', path: 'supabase/migrations/20261124050000_stale.sql' },
    ])
    expect(older.ok).toBe(false)
    expect(older.errors[0]).toContain('must be newer')

    const equal = validateMigrationChanges(baseFiles, [
      { status: 'A', path: 'supabase/migrations/20261124053742_same_sec.sql' },
    ])
    expect(equal.ok).toBe(false)
    expect(equal.errors[0]).toContain('must be newer')
  })

  it('fails when two new migrations in the same PR share a timestamp', () => {
    const result = validateMigrationChanges(baseFiles, [
      { status: 'A', path: 'supabase/migrations/20261124060000_one.sql' },
      { status: 'A', path: 'supabase/migrations/20261124060000_two.sql' },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('reuses timestamp')
  })

  it('fails when an existing applied migration is modified or deleted', () => {
    const modified = validateMigrationChanges(baseFiles, [
      {
        status: 'M',
        path: 'supabase/migrations/20261124053742_review_moderation.sql',
      },
    ])
    expect(modified.ok).toBe(false)
    expect(modified.errors[0]).toContain('Never edit, rename, or delete')

    const deleted = validateMigrationChanges(baseFiles, [
      { status: 'D', path: 'supabase/migrations/20260926032341_profiles.sql' },
    ])
    expect(deleted.ok).toBe(false)
    expect(deleted.errors[0]).toContain('git status D')
  })

  it('fails when a new file in supabase/migrations/ does not match the filename pattern', () => {
    const result = validateMigrationChanges(baseFiles, [
      { status: 'A', path: 'supabase/migrations/bad_name.sql' },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('YYYYMMDDHHMMSS_<name>.sql')
  })

  it('handles an empty base migration list', () => {
    const result = validateMigrationChanges(
      [],
      [{ status: 'A', path: 'supabase/migrations/20260926032341_profiles.sql' }],
    )

    expect(result.ok).toBe(true)
    expect(result.latestBase).toBeNull()
  })
})
