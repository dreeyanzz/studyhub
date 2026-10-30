import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deriveTasks,
  extractLeadingTaskId,
  FIELD_ESTIMATE,
  FIELD_MOSCOW,
  FIELD_POINTS,
  FIELD_SPRINT,
  FIELD_STATUS,
  MOSCOW_CONFIG,
  OPTION_STATUS_SPRINT_BACKLOG,
  parseCliArgs,
  parseDesignMarkdown,
  resolveAssignee,
  resolveSprintIterationId,
  selectDefaultAreaFromLabels,
  SPRINT_ITERATIONS,
  splitMarkdownTableRow,
  syncStoryTasks,
} from './create-story-tasks.mjs'

const DESIGN_DIR = resolve(process.cwd(), 'docs/design')

function readDesignDoc(fileName) {
  return readFileSync(join(DESIGN_DIR, fileName), 'utf-8')
}

const tempDirs = []

function writeTempMarkdown(content, fileName = 'STORY-08-map-discovery.md') {
  const dir = mkdtempSync(join(tmpdir(), 'studyhub-tasks-test-'))
  tempDirs.push(dir)
  const filePath = join(dir, fileName)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    rmSync(dir, { recursive: true, force: true })
  }
})

const silentLogger = { log: () => {} }

describe('parseCliArgs', () => {
  it('parses a design doc path with or without --dry-run in any order', () => {
    expect(parseCliArgs(['docs/design/STORY-12-host-occupancy.md'])).toEqual({
      help: false,
      isDryRun: false,
      fileArg: 'docs/design/STORY-12-host-occupancy.md',
    })

    expect(parseCliArgs(['--dry-run', 'docs/design/STORY-12-host-occupancy.md'])).toEqual(
      {
        help: false,
        isDryRun: true,
        fileArg: 'docs/design/STORY-12-host-occupancy.md',
      },
    )
  })

  it('supports --help and -h without requiring a file path', () => {
    expect(parseCliArgs(['--help']).help).toBe(true)
    expect(parseCliArgs(['-h']).help).toBe(true)
  })

  it('rejects missing paths, extra positional arguments, and unknown flags', () => {
    expect(() => parseCliArgs([])).toThrow(/Missing design document path/)
    expect(() => parseCliArgs(['a.md', 'b.md'])).toThrow(
      /Expected one design document path/,
    )
    expect(() => parseCliArgs(['a.md', '--unknown'])).toThrow(/Unknown flag "--unknown"/)
  })
})

describe('splitMarkdownTableRow', () => {
  it('keeps pipes inside inline backtick code spans and escaped pipes', () => {
    const row =
      '| TSK-08.1 | Parse `Result | Error` union \\| fallback | @dreeyanzz | 2 | 0.5 |  |'
    expect(splitMarkdownTableRow(row)).toEqual([
      'TSK-08.1',
      'Parse `Result | Error` union | fallback',
      '@dreeyanzz',
      '2',
      '0.5',
      '',
    ])
  })

  it('handles multi-backtick code spans containing single backticks and pipes', () => {
    const row = '| TSK-08.1 | Check ``a | `b` | c`` | @dreeyanzz | 1 | 0.5 | — |'
    expect(splitMarkdownTableRow(row)).toEqual([
      'TSK-08.1',
      'Check ``a | `b` | c``',
      '@dreeyanzz',
      '1',
      '0.5',
      '—',
    ])
  })

  it('returns null for non-table lines', () => {
    expect(splitMarkdownTableRow('Plain paragraph with | pipe')).toBeNull()
    expect(splitMarkdownTableRow('')).toBeNull()
  })
})

