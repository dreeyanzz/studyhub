#!/usr/bin/env node

// Creates a story's TSK sub-issues and configures their GitHub Project 4 board
// cards from Section 5 and Section 6 of a merged design doc in docs/design/.
//
// Enforces the design gate (D-016): without --dry-run, the design document must
// already exist on main. Safe to re-run: existing TSK issues are matched by ID,
// attached if needed, and only missing board fields (or cards still sitting in
// Product Backlog) are updated.
//
// Needs GitHub CLI (`gh`) logged in with the `project` scope:
//   npm run tasks:create -- docs/design/STORY-12-host-occupancy.md --dry-run
//   npm run tasks:create -- docs/design/STORY-12-host-occupancy.md

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_REPO = 'dreeyanzz/studyhub'
export const PROJECT_ID = 'PVT_kwHOCUJgA84Bjmvk'
export const PROJECT_NUMBER = 4
export const PROJECT_OWNER = 'dreeyanzz'
export const DEFAULT_MILESTONE = 'Sprint 2 (Prefinal)'

export const FIELD_STATUS = 'PVTSSF_lAHOCUJgA84BjmvkzhiabXo'
// Renamed in place across sprints ("Sprint 2 Backlog" -> "Sprint 3 Backlog")
// so its option ID stays constant (docs/guides/board-guide.md, D-038).
export const OPTION_STATUS_SPRINT_BACKLOG = '84205269'

export const FIELD_POINTS = 'PVTF_lAHOCUJgA84BjmvkzhiabcA'
export const FIELD_ESTIMATE = 'PVTF_lAHOCUJgA84BjmvkzhiabcE'
export const FIELD_MOSCOW = 'PVTSSF_lAHOCUJgA84BjmvkzhiabdA'
export const FIELD_SPRINT = 'PVTIF_lAHOCUJgA84BjmvkzhiabdE'

export const MOSCOW_CONFIG = {
  must: { label: 'moscow:must', optionId: '3eed1178', display: 'Must' },
  should: { label: 'moscow:should', optionId: '8fda412d', display: 'Should' },
  could: { label: 'moscow:could', optionId: 'cb02434e', display: 'Could' },
  wont: { label: 'moscow:wont', optionId: '45aa925b', display: "Won't" },
}

export const SPRINT_ITERATIONS = {
  1: 'ab8798f2',
  2: '4cfb2471',
  3: '4573e4ab',
}

export const VALID_AREAS = new Set([
  'db',
  'auth',
  'ui',
  'seeker',
  'host',
  'admin',
  'payments',
  'ci',
  'docs',
])

const TEAM_ALIASES = new Map([
  ['adrian', 'dreeyanzz'],
  ['adrian seth tabotabo', 'dreeyanzz'],
  ['maria', 'fayeye-09'],
  ['maria faith antigua', 'fayeye-09'],
  ['luke', 'lukedongque'],
  ['luke miguel dongque', 'lukedongque'],
  ['james', 'JamesNino-Mandawe'],
  ['james nino mandawe', 'JamesNino-Mandawe'],
  ['james niño mandawe', 'JamesNino-Mandawe'],
])

const COMMIT_TYPES_PATTERN =
  /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\([^)]+\):\s*(.+)$/

const NO_DEPENDENCY_VALUES = new Set(['', '-', '–', '—', 'none', 'n/a'])

const USAGE = 'Usage: npm run tasks:create -- <path-to-design-doc> [--dry-run]'

export function parseCliArgs(argv) {
  let isDryRun = false
  let help = false
  const positionals = []

  for (const arg of argv) {
    if (arg === '--dry-run') {
      isDryRun = true
    } else if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag "${arg}". ${USAGE}`)
    } else {
      positionals.push(arg)
    }
  }

  if (help) {
    return { help: true, isDryRun, fileArg: null }
  }

  if (positionals.length === 0) {
    throw new Error(`Missing design document path. ${USAGE}`)
  }

  if (positionals.length > 1) {
    throw new Error(
      `Expected one design document path, received ${positionals.length}. ${USAGE}`,
    )
  }

  return { help: false, isDryRun, fileArg: positionals[0] }
}

export function splitMarkdownTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null

  let inner = trimmed.slice(1)
  if (inner.endsWith('|') && !inner.endsWith('\\|')) {
    inner = inner.slice(0, -1)
  }

  const cells = []
  let current = ''
  let backtickLen = 0

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]

    if (
      ch === '\\' &&
      backtickLen === 0 &&
      i + 1 < inner.length &&
      inner[i + 1] === '|'
    ) {
      current += '|'
      i++
      continue
    }

    if (ch === '`') {
      let run = 1
      while (i + run < inner.length && inner[i + run] === '`') {
        run++
      }
      current += '`'.repeat(run)
      i += run - 1
      if (backtickLen === 0) {
        backtickLen = run
      } else if (backtickLen === run) {
        backtickLen = 0
      }
      continue
    }

    if (ch === '|' && backtickLen === 0) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))
}

