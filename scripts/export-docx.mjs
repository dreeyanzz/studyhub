// Regenerates the .docx next to each course document in docs/course.
// The .md is the source and a .docx is never edited by hand; run this only
// when submitting. Needs pandoc on PATH: https://pandoc.org/installing.html
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'docs/course'

const probe = spawnSync('pandoc', ['--version'], { stdio: 'ignore' })
if (probe.error || probe.status !== 0) {
  console.error(
    'pandoc was not found on PATH. Install it: https://pandoc.org/installing.html',
  )
  process.exit(1)
}

const sources = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
for (const source of sources) {
  const target = source.replace(/\.md$/, '.docx')
  const result = spawnSync(
    'pandoc',
    [join(dir, source), '-o', join(dir, target), `--resource-path=${dir}`],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log(`${source} -> ${target}`)
}
