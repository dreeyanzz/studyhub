// Regenerates the .docx next to each course document in docs/course.
// The .md is the source and a .docx is never edited by hand; run this only
// when submitting. Needs pandoc on PATH: https://pandoc.org/installing.html
//
// Formatting comes from reference.docx next to this file: Times New Roman
// throughout, US Letter, one-inch margins. That file is an input, not a
// deliverable — it is the only .docx in the repository that is not generated.
// To change the look, edit its styles in Word and commit it.
//
// Pass a filter to export a subset:
//   npm run docs:docx            every course document
//   npm run docs:docx -- Sprint  only documents whose filename contains "Sprint"
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = 'docs/course'
const reference = join(dirname(fileURLToPath(import.meta.url)), 'reference.docx')
const filter = process.argv[2]

const probe = spawnSync('pandoc', ['--version'], { stdio: 'ignore' })
if (probe.error || probe.status !== 0) {
  console.error(
    'pandoc was not found on PATH. Install it: https://pandoc.org/installing.html',
  )
  process.exit(1)
}

if (!existsSync(reference)) {
  console.error(`the reference document is missing: ${reference}`)
  process.exit(1)
}

const sources = readdirSync(dir).filter(
  (f) => f.endsWith('.md') && f !== 'README.md' && (!filter || f.includes(filter)),
)

if (sources.length === 0) {
  console.error(`no course document matched ${filter ? `"${filter}"` : 'the filter'}`)
  process.exit(1)
}

for (const source of sources) {
  const target = source.replace(/\.md$/, '.docx')
  const result = spawnSync(
    'pandoc',
    [
      join(dir, source),
      '-o',
      join(dir, target),
      `--reference-doc=${reference}`,
      `--resource-path=${dir}`,
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log(`${source} -> ${target}`)
}