describe('resolveAssignee', () => {
  it('maps team first and full names to GitHub handles', () => {
    expect(resolveAssignee('Adrian')).toBe('dreeyanzz')
    expect(resolveAssignee('Maria Faith Antigua')).toBe('fayeye-09')
    expect(resolveAssignee('Luke')).toBe('lukedongque')
    expect(resolveAssignee('James Niño Mandawe')).toBe('JamesNino-Mandawe')
  })

  it('normalizes @handles and @me while rejecting empty or placeholder owners', () => {
    expect(resolveAssignee('@JamesNino-Mandawe')).toBe('JamesNino-Mandawe')
    expect(resolveAssignee('`@fayeye-09`')).toBe('fayeye-09')
    expect(resolveAssignee('@me')).toBe('@me')
    expect(() => resolveAssignee('', 'TSK-08.1')).toThrow(/empty "Owner"/)
    expect(() => resolveAssignee('@handle', 'TSK-08.1')).toThrow(
      /template placeholder "@handle"/,
    )
    expect(() => resolveAssignee('bad handle!', 'TSK-08.1')).toThrow(
      /invalid GitHub handle/,
    )
  })
})

describe('real merged design documents in docs/design/', () => {
  it('parses STORY-01 with first-name owner, out-of-order §6, and non-PR task TSK-01.4', () => {
    const parsed = parseDesignMarkdown(readDesignDoc('STORY-01-database-rls.md'))
    const tasks = deriveTasks(parsed)

    expect(parsed.storyCode).toBe('STORY-01')
    expect(parsed.storyNumber).toBe('50')
    expect(tasks).toHaveLength(4)
    expect(tasks[0].owner).toBe('dreeyanzz')
    expect(tasks[1].taskId).toBe('TSK-01.2')
    expect(tasks[1].buildInfo?.branch).toBe('feature/STORY-01-spaces')
    expect(tasks[2].taskId).toBe('TSK-01.3')
    expect(tasks[2].buildInfo?.branch).toBe('feature/STORY-01-supabase-clients')
    expect(tasks[3].taskId).toBe('TSK-01.4')
    expect(tasks[3].buildInfo).toBeNull()
  })

  it('parses STORY-02 with markdown-linked story issue [#51](...) and ignores prose follow-up notes', () => {
    const parsed = parseDesignMarkdown(readDesignDoc('STORY-02-design-system.md'))
    const tasks = deriveTasks(parsed, { defaultMoscow: 'should' })

    expect(parsed.storyNumber).toBe('51')
    expect(tasks.map((t) => t.taskId)).toEqual(['TSK-02.1', 'TSK-02.2'])
    expect(tasks[0].moscowLabel).toBe('moscow:should')
  })

  it('parses STORY-03 and normalizes "None" in Depends on to "No dependencies."', () => {
    const parsed = parseDesignMarkdown(readDesignDoc('STORY-03-auth-rbac.md'))
    const tasks = deriveTasks(parsed)

    expect(parsed.storyNumber).toBe('52')
    expect(tasks).toHaveLength(4)
    expect(tasks[0].body).toContain('No dependencies.')
    expect(tasks[0].body).not.toContain('Depends on None')
  })

  it('parses STORY-04 and STORY-05 including STORY-05 explicit "is done when:" checklists', () => {
    const parsed04 = parseDesignMarkdown(readDesignDoc('STORY-04-seeker-profile-crud.md'))
    expect(deriveTasks(parsed04)).toHaveLength(5)

    const parsed05 = parseDesignMarkdown(readDesignDoc('STORY-05-host-space-crud.md'))
    const tasks05 = deriveTasks(parsed05, { defaultArea: 'host' })
    expect(parsed05.storyNumber).toBe('54')
    expect(tasks05).toHaveLength(5)
    expect(tasks05.every((t) => t.area === 'host')).toBe(true)
    expect(tasks05[0].body).toContain(
      '- [ ] all exact §2.3 rules and messages exist in one shared schema;',
    )
    expect(tasks05[4].body).toContain(
      '- [ ] GET is read-only and deletion requires explicit form submission;',
    )
  })

  it('parses STORY-06 with 0.25 day estimate, ci(...) PR title, and non-PR task TSK-06.2', () => {
    const parsed = parseDesignMarkdown(readDesignDoc('STORY-06-testing-qa.md'))
    const tasks = deriveTasks(parsed, {
      defaultArea: 'ci',
      defaultMoscow: 'should',
    })

    expect(tasks).toHaveLength(3)
    expect(tasks[1].taskId).toBe('TSK-06.2')
    expect(tasks[1].days).toBe(0.25)
    expect(tasks[1].buildInfo).toBeNull()
    expect(tasks[2].taskId).toBe('TSK-06.3')
    expect(tasks[2].title).toBe('TSK-06.3: run the smoke test in CI')
  })

  it('parses STORY-12 with bold TSK IDs, positional §6 rows, and db/host/ci areas', () => {
    const parsed = parseDesignMarkdown(readDesignDoc('STORY-12-host-occupancy.md'))
    const tasks = deriveTasks(parsed, {
      defaultArea: 'host',
      defaultMoscow: 'must',
      designFileName: 'STORY-12-host-occupancy.md',
    })

    expect(tasks).toHaveLength(7)
    expect(tasks.map((t) => t.area)).toEqual([
      'db',
      'host',
      'host',
      'db',
      'host',
      'host',
      'ci',
    ])
    expect(tasks.map((t) => t.moscowLabel)).toEqual([
      'moscow:must',
      'moscow:must',
      'moscow:must',
      'moscow:must',
      'moscow:must',
      'moscow:must',
      'moscow:should',
    ])
    expect(tasks[0].title).toBe(
      'TSK-12.1: add set_unit_state function and host-set pgTAP tests',
    )
  })
})