function stripInlineFormatting(text) {
  return text.replace(/^[*`\s]+|[*`\s]+$/g, '').trim()
}

export function resolveAssignee(rawOwner, taskId = 'task') {
  const cleaned = stripInlineFormatting(rawOwner ?? '').replace(/^@/, '')
  if (!cleaned) {
    throw new Error(`Task ${taskId} has an empty "Owner" cell in Section 5.`)
  }

  const lower = cleaned.toLowerCase()
  if (lower === 'handle') {
    throw new Error(`Task ${taskId} still uses template placeholder "@handle" as Owner.`)
  }

  const alias = TEAM_ALIASES.get(lower)
  if (alias) return alias

  if (cleaned === 'me') return '@me'

  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(cleaned)) {
    throw new Error(
      `Task ${taskId} has an invalid GitHub handle "${rawOwner}" in Section 5.`,
    )
  }

  return cleaned
}

function normalizeArea(rawArea, taskId) {
  const cleaned = stripInlineFormatting(rawArea)
    .toLowerCase()
    .replace(/^area:/, '')
  if (!VALID_AREAS.has(cleaned)) {
    throw new Error(
      `Task ${taskId} has unknown area "${rawArea}" (expected one of: ${Array.from(VALID_AREAS).join(', ')}).`,
    )
  }
  return cleaned
}

