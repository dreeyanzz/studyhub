// Checks that a branch's changes under supabase/migrations/ follow D-066 and
// AGENTS.md rule 9:
//   1. Existing migrations already on the base branch are never edited,
//      renamed, or deleted.
//   2. Every new migration matches YYYYMMDDHHMMSS_<name>.sql, has a timestamp
//      strictly greater than the latest migration on the base branch, and does
//      not duplicate another new migration's timestamp.
//
// Usage:
//   npm run db:check-order
//   node scripts/check-migration-order.mjs origin/main
//
// Compares committed branch changes (`<baseRef>...HEAD`) against the migrations
// tree on `<baseRef>`, so both local runs and GitHub Actions pull_request runs
// see the exact migrations added or altered by the PR.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MIGRATIONS_PREFIX = 'supabase/migrations/'
const MIGRATION_PATTERN = /^supabase\/migrations\/(\d{14})_[^/]+\.sql$/

/**
 * Extracts the 14-digit timestamp from a migration path, or null if the path
 * does not follow `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.
 * @param {string} filePath
 * @returns {string | null}
 */
export function parseMigrationTimestamp(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  const match = MIGRATION_PATTERN.exec(normalized)
  return match?.[1] ?? null
}

/**
 * Parses `git diff --name-status --no-renames` stdout into structured entries.
 * @param {string} stdout
 * @returns {Array<{ status: string, path: string }>}
 */
export function parseNameStatusOutput(stdout) {
  /** @type {Array<{ status: string, path: string }>} */
  const entries = []
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const tabIndex = line.indexOf('\t')
    if (tabIndex === -1) continue
    const status = line.slice(0, tabIndex).trim()
    const path = line
      .slice(tabIndex + 1)
      .trim()
      .replace(/\\/g, '/')
    if (status && path) {
      entries.push({ status, path })
    }
  }
  return entries
}

/**
 * Validates migration changes against the base branch's existing migrations.
 * @param {string[]} baseFiles
 * @param {Array<{ status: string, path: string }>} diffEntries
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   latestBase: { timestamp: string, path: string } | null,
 *   addedCount: number,
 * }}
 */
export function validateMigrationChanges(baseFiles, diffEntries) {
  /** @type {{ timestamp: string, path: string } | null} */
  let latestBase = null
  for (const rawPath of baseFiles) {
    const path = rawPath.replace(/\\/g, '/')
    const timestamp = parseMigrationTimestamp(path)
    if (!timestamp) continue
    if (!latestBase || timestamp > latestBase.timestamp) {
      latestBase = { timestamp, path }
    }
  }

  /** @type {string[]} */
  const errors = []
  /** @type {Map<string, string>} */
  const seenAdded = new Map()
  let addedCount = 0

  for (const entry of diffEntries) {
    const path = entry.path.replace(/\\/g, '/')
    if (!path.startsWith(MIGRATIONS_PREFIX)) continue

    if (entry.status !== 'A') {
      errors.push(
        `Applied migration "${path}" was changed (git status ${entry.status}). Never edit, rename, or delete an applied migration (AGENTS.md rule 9); add a new migration with npm run db:new instead.`,
      )
      continue
    }

    addedCount += 1
    const timestamp = parseMigrationTimestamp(path)
    if (!timestamp) {
      errors.push(
        `New migration "${path}" must match supabase/migrations/YYYYMMDDHHMMSS_<name>.sql. Create migrations with npm run db:new.`,
      )
      continue
    }

    if (latestBase && timestamp <= latestBase.timestamp) {
      errors.push(
        `New migration "${path}" (${timestamp}) must be newer than main's latest migration "${latestBase.path}" (${latestBase.timestamp}) (D-066). Rename it to a newer timestamp before merging.`,
      )
    }

    const existingAdded = seenAdded.get(timestamp)
    if (existingAdded) {
      errors.push(
        `New migration "${path}" reuses timestamp ${timestamp}, already added by "${existingAdded}". Give each migration a unique timestamp.`,
      )
    } else {
      seenAdded.set(timestamp, path)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    latestBase,
    addedCount,
  }
}

/**
 * Runs git and returns trimmed stdout.
 * @param {string[]} args
 * @returns {string}
 */
function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * CLI entrypoint.
 * @param {string} baseRef
 */
function main(baseRef) {
  try {
    runGit(['rev-parse', '--verify', `${baseRef}^{commit}`])
  } catch {
    console.error(
      `Base ref "${baseRef}" was not found locally. Run "git fetch origin main" and try again.`,
    )
    process.exit(1)
  }

  const baseTreeOut = runGit([
    'ls-tree',
    '-r',
    '--name-only',
    baseRef,
    '--',
    'supabase/migrations',
  ])
  const baseFiles = baseTreeOut
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const diffOut = runGit([
    'diff',
    '--name-status',
    '--no-renames',
    `${baseRef}...HEAD`,
    '--',
    'supabase/migrations',
  ])
  const diffEntries = parseNameStatusOutput(diffOut)

  if (diffEntries.length === 0) {
    console.log(`No migration changes against ${baseRef}.`)
    return
  }

  const result = validateMigrationChanges(baseFiles, diffEntries)
  if (!result.ok) {
    for (const message of result.errors) {
      console.error(`::error::${message}`)
    }
    process.exit(1)
  }

  const latestLabel = result.latestBase
    ? `after ${result.latestBase.timestamp}`
    : 'on empty history'
  console.log(
    `Migration check passed: ${result.addedCount} new migration(s) in order (${latestLabel}).`,
  )
}

const invokedPath = process.argv[1]
if (invokedPath && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  main(process.argv[2] ?? 'origin/main')
}