describe('parseDesignMarkdown validation and edge cases', () => {
  it('rejects TEMPLATE.md and empty documents', () => {
    expect(() => parseDesignMarkdown('')).toThrow(/empty/)
    expect(() => parseDesignMarkdown('   \n  ')).toThrow(/empty/)
    expect(() => parseDesignMarkdown(readDesignDoc('TEMPLATE.md'))).toThrow(
      /concrete "# STORY-NN: <title>"/,
    )
  })

  it('normalizes CRLF line endings and supports optional Area and MoSCoW columns', () => {
    const doc = [
      '# STORY-08: Map discovery and curated tag filters',
      '',
      '**Status:** approved 2026-10-30 · **Owner:** @fayeye-09 · **Story:** #57',
      '',
      '## 5. Tasks and estimates',
      '',
      '| Task | What | Owner | Points (1–10) | Days | Depends on | Area | MoSCoW |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TSK-08.1 | Add tag schema | Maria | 3 | 1 |  | ui | Could |',
    ].join('\r\n')

    const parsed = parseDesignMarkdown(doc)
    const tasks = deriveTasks(parsed, { defaultArea: 'seeker' })

    expect(tasks).toHaveLength(1)
    expect(tasks[0].area).toBe('ui')
    expect(tasks[0].moscowLabel).toBe('moscow:could')
    expect(tasks[0].moscowOptionId).toBe(MOSCOW_CONFIG.could.optionId)
    expect(tasks[0].body).toContain('No dependencies.')
  })

  it('rejects mismatched story numbers, duplicate task IDs, and invalid points or days', () => {
    const makeDoc = (row) => `# STORY-07: Snap-grid seat map builder
**Story:** #56
## 5. Tasks and estimates
| Task | What | Owner | Points | Days | Depends on |
| --- | --- | --- | --- | --- | --- |
${row}
`

    expect(() =>
      parseDesignMarkdown(makeDoc('| TSK-05.1 | Wrong story | @fayeye-09 | 2 | 1 | — |')),
    ).toThrow(/does not match document story STORY-07/)

    expect(() =>
      parseDesignMarkdown(
        makeDoc(
          '| TSK-07.1 | First | @fayeye-09 | 2 | 1 | — |\n| TSK-07.1 | Dup | @fayeye-09 | 2 | 1 | — |',
        ),
      ),
    ).toThrow(/Duplicate task ID "TSK-07.1"/)

    expect(() =>
      parseDesignMarkdown(makeDoc('| TSK-07.1 | Zero pts | @fayeye-09 | 0 | 1 | — |')),
    ).toThrow(/between 1 and 10/)

    expect(() =>
      parseDesignMarkdown(makeDoc('| TSK-07.1 | High pts | @fayeye-09 | 11 | 1 | — |')),
    ).toThrow(/between 1 and 10/)

    expect(() =>
      parseDesignMarkdown(makeDoc('| TSK-07.1 | Float pts | @fayeye-09 | 1.5 | 1 | — |')),
    ).toThrow(/invalid story points/)

    expect(() =>
      parseDesignMarkdown(makeDoc('| TSK-07.1 | Zero days | @fayeye-09 | 2 | 0 | — |')),
    ).toThrow(/greater than 0/)

    expect(() =>
      parseDesignMarkdown(
        makeDoc('| TSK-07.1 | Empty what | @fayeye-09 | 2 | 1 | — |').replace(
          'Empty what',
          ' ',
        ),
      ),
    ).toThrow(/empty "What"/)
  })

  it('rejects missing story header, missing §5, or §5 with zero task rows', () => {
    expect(() => parseDesignMarkdown('# STORY-07: Seat map\n## 5. Tasks\n')).toThrow(
      /Could not find "\*\*Story:\*\* #<number>"/,
    )

    expect(() =>
      parseDesignMarkdown('# STORY-07: Seat map\n**Story:** #56\n## 1. Flow\n'),
    ).toThrow(/Could not find Section 5/)

    expect(() =>
      parseDesignMarkdown(
        '# STORY-07: Seat map\n**Story:** #56\n## 5. Tasks and estimates\n| Task | What | Owner | Points | Days | Depends on |\n| --- | --- | --- | --- | --- | --- |\n',
      ),
    ).toThrow(/zero TSK rows/)
  })

  it('preserves distinct task titles when one §6 PR row bundles multiple tasks', () => {
    const doc = `# STORY-08: Map discovery
**Story:** #57
## 5. Tasks and estimates
| Task | What | Owner | Points | Days | Depends on |
| --- | --- | --- | --- | --- | --- |
| TSK-08.1 | Add curated tag schema | @dreeyanzz | 2 | 0.5 | — |
| TSK-08.2 | Add radius filter helper | @dreeyanzz | 2 | 0.5 | — |
## 6. Build order
| # | Branch | PR title | Contains |
| --- | --- | --- | --- |
| 1 | \`feature/STORY-08-filters\` | \`feat(STORY-08): add discovery filters\` | TSK-08.1, TSK-08.2 |
`
    const tasks = deriveTasks(parseDesignMarkdown(doc))
    expect(tasks[0].title).toBe('TSK-08.1: Add curated tag schema')
    expect(tasks[1].title).toBe('TSK-08.2: Add radius filter helper')
    expect(tasks[0].buildInfo?.branch).toBe('feature/STORY-08-filters')
    expect(tasks[1].buildInfo?.branch).toBe('feature/STORY-08-filters')
  })
})