function normalizeMoscow(rawMoscow, taskId) {
  const cleaned = stripInlineFormatting(rawMoscow)
    .toLowerCase()
    .replace(/^moscow:/, '')
    .replace(/['’]/g, '')
  const key = cleaned === 'wont have' ? 'wont' : cleaned
  if (!Object.hasOwn(MOSCOW_CONFIG, key)) {
    throw new Error(
      `Task ${taskId} has unknown MoSCoW priority "${rawMoscow}" (expected Must, Should, Could, or Won't).`,
    )
  }
  return key
}

function parseCompletionCriteria(s5Text) {
  const criteria = new Map()
  let currentTaskId = null
  let sawBulletForCurrent = false

  for (const rawLine of s5Text.split('\n')) {
    const trimmed = rawLine.trim()

    if (!trimmed.startsWith('|')) {
      const headingMatch = trimmed.match(
        /^(?:#{3,4}\s+|\*\*)?(TSK-\d+\.\d+)\b[^|\n]*?(?:is\s+)?done\s+when[:*\s]*$/i,
      )
      if (headingMatch) {
        currentTaskId = headingMatch[1].toUpperCase()
        sawBulletForCurrent = false
        if (!criteria.has(currentTaskId)) {
          criteria.set(currentTaskId, [])
        }
        continue
      }
    }

    if (!currentTaskId) continue

    if (trimmed === '') {
      if (sawBulletForCurrent) {
        currentTaskId = null
      }
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(?:\[[ xX]\]\s+)?(.+)$/)
    if (bulletMatch) {
      criteria.get(currentTaskId).push(bulletMatch[1].trim())
      sawBulletForCurrent = true
      continue
    }

    if (sawBulletForCurrent && /^\s{2,}\S/.test(rawLine)) {
      const items = criteria.get(currentTaskId)
      items[items.length - 1] = `${items[items.length - 1]} ${trimmed}`
      continue
    }

    currentTaskId = null
  }

  return criteria
}

function parseMarkdownTables(sectionText) {
  const tables = []
  let currentTable = null

  for (const line of sectionText.split('\n')) {
    const cells = splitMarkdownTableRow(line)
    if (!cells) {
      if (currentTable) {
        tables.push(currentTable)
        currentTable = null
      }
      continue
    }

    if (!currentTable) {
      currentTable = { headers: cells, rows: [] }
      continue
    }

    if (currentTable.rows.length === 0 && isSeparatorRow(cells)) {
      continue
    }

    currentTable.rows.push(cells)
  }

  if (currentTable) {
    tables.push(currentTable)
  }

  return tables
}

export function parseDesignMarkdown(rawContent) {
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error('Design document is empty.')
  }

  const content = rawContent.replace(/\r\n/g, '\n')

  const storyHeadingMatch = content.match(/^#\s+(STORY-(\d+))\b(?:\s*:\s*(.+))?$/im)
  if (!storyHeadingMatch) {
    throw new Error(
      'Could not find a concrete "# STORY-NN: <title>" heading in design document.',
    )
  }
  const storyCode = storyHeadingMatch[1].toUpperCase()
  const storyNumDigits = parseInt(storyHeadingMatch[2], 10)
  const storyTitle = (storyHeadingMatch[3] ?? '').trim()

  const storyIssueMatch = content.match(/\*\*Story:\*\*\s*(?:\[\s*)?#(\d+)\b/)
  if (!storyIssueMatch || parseInt(storyIssueMatch[1], 10) <= 0) {
    throw new Error('Could not find "**Story:** #<number>" in design document header.')
  }
  const storyNumber = storyIssueMatch[1]

  const s5Match = content.match(/(?:^|\n)## 5\.[^\n]*\n([\s\S]*?)(?=\n## \d+\.|$)/)
  if (!s5Match) {
    throw new Error(
      'Could not find Section 5 ("## 5. Tasks and estimates") in design document.',
    )
  }
  const s5Text = s5Match[1]

  const s5Tables = parseMarkdownTables(s5Text)
  const taskTable = s5Tables.find((t) =>
    t.headers.some((h) => stripInlineFormatting(h).toLowerCase() === 'task'),
  )
  if (!taskTable) {
    throw new Error('Could not find a task table in Section 5.')
  }

  const lowerHeaders = taskTable.headers.map((h) =>
    stripInlineFormatting(h).toLowerCase(),
  )
  const findCol = (predicate, fallback) => {
    const idx = lowerHeaders.findIndex(predicate)
    return idx !== -1 ? idx : fallback
  }

  const colIdx = {
    task: findCol((h) => h === 'task', 0),
    what: findCol((h) => h === 'what', 1),
    owner: findCol((h) => h === 'owner' || h === 'assignee', 2),
    points: findCol((h) => h.startsWith('points'), 3),
    days: findCol((h) => h.startsWith('days') || h.startsWith('estimate'), 4),
    dependsOn: findCol((h) => h.startsWith('depends'), 5),
    area: findCol((h) => h === 'area', -1),
    moscow: findCol((h) => h === 'moscow', -1),
  }

  const seenTaskIds = new Set()
  const taskRows = []

  for (const cols of taskTable.rows) {
    const rawTask = stripInlineFormatting(cols[colIdx.task] ?? '')
    if (!rawTask) continue

    const idMatch = rawTask.match(/^TSK-(\d+)\.(\d+)$/i)
    if (!idMatch) {
      throw new Error(`Invalid task ID "${rawTask}" in Section 5 (expected TSK-NN.M).`)
    }

    const taskId = `TSK-${idMatch[1]}.${idMatch[2]}`
    const taskStoryNum = parseInt(idMatch[1], 10)
    if (taskStoryNum !== storyNumDigits) {
      throw new Error(
        `Task ID "${taskId}" in Section 5 does not match document story ${storyCode}.`,
      )
    }

    if (seenTaskIds.has(taskId)) {
      throw new Error(`Duplicate task ID "${taskId}" in Section 5.`)
    }
    seenTaskIds.add(taskId)

    const what = (cols[colIdx.what] ?? '').trim()
    if (!what) {
      throw new Error(`Task ${taskId} has an empty "What" description.`)
    }

    const owner = resolveAssignee(cols[colIdx.owner] ?? '', taskId)

    const pointsRaw = stripInlineFormatting(cols[colIdx.points] ?? '')
    if (!/^\d+$/.test(pointsRaw)) {
      throw new Error(
        `Task ${taskId} has invalid story points "${pointsRaw}" (expected integer 1–10).`,
      )
    }
    const points = parseInt(pointsRaw, 10)
    if (points < 1 || points > 10) {
      throw new Error(`Task ${taskId} story points ${points} must be between 1 and 10.`)
    }

    const daysRaw = stripInlineFormatting(cols[colIdx.days] ?? '')
    if (!/^\d+(?:\.\d+)?$/.test(daysRaw)) {
      throw new Error(
        `Task ${taskId} has invalid day estimate "${daysRaw}" (expected positive number).`,
      )
    }
    const days = parseFloat(daysRaw)
    if (!(days > 0)) {
      throw new Error(`Task ${taskId} day estimate ${daysRaw} must be greater than 0.`)
    }

    const rawDepends = (cols[colIdx.dependsOn] ?? '').trim()
    const dependsOn = NO_DEPENDENCY_VALUES.has(
      stripInlineFormatting(rawDepends).toLowerCase(),
    )
      ? null
      : rawDepends

    const rawArea = colIdx.area !== -1 ? (cols[colIdx.area] ?? '').trim() : ''
    const explicitArea = rawArea ? normalizeArea(rawArea, taskId) : null

    const rawMoscow = colIdx.moscow !== -1 ? (cols[colIdx.moscow] ?? '').trim() : ''
    const explicitMoscow = rawMoscow ? normalizeMoscow(rawMoscow, taskId) : null

    taskRows.push({
      taskId,
      what,
      owner,
      points,
      days,
      dependsOn,
      explicitArea,
      explicitMoscow,
    })
  }

  if (taskRows.length === 0) {
    throw new Error('Found zero TSK rows in Section 5.')
  }

  const completionCriteria = parseCompletionCriteria(s5Text)

  const s6Match = content.match(/(?:^|\n)## 6\.[^\n]*\n([\s\S]*?)(?=\n## \d+\.|$)/)
  const buildOrderRows = []
  if (s6Match) {
    const s6Tables = parseMarkdownTables(s6Match[1])
    const buildTable = s6Tables.find((t) =>
      t.headers.some((h) => stripInlineFormatting(h).toLowerCase().includes('branch')),
    )
    if (buildTable) {
      for (const cols of buildTable.rows) {
        if (cols.length < 3) continue
        const step = stripInlineFormatting(cols[0] ?? '')
        const branch = stripInlineFormatting(cols[1] ?? '')
        const prTitle = stripInlineFormatting(cols[2] ?? '')
        const contains = (cols[3] ?? '').trim()
        const rowJoin = cols.join(' ')
        const mentionedTaskIds = Array.from(
          new Set(
            (rowJoin.match(/\bTSK-\d+\.\d+\b/gi) ?? []).map((id) => id.toUpperCase()),
          ),
        )
        buildOrderRows.push({
          step,
          branch,
          prTitle,
          contains,
          mentionedTaskIds,
        })
      }
    }
  }

  return {
    storyCode,
    storyNumber,
    storyTitle,
    tasks: taskRows,
    buildOrderRows,
    completionCriteria,
  }
}

export function inferDefaultAreaFromTitle(storyTitle = '') {
  const lower = storyTitle.toLowerCase()
  if (/\b(?:database|rls|row-level security|schema|migration)\b/.test(lower)) {
    return 'db'
  }
  if (/\b(?:auth|authentication|rbac|login|route guard)\b/.test(lower)) {
    return 'auth'
  }
  if (/\b(?:payment|payments|paymongo|sandbox)\b/.test(lower)) {
    return 'payments'
  }
  if (/\b(?:admin|administration|verification|moderation)\b/.test(lower)) {
    return 'admin'
  }
  if (/\b(?:host|occupancy|seat map)\b/.test(lower)) {
    return 'host'
  }
  if (/\b(?:seeker|discovery|filter|filters)\b/.test(lower)) {
    return 'seeker'
  }
  if (/\b(?:testing|qa|playwright|ci)\b/.test(lower)) {
    return 'ci'
  }
  return 'ui'
}

export function inferTaskArea(task, buildInfo, defaultArea) {
  if (task.explicitArea) return task.explicitArea

  const combined = [task.what, buildInfo?.prTitle ?? '', buildInfo?.contains ?? '']
    .join(' ')
    .toLowerCase()

  // Check if the task specifically owns SQL, migrations, RLS, pgTAP or db:types.
  // Note: Server Action tasks often say "calling set_unit_state", so only treat
  // `public.<fn>` or schema artifacts as `db` when not a Server Action / UI task,
  // or when pgTAP / migration / RLS / db:types is explicitly part of the task.
  if (
    /\b(?:pgtap|db:types|db:test|migration|migrations|row-level security|rls)\b/.test(
      combined,
    ) ||
    /\bsupabase\/(?:migrations|tests)\b/.test(combined) ||
    (/\bpublic\.[a-z_]+\b/.test(combined) && !/\bserver action\b/.test(combined))
  ) {
    return 'db'
  }

  if (
    /\b(?:playwright|test:e2e|dod verification)\b/.test(combined) ||
    /\be2e\//.test(combined) ||
    /\.github\/workflows\b/.test(combined) ||
    /\bsprint\s+\d+\s+qa\b/.test(combined)
  ) {
    return 'ci'
  }

  return defaultArea
}

function ensurePeriod(sentence) {
  const trimmed = sentence.trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function buildDefaultDoneWhen(task, buildInfo, area, storyCode, designFileName) {
  const items = [task.what.replace(/\.$/, '').trim()]

  if (buildInfo?.contains) {
    const cleanedContains = buildInfo.contains
      .replace(new RegExp(`^${task.taskId}\\s*[:.-]?\\s*`, 'i'), '')
      .replace(new RegExp(`\\(${task.taskId}\\)`, 'gi'), '')
      .trim()
    if (cleanedContains && cleanedContains.toUpperCase() !== task.taskId.toUpperCase()) {
      items.push(`Scope matches design §6 (${cleanedContains.replace(/\.$/, '')})`)
    }
  }

  const docRef = designFileName
    ? `${storyCode} design (\`${designFileName}\` §4)`
    : `${storyCode} design §4`
  items.push(`Tests and checks in ${docRef} pass, including \`npm run check\``)

  const lowerWhat = task.what.toLowerCase()
  if (area === 'db' || /\b(?:pgtap|db:test|rls|migration)\b/.test(lowerWhat)) {
    items.push('`npm run db:test` passes (including negative tests)')
  }
  if (/\bdb:types\b/.test(lowerWhat)) {
    items.push('`npm run db:types` regenerated and committed')
  }
  if (/\b(?:playwright|e2e|test:e2e)\b/.test(lowerWhat)) {
    items.push('`npm run test:e2e` passes against the seeded local stack')
  }

  return items
}

export function deriveTasks(parsedDoc, options = {}) {
  const {
    storyCode,
    storyNumber,
    storyTitle,
    tasks,
    buildOrderRows,
    completionCriteria,
  } = parsedDoc

  const defaultArea =
    options.defaultArea && VALID_AREAS.has(options.defaultArea)
      ? options.defaultArea
      : inferDefaultAreaFromTitle(storyTitle)

  const defaultMoscow =
    options.defaultMoscow && Object.hasOwn(MOSCOW_CONFIG, options.defaultMoscow)
      ? options.defaultMoscow
      : 'must'

  const designFileName = options.designFileName ?? null

  const anyRowMentionsTaskId = buildOrderRows.some((r) => r.mentionedTaskIds.length > 0)

  return tasks.map((task, idx) => {
    let buildInfo = null
    if (anyRowMentionsTaskId) {
      buildInfo =
        buildOrderRows.find((r) => r.mentionedTaskIds.includes(task.taskId)) ?? null
    } else if (buildOrderRows.length === tasks.length) {
      buildInfo = buildOrderRows[idx] ?? null
    }

    let summary = task.what.replace(/\.$/, '').trim()
    if (buildInfo?.prTitle && buildInfo.mentionedTaskIds.length <= 1) {
      const match = buildInfo.prTitle.match(COMMIT_TYPES_PATTERN)
      if (match) {
        summary = match[1].trim()
      }
    }

    const title = `${task.taskId}: ${summary}`
    const area = inferTaskArea(task, buildInfo, defaultArea)

    let moscowKey = task.explicitMoscow ?? defaultMoscow
    if (
      !task.explicitMoscow &&
      defaultMoscow === 'must' &&
      area === 'ci' &&
      defaultArea !== 'ci'
    ) {
      moscowKey = 'should'
    }
    const moscow = MOSCOW_CONFIG[moscowKey]

    const explicitDoneWhen = completionCriteria?.get(task.taskId)
    const doneWhenItems =
      explicitDoneWhen && explicitDoneWhen.length > 0
        ? explicitDoneWhen
        : buildDefaultDoneWhen(task, buildInfo, area, storyCode, designFileName)

    const doneWhenText = doneWhenItems.map((item) => `- [ ] ${item}`).join('\n')

    const branchInfo = buildInfo?.branch
      ? `Branch \`${buildInfo.branch}\` (design §6${buildInfo.step ? `, row ${buildInfo.step}` : ''}).`
      : ''
    const depInfo = task.dependsOn
      ? ensurePeriod(`Depends on ${task.dependsOn}`)
      : 'No dependencies.'

    const whatParagraph = [ensurePeriod(task.what), branchInfo, depInfo]
      .filter(Boolean)
      .join(' ')

    const body = `### Parent story

#${storyNumber}

### What

${whatParagraph}

### Done when

${doneWhenText}

### Story points (1–10)

${task.points}

### Estimate (working days)

${task.days}

### Area

${area}
`

    return {
      ...task,
      title,
      area,
      moscowKey,
      moscowLabel: moscow.label,
      moscowOptionId: moscow.optionId,
      moscowDisplay: moscow.display,
      buildInfo,
      body,
    }
  })
}

export function extractLeadingTaskId(issueTitle) {
  if (typeof issueTitle !== 'string') return null
  const match = issueTitle.trim().match(/^(TSK-\d+\.\d+)(?=$|[:\s—–-])/i)
  return match ? match[1].toUpperCase() : null
}

function defaultRunGh(args, options = {}) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    }).trim()
  } catch (err) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String(err.stderr ?? '').trim()
        : ''
    if (/project|INSUFFICIENT_SCOPES|read:project/i.test(stderr)) {
      throw new Error(
        `GitHub CLI failed (check that the "project" scope is enabled via "gh auth refresh -s project"): ${stderr}`,
        { cause: err },
      )
    }
    const detail = stderr || (err instanceof Error ? err.message : String(err))
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${detail}`, {
      cause: err,
    })
  }
}

function defaultIsMergedOnMain(filePath) {
  const canonicalPath = existsSync(filePath)
    ? realpathSync.native(filePath)
    : resolve(filePath)
  const cwd = dirname(canonicalPath)

  let repoRoot
  try {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return false
  }

  const canonicalRoot = existsSync(repoRoot)
    ? realpathSync.native(repoRoot)
    : resolve(repoRoot)
  const relPath = relative(canonicalRoot, canonicalPath).replaceAll('\\', '/')
  if (!relPath || relPath.startsWith('..')) {
    return false
  }

  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['cat-file', '-e', `${ref}:${relPath}`], {
        cwd: canonicalRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return true
    } catch {
      // Try next ref.
    }
  }

  return false
}

export function resolveSprintIterationId(storyProjectItem, milestoneTitle) {
  if (storyProjectItem?.sprint?.iterationId) {
    return storyProjectItem.sprint.iterationId
  }
  if (typeof milestoneTitle === 'string') {
    const match = milestoneTitle.match(/\bSprint\s+(\d+)\b/i)
    if (match) {
      const sprintNum = parseInt(match[1], 10)
      if (Object.hasOwn(SPRINT_ITERATIONS, sprintNum)) {
        return SPRINT_ITERATIONS[sprintNum]
      }
    }
  }
  return SPRINT_ITERATIONS[2]
}

export function selectDefaultAreaFromLabels(labelNames, storyTitle = '') {
  const areas = labelNames
    .filter((l) => typeof l === 'string' && l.startsWith('area:'))
    .map((l) => l.slice('area:'.length))
    .filter((a) => VALID_AREAS.has(a))

  if (areas.length === 0) return null
  if (areas.length === 1) return areas[0]

  const titleArea = inferDefaultAreaFromTitle(storyTitle)
  if (areas.includes(titleArea)) return titleArea

  return areas.find((a) => a !== 'db' && a !== 'ci') ?? areas[0]
}

function fetchStoryContext({ storyNumber, storyCode, repo, runGh }) {
  const storyJson = JSON.parse(runGh(['api', `repos/${repo}/issues/${storyNumber}`]))

  const labelNames = Array.isArray(storyJson.labels)
    ? storyJson.labels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
    : []

  const defaultArea = selectDefaultAreaFromLabels(labelNames, storyJson.title ?? '')

  const moscowLabel = labelNames.find((l) => l.startsWith('moscow:'))
  const rawMoscowKey = moscowLabel ? moscowLabel.slice('moscow:'.length) : null
  const defaultMoscow =
    rawMoscowKey && Object.hasOwn(MOSCOW_CONFIG, rawMoscowKey) ? rawMoscowKey : null

  const hasNeedsDesign = labelNames.includes('needs-design')
  const milestoneTitle = storyJson.milestone?.title ?? DEFAULT_MILESTONE

  const subIssuesJson = JSON.parse(
    runGh(['api', `repos/${repo}/issues/${storyNumber}/sub_issues?per_page=100`]),
  )

  const attachedSubIssueNumbers = new Set()
  const existingIssuesByTaskId = new Map()

  for (const sub of Array.isArray(subIssuesJson) ? subIssuesJson : []) {
    if (typeof sub?.number !== 'number') continue
    attachedSubIssueNumbers.add(sub.number)
    const taskId = extractLeadingTaskId(sub.title)
    if (taskId) {
      existingIssuesByTaskId.set(taskId, {
        number: sub.number,
        id: sub.id ?? null,
        url: sub.html_url ?? `https://github.com/${repo}/issues/${sub.number}`,
        state: sub.state ?? 'open',
        attached: true,
      })
    }
  }

  // Also search repository issues by TSK-NN. prefix so an issue created right
  // before an interrupted run is recovered and attached rather than duplicated.
  const storyDigitsMatch = storyCode.match(/\d+/)
  const taskPrefix = storyDigitsMatch ? `TSK-${storyDigitsMatch[0]}.` : 'TSK-'
  const repoSearchJson = JSON.parse(
    runGh([
      'issue',
      'list',
      '-R',
      repo,
      '--search',
      `"${taskPrefix}" in:title`,
      '--state',
      'all',
      '--limit',
      '100',
      '--json',
      'number,title,url,state',
    ]),
  )

  for (const issue of Array.isArray(repoSearchJson) ? repoSearchJson : []) {
    if (typeof issue?.number !== 'number') continue
    const taskId = extractLeadingTaskId(issue.title)
    if (!taskId) continue
    const existing = existingIssuesByTaskId.get(taskId)
    if (existing?.attached) continue
    if (existing && existing.state === 'open' && issue.state !== 'open') {
      continue
    }
    existingIssuesByTaskId.set(taskId, {
      number: issue.number,
      id: null,
      url: issue.url ?? `https://github.com/${repo}/issues/${issue.number}`,
      state: issue.state ?? 'open',
      attached: attachedSubIssueNumbers.has(issue.number),
    })
  }

  const projectListJson = JSON.parse(
    runGh([
      'project',
      'item-list',
      String(PROJECT_NUMBER),
      '--owner',
      PROJECT_OWNER,
      '--limit',
      '500',
      '--format',
      'json',
    ]),
  )

  const projectItemsByIssueNumber = new Map()
  for (const item of Array.isArray(projectListJson?.items) ? projectListJson.items : []) {
    const num = item?.content?.number
    if (typeof num === 'number') {
      projectItemsByIssueNumber.set(num, item)
    }
  }

  const storyProjectItem =
    projectItemsByIssueNumber.get(parseInt(storyNumber, 10)) ?? null
  const sprintIterationId = resolveSprintIterationId(storyProjectItem, milestoneTitle)

  return {
    defaultArea,
    defaultMoscow,
    hasNeedsDesign,
    milestoneTitle,
    sprintIterationId,
    attachedSubIssueNumbers,
    existingIssuesByTaskId,
    projectItemsByIssueNumber,
  }
}