describe('helper functions for GitHub matching and board metadata', () => {
  it('distinguishes TSK-12.1 from TSK-12.10 in issue titles', () => {
    expect(extractLeadingTaskId('TSK-12.1: add function')).toBe('TSK-12.1')
    expect(extractLeadingTaskId('TSK-12.10: add extra test')).toBe('TSK-12.10')
    expect(extractLeadingTaskId('STORY-12: Host occupancy')).toBeNull()
  })

  it('prefers domain area over cross-cutting db/ci when a story has multiple area labels', () => {
    expect(
      selectDefaultAreaFromLabels(
        ['type:story', 'area:db', 'area:host', 'moscow:must'],
        'STORY-05: Host portal and space listing CRUD',
      ),
    ).toBe('host')
    expect(selectDefaultAreaFromLabels(['area:db'], 'STORY-01: Database')).toBe('db')
    expect(selectDefaultAreaFromLabels(['type:story'])).toBeNull()
  })

  it('resolves Sprint iteration ID from Project 4 card or milestone title', () => {
    expect(
      resolveSprintIterationId(
        { sprint: { iterationId: 'custom-id' } },
        'Sprint 2 (Prefinal)',
      ),
    ).toBe('custom-id')
    expect(resolveSprintIterationId(null, 'Sprint 3 (Final)')).toBe(SPRINT_ITERATIONS[3])
    expect(resolveSprintIterationId(null, 'Sprint 1 (Midterm)')).toBe(
      SPRINT_ITERATIONS[1],
    )
    expect(resolveSprintIterationId(null, null)).toBe(SPRINT_ITERATIONS[2])
  })
})

describe('syncStoryTasks orchestration', () => {
  const sampleDoc = `# STORY-13: Community reviews and ratings

**Status:** approved 2026-12-03 · **Owner:** @fayeye-09 · **Story:** #78

## 5. Tasks and estimates

| Task | What | Owner | Points (1–10) | Days | Depends on |
| --- | --- | --- | --- | --- | --- |
| TSK-13.1 | Add reviews table, RLS policies, and pgTAP negative tests | @dreeyanzz | 3 | 1 | — |
| TSK-13.2 | Add review submission form and Space rating summary | @fayeye-09 | 3 | 1 | TSK-13.1 |

## 6. Build order

| # | Branch | PR title | Contains |
| --- | --- | --- | --- |
| 1 | \`feature/STORY-13-reviews-db\` | \`feat(STORY-13): add reviews table and rls policies\` | TSK-13.1 |
| 2 | \`feature/STORY-13-reviews-ui\` | \`feat(STORY-13): add review form and rating summary\` | TSK-13.2 |
`

  it('refuses to create GitHub issues when the design doc is not merged on main (D-016)', () => {
    const filePath = writeTempMarkdown(sampleDoc, 'STORY-13-reviews.md')
    const runGh = vi.fn()

    expect(() =>
      syncStoryTasks(filePath, {
        isDryRun: false,
        isMergedOnMain: () => false,
        runGh,
        logger: silentLogger,
      }),
    ).toThrow(/not merged on main yet \(D-016\)/)

    expect(runGh).not.toHaveBeenCalled()
  })

  it('allows --dry-run on an unmerged doc and falls back cleanly when offline', () => {
    const filePath = writeTempMarkdown(sampleDoc, 'STORY-13-reviews.md')
    const runGh = vi.fn(() => {
      throw new Error('offline')
    })

    const result = syncStoryTasks(filePath, {
      isDryRun: true,
      isMergedOnMain: () => false,
      runGh,
      logger: silentLogger,
    })

    expect(result.dryRun).toBe(true)
    expect(result.tasks).toHaveLength(2)
  })

  it('creates tasks, handles auto-added Project 4 cards, sets Sprint 3 fields, and removes needs-design', () => {
    const filePath = writeTempMarkdown(sampleDoc, 'STORY-13-reviews.md')
    const calls = []

    const runGh = vi.fn((args, options) => {
      calls.push({ args, options })
      const cmd = args.join(' ')

      if (cmd === 'api repos/dreeyanzz/studyhub/issues/78') {
        return JSON.stringify({
          number: 78,
          title: 'STORY-13: Community reviews and ratings',
          labels: [
            { name: 'type:story' },
            { name: 'area:ui' },
            { name: 'moscow:should' },
            { name: 'needs-design' },
          ],
          milestone: { title: 'Sprint 3 (Final)' },
        })
      }
      if (cmd === 'api repos/dreeyanzz/studyhub/issues/78/sub_issues?per_page=100') {
        return JSON.stringify([])
      }
      if (args[0] === 'issue' && args[1] === 'list') {
        return JSON.stringify([])
      }
      if (args[0] === 'project' && args[1] === 'item-list') {
        // First call returns only story #78; fallback call after item-add failure returns #202 too.
        const has202 = calls.some(
          (c) =>
            c.args[0] === 'project' &&
            c.args[1] === 'item-add' &&
            c.args.includes('https://github.com/dreeyanzz/studyhub/issues/202'),
        )
        const items = [
          {
            id: 'PVTI_story78',
            content: { number: 78, type: 'Issue' },
            sprint: { iterationId: SPRINT_ITERATIONS[3] },
          },
        ]
        if (has202) {
          items.push({
            id: 'PVTI_task202',
            content: { number: 202, type: 'Issue' },
            status: 'Product Backlog',
          })
        }
        return JSON.stringify({ items })
      }
      if (args[0] === 'issue' && args[1] === 'create') {
        const title = args[args.indexOf('--title') + 1]
        return title.startsWith('TSK-13.1:')
          ? 'https://github.com/dreeyanzz/studyhub/issues/201'
          : 'https://github.com/dreeyanzz/studyhub/issues/202'
      }
      if (cmd === 'api repos/dreeyanzz/studyhub/issues/201 --jq .id') {
        return '900201'
      }
      if (cmd === 'api repos/dreeyanzz/studyhub/issues/202 --jq .id') {
        return '900202'
      }
      if (cmd.includes('/sub_issues')) {
        return '{}'
      }
      if (args[0] === 'project' && args[1] === 'item-add') {
        if (args.includes('https://github.com/dreeyanzz/studyhub/issues/202')) {
          throw new Error('already added by GitHub sub-issue workflow')
        }
        return JSON.stringify({ id: 'PVTI_task201' })
      }
      if (args[0] === 'project' && args[1] === 'item-edit') {
        return ''
      }
      if (args[0] === 'issue' && args[1] === 'edit') {
        return ''
      }
      throw new Error(`Unexpected gh command: ${cmd}`)
    })

    const result = syncStoryTasks(filePath, {
      isDryRun: false,
      isMergedOnMain: () => true,
      runGh,
      logger: silentLogger,
    })

    expect(result.createdIssues).toEqual([201, 202])
    expect(result.reusedIssues).toEqual([])

    const createCalls = calls.filter(
      (c) => c.args[0] === 'issue' && c.args[1] === 'create',
    )
    expect(createCalls).toHaveLength(2)
    expect(createCalls[0].args).toContain('area:db')
    expect(createCalls[0].args).toContain('moscow:should')
    expect(createCalls[0].args).toContain('Sprint 3 (Final)')
    expect(createCalls[0].options?.input).toContain('### Parent story\n\n#78')

    expect(createCalls[1].args).toContain('area:ui')
    expect(createCalls[1].args).toContain('moscow:should')

    const sprintEdits = calls.filter(
      (c) =>
        c.args[0] === 'project' &&
        c.args[1] === 'item-edit' &&
        c.args.includes(FIELD_SPRINT),
    )
    expect(sprintEdits).toHaveLength(2)
    expect(sprintEdits[0].args).toContain(SPRINT_ITERATIONS[3])

    const removeLabelCalls = calls.filter(
      (c) => c.args[0] === 'issue' && c.args[1] === 'edit',
    )
    expect(removeLabelCalls).toHaveLength(1)
  })

  it('is idempotent on re-run: preserves In Progress status, attaches orphan task, and avoids TSK-13.10 collision', () => {
    const filePath = writeTempMarkdown(sampleDoc, 'STORY-13-reviews.md')
    const calls = []

    const runGh = vi.fn((args) => {
      calls.push(args)
      const cmd = args.join(' ')

      if (cmd === 'api repos/dreeyanzz/studyhub/issues/78') {
        return JSON.stringify({
          number: 78,
          title: 'STORY-13: Community reviews and ratings',
          labels: [
            { name: 'type:story' },
            { name: 'area:ui' },
            { name: 'moscow:should' },
          ],
          milestone: { title: 'Sprint 3 (Final)' },
        })
      }
      if (cmd === 'api repos/dreeyanzz/studyhub/issues/78/sub_issues?per_page=100') {
        // TSK-13.1 (#201) is already attached, plus an unrelated TSK-13.10 (#299).
        return JSON.stringify([
          {
            number: 299,
            id: 900299,
            title: 'TSK-13.10: tenth task should not collide with TSK-13.1',
            state: 'open',
          },
          {
            number: 201,
            id: 900201,
            title: 'TSK-13.1: add reviews table and rls policies',
            state: 'open',
          },
        ])
      }
      if (args[0] === 'issue' && args[1] === 'list') {
        // TSK-13.2 (#202) was created in a prior interrupted run before attaching.
        return JSON.stringify([
          {
            number: 202,
            title: 'TSK-13.2: add review form and rating summary',
            url: 'https://github.com/dreeyanzz/studyhub/issues/202',
            state: 'open',
          },
        ])
      }
      if (args[0] === 'project' && args[1] === 'item-list') {
        return JSON.stringify({
          items: [
            {
              id: 'PVTI_story78',
              content: { number: 78, type: 'Issue' },
              sprint: { iterationId: SPRINT_ITERATIONS[3] },
            },
            {
              id: 'PVTI_task201',
              content: { number: 201, type: 'Issue' },
              status: 'In Progress',
              points: 3,
              'estimate (days)': 1,
              moSCoW: 'Should',
              sprint: { iterationId: SPRINT_ITERATIONS[3] },
            },
            {
              id: 'PVTI_task202',
              content: { number: 202, type: 'Issue' },
              status: 'Product Backlog',
              points: 3,
              'estimate (days)': 1,
              moSCoW: 'Should',
              sprint: { iterationId: SPRINT_ITERATIONS[3] },
            },
          ],
        })
      }
      if (cmd === 'api repos/dreeyanzz/studyhub/issues/202 --jq .id') {
        return '900202'
      }
      if (
        cmd ===
        'api -X POST repos/dreeyanzz/studyhub/issues/78/sub_issues -F sub_issue_id=900202'
      ) {
        return '{}'
      }
      if (args[0] === 'project' && args[1] === 'item-edit') {
        return ''
      }
      throw new Error(`Unexpected gh command: ${cmd}`)
    })

    const result = syncStoryTasks(filePath, {
      isDryRun: false,
      isMergedOnMain: () => true,
      runGh,
      logger: silentLogger,
    })

    expect(result.createdIssues).toEqual([])
    expect(result.reusedIssues).toEqual([201, 202])

    // Zero new issues created, and needs-design was already absent so no issue edit ran.
    expect(calls.filter((a) => a[0] === 'issue' && a[1] === 'create')).toHaveLength(0)
    expect(calls.filter((a) => a[0] === 'issue' && a[1] === 'edit')).toHaveLength(0)

    // Only orphan #202 was attached; #201 was already attached.
    const subIssuePosts = calls.filter((a) => a.join(' ').includes('/sub_issues -F'))
    expect(subIssuePosts).toHaveLength(1)
    expect(subIssuePosts[0]).toContain('sub_issue_id=900202')

    // Only #202 (stuck in Product Backlog) had its Status moved; #201 (In Progress) had zero edits!
    const itemEdits = calls.filter((a) => a[0] === 'project' && a[1] === 'item-edit')
    expect(itemEdits).toEqual([
      [
        'project',
        'item-edit',
        '--project-id',
        expect.any(String),
        '--id',
        'PVTI_task202',
        '--field-id',
        FIELD_STATUS,
        '--single-select-option-id',
        OPTION_STATUS_SPRINT_BACKLOG,
      ],
    ])
    expect(
      itemEdits.some(
        (a) =>
          a.includes(FIELD_POINTS) ||
          a.includes(FIELD_ESTIMATE) ||
          a.includes(FIELD_MOSCOW),
      ),
    ).toBe(false)
  })

  it('throws a clear error when the design file path does not exist', () => {
    expect(() =>
      syncStoryTasks('docs/design/DOES-NOT-EXIST.md', {
        isDryRun: true,
        logger: silentLogger,
      }),
    ).toThrow(/Design document not found/)
  })
})