export function syncStoryTasks(filePath, options = {}) {
  const {
    isDryRun = false,
    repo = DEFAULT_REPO,
    runGh = defaultRunGh,
    isMergedOnMain = defaultIsMergedOnMain,
    logger = console,
  } = options

  const resolvedPath = resolve(filePath)
  if (!existsSync(resolvedPath)) {
    throw new Error(`Design document not found: ${resolvedPath}`)
  }

  const rawContent = readFileSync(resolvedPath, 'utf-8')
  const parsed = parseDesignMarkdown(rawContent)
  const designFileName = basename(resolvedPath)

  if (!isDryRun && !isMergedOnMain(resolvedPath)) {
    throw new Error(
      `Refusing to create GitHub issues because "${designFileName}" is not merged on main yet (D-016). Merge the design PR and run "git pull" first, or pass --dry-run to preview.`,
    )
  }

  let context = null
  if (isDryRun) {
    try {
      context = fetchStoryContext({
        storyNumber: parsed.storyNumber,
        storyCode: parsed.storyCode,
        repo,
        runGh,
      })
    } catch {
      logger.log(
        `(Offline preview: could not query GitHub for #${parsed.storyNumber}; using document defaults.)`,
      )
    }
  } else {
    context = fetchStoryContext({
      storyNumber: parsed.storyNumber,
      storyCode: parsed.storyCode,
      repo,
      runGh,
    })
  }

  const tasksWithDetails = deriveTasks(parsed, {
    defaultArea: context?.defaultArea ?? undefined,
    defaultMoscow: context?.defaultMoscow ?? undefined,
    designFileName,
  })

  const milestoneTitle = context?.milestoneTitle ?? DEFAULT_MILESTONE
  const sprintIterationId = context?.sprintIterationId ?? SPRINT_ITERATIONS[2]

  logger.log(
    `Story: ${parsed.storyCode} (#${parsed.storyNumber}) — ${tasksWithDetails.length} tasks in §5 (Milestone: ${milestoneTitle})`,
  )

  if (isDryRun) {
    logger.log('\n=== DRY RUN PREVIEW ===')
    for (const t of tasksWithDetails) {
      const existing = context?.existingIssuesByTaskId.get(t.taskId)
      const statusTag = existing ? `exists as #${existing.number}` : 'new'
      logger.log(`\n[${t.taskId}] (${statusTag}) ${t.title}`)
      logger.log(
        `  Assignee: @${t.owner.replace(/^@/, '')} | Area: ${t.area} | MoSCoW: ${t.moscowLabel} | Pts: ${t.points} | Days: ${t.days}`,
      )
      logger.log(
        `  Body:\n${t.body
          .trimEnd()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}`,
      )
    }
    return {
      dryRun: true,
      storyCode: parsed.storyCode,
      storyNumber: parsed.storyNumber,
      tasks: tasksWithDetails,
      createdIssues: [],
      reusedIssues: [],
    }
  }

  const createdIssues = []
  const reusedIssues = []

  for (const t of tasksWithDetails) {
    logger.log(`\n------------------------------------------------------------`)
    const existing = context.existingIssuesByTaskId.get(t.taskId)
    let issueNum
    let issueUrl
    let issueDatabaseId = existing?.id ?? null

    if (existing) {
      issueNum = existing.number
      issueUrl = existing.url
      reusedIssues.push(issueNum)
      logger.log(
        `Found existing issue #${issueNum} for ${t.taskId} (${issueUrl}); skipping issue creation.`,
      )
    } else {
      logger.log(`Creating issue: ${t.title}`)
      const createArgs = [
        'issue',
        'create',
        '-R',
        repo,
        '--title',
        t.title,
        '--label',
        'type:task',
        '--label',
        `area:${t.area}`,
        '--label',
        t.moscowLabel,
      ]
      if (milestoneTitle) {
        createArgs.push('--milestone', milestoneTitle)
      }
      createArgs.push('--assignee', t.owner, '--body-file', '-')

      issueUrl = runGh(createArgs, { input: t.body })
      const issueNumberMatch = issueUrl.match(/\/issues\/(\d+)\s*$/)
      if (!issueNumberMatch) {
        throw new Error(`Failed to parse issue number from URL: ${issueUrl}`)
      }
      issueNum = parseInt(issueNumberMatch[1], 10)
      createdIssues.push(issueNum)
      logger.log(`Created #${issueNum}: ${issueUrl}`)
    }

    if (!context.attachedSubIssueNumbers.has(issueNum)) {
      if (!issueDatabaseId) {
        issueDatabaseId = runGh([
          'api',
          `repos/${repo}/issues/${issueNum}`,
          '--jq',
          '.id',
        ])
      }
      logger.log(`Attaching #${issueNum} as sub-issue of story #${parsed.storyNumber}...`)
      runGh([
        'api',
        '-X',
        'POST',
        `repos/${repo}/issues/${parsed.storyNumber}/sub_issues`,
        '-F',
        `sub_issue_id=${issueDatabaseId}`,
      ])
      context.attachedSubIssueNumbers.add(issueNum)
    }

    let existingCard = context.projectItemsByIssueNumber.get(issueNum) ?? null
    let itemId = existingCard?.id ?? null

    if (!itemId) {
      logger.log(`Ensuring #${issueNum} is on Project ${PROJECT_NUMBER}...`)
      try {
        const addResult = runGh([
          'project',
          'item-add',
          String(PROJECT_NUMBER),
          '--owner',
          PROJECT_OWNER,
          '--url',
          issueUrl,
          '--format',
          'json',
        ])
        itemId = JSON.parse(addResult).id
      } catch {
        const listResult = runGh([
          'project',
          'item-list',
          String(PROJECT_NUMBER),
          '--owner',
          PROJECT_OWNER,
          '--limit',
          '500',
          '--format',
          'json',
        ])
        const found = (JSON.parse(listResult).items ?? []).find(
          (i) => i?.content?.number === issueNum,
        )
        if (!found) {
          throw new Error(
            `Could not find Project ${PROJECT_NUMBER} item ID for issue #${issueNum}.`,
          )
        }
        existingCard = found
        itemId = found.id
      }
    }

    // Preserve Status if the card has already moved past Product Backlog.
    if (!existingCard?.status || existingCard.status === 'Product Backlog') {
      runGh([
        'project',
        'item-edit',
        '--project-id',
        PROJECT_ID,
        '--id',
        itemId,
        '--field-id',
        FIELD_STATUS,
        '--single-select-option-id',
        OPTION_STATUS_SPRINT_BACKLOG,
      ])
    }

    if (existingCard?.points !== t.points) {
      runGh([
        'project',
        'item-edit',
        '--project-id',
        PROJECT_ID,
        '--id',
        itemId,
        '--field-id',
        FIELD_POINTS,
        '--number',
        String(t.points),
      ])
    }

    if (existingCard?.['estimate (days)'] !== t.days) {
      runGh([
        'project',
        'item-edit',
        '--project-id',
        PROJECT_ID,
        '--id',
        itemId,
        '--field-id',
        FIELD_ESTIMATE,
        '--number',
        String(t.days),
      ])
    }

    if (existingCard?.moSCoW !== t.moscowDisplay) {
      runGh([
        'project',
        'item-edit',
        '--project-id',
        PROJECT_ID,
        '--id',
        itemId,
        '--field-id',
        FIELD_MOSCOW,
        '--single-select-option-id',
        t.moscowOptionId,
      ])
    }

    if (existingCard?.sprint?.iterationId !== sprintIterationId) {
      runGh([
        'project',
        'item-edit',
        '--project-id',
        PROJECT_ID,
        '--id',
        itemId,
        '--field-id',
        FIELD_SPRINT,
        '--iteration-id',
        sprintIterationId,
      ])
    }

    logger.log(`Project ${PROJECT_NUMBER} card synced (${itemId}).`)
  }

  if (context.hasNeedsDesign) {
    logger.log(
      `\nRemoving "needs-design" label from parent story #${parsed.storyNumber}...`,
    )
    runGh([
      'issue',
      'edit',
      String(parsed.storyNumber),
      '-R',
      repo,
      '--remove-label',
      'needs-design',
    ])
  }

  logger.log(
    `\nDone: ${createdIssues.length} created, ${reusedIssues.length} already existed (${tasksWithDetails.length} total tasks for ${parsed.storyCode}).`,
  )

  return {
    dryRun: false,
    storyCode: parsed.storyCode,
    storyNumber: parsed.storyNumber,
    tasks: tasksWithDetails,
    createdIssues,
    reusedIssues,
  }
}

function main() {
  const { help, isDryRun, fileArg } = parseCliArgs(process.argv.slice(2))
  if (help) {
    console.log(USAGE)
    return
  }
  syncStoryTasks(fileArg, { isDryRun })
}

const isMain =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    main()
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
