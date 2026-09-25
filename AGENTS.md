<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Worq (Project StudyHub): guide for AI agents and humans

Worq (technical codename: StudyHub, D-026) is a web app for finding a study or co-working space and holding an open seat
**now**:

- **Seekers** search spaces on a map, filter them by curated tags, pick an exact unit on the host's seat map, and pay a sandbox reservation fee to hold it.
- **Hosts** keep their seat map current.
- **Administrators** verify spaces and moderate reviews.

**Course:** CPEPE361 Software Development 1.

**Team:**

- Adrian Seth Tabotabo: Project Manager, the only merger, backend and database.
- Maria Faith Antigua: design system; maintains the board.
- Luke Miguel Dongque: auth and security.
- James Niño Mandawe: portal shells and QA.

**Stack:**

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui.
- Supabase (Postgres, Auth, Row-Level Security).
- Leaflet + OpenStreetMap (added with the map story).
- A sandbox payment gateway.
- Vercel.

Exact versions are in `package.json`.

**Read this file first, every session.** It is self-contained, so you can paste it whole
into a chat tool that cannot see the repository.

## Read order

1. This file.
2. [`docs/README.md`](docs/README.md): the map of every document, and which one wins
   when two disagree.
3. [`docs/course/StudyHub_SRS.md`](docs/course/StudyHub_SRS.md): the requirements,
   cited as `FR-x.y`.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md): what is already decided and what was
   rejected, cited as `D-NNN`.
5. [`docs/GLOSSARY.md`](docs/GLOSSARY.md): the words to use.
6. The story's design doc in [`docs/design/`](docs/design/).
7. The issue you were given.

## How the app fits together

- **Server Components read. Server Actions mutate.** There is one `actions.ts` per route segment. Route handlers in `app/api/` exist only for callers outside the app: the payment webhook, the QR check-in scan, scheduled jobs, and the Supabase auth callback (D-010).
- **Postgres Row-Level Security is the security boundary.** `proxy.ts` (Next 16's replacement for `middleware.ts`) only refreshes the session and redirects. Delete it and the data must still be safe.
- **The app reaches the database only through the Supabase client** (D-007). No ORM, no direct connection.
- **The secret key bypasses RLS.** It never appears in client code or behind `NEXT_PUBLIC_`. ESLint blocks importing a secret-key client outside `app/api/`.

## Layout

```
app/                  routes: (public)/ (auth)/ (dashboard)/{seeker,host,admin}/ api/
app/**/_components/   components used by one route only
components/ui/        shadcn/ui primitives (added through `npx shadcn add`)
components/<domain>/  components shared across routes
hooks/                shared client hooks
lib/utils.ts          cn()
lib/supabase/         client.ts, server.ts, admin.ts (secret key; app/api only),
                      proxy.ts, database.types.ts (generated)
lib/validation/       Zod schemas shared by browser and server
lib/data/             server-only query helpers
lib/<domain>/         pure logic: no database, no session, no React; tests next to it
supabase/             config.toml, migrations/, tests/ (pgTAP), seed.sql
e2e/                  Playwright journeys
scripts/              repo scripts (docx export)
docs/                 README (map), DECISIONS, GLOSSARY, ONBOARDING, DEVELOPMENT,
                      SPRINT-1, guides/, design/, course/ (course deliverables)
notes/                postmortems
```

Most of that tree does not exist yet; it is where files go when a story creates them. On
`main` today there are only `app/` (a layout and a placeholder page), `lib/utils.ts`,
`scripts/`, `supabase/config.toml` and `docs/`. The route groups, `app/api/`,
`components/`, `hooks/`, `lib/supabase/`, `lib/validation/`, `lib/data/`,
`supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql` and `e2e/` arrive with the
stories that need them.

## Commands

> Keep this block true. A PR that changes a script updates it.

```bash
npm install            # Node 24 (see .nvmrc)
npm run dev            # http://localhost:3000
npm run check          # typecheck + lint + format check + unit tests
npm test               # unit tests only (Vitest)
npm run build          # production build (CI runs it too)
npm run format         # Prettier, writes changes
npm run db:start       # local Supabase in Docker (database owner only)
npm run db:reset       # re-apply every migration, then seed.sql
npm run db:test        # pgTAP policy tests
npm run db:new <name>  # new migration file
npm run db:types       # regenerate lib/supabase/database.types.ts
npm run docs:docx      # regenerate the course .docx files (needs pandoc)
npm run docs:docx -- <filter>  # only documents whose filename contains <filter>
```

Required CI checks on `main`:

- `checks`
- `pr-title`
- `db`, once migrations exist

These job names are a contract, because renaming one blocks every PR.

## Working rules

1. **Cite the source.** Non-obvious code, designs and PRs cite `FR-x.y` or `D-NNN`. If
   you cannot name a source, say you are assuming.
2. **Vague request: stop.** Say what is unclear, give 2–3 concrete options with a
   recommendation, and wait. If the answer shapes other work, open a `decision-needed`
   issue.
3. **Plan gate.** No code for a story until its design doc is merged (D-016). Before
   changing code, write your plan and get it confirmed.
4. **Small changes.** One concern per PR.
5. **Tests ride along.** A feature and its tests land together. Every table or policy
   change ships with negative tests for both questions: the wrong user gets **zero
   rows**, and the right user **cannot** make forbidden writes to their own rows.
6. **Verify, then claim.** Run the commands before saying something works, and say how
   you verified it in the PR. Never tick an acceptance box you did not check yourself.
7. **Update the docs you make stale, in the same PR.** That includes a rule that a
   postmortem settles.
8. **Synthetic data only** (D-013): invented people, `@example.test` emails.
9. **Never edit an applied migration.** Add a new one. A schema change regenerates
   `db:types` in the same PR.
10. **No schema changes outside migrations.** No dashboard SQL, and no AI or MCP tool
    writing to a shared database.
11. **If a whole test suite fails at once**, stash your change and re-run on `main`
    before reading your own diff.
12. **Use the glossary's words** in code, UI and docs.

## Git and pull requests

- **`main` is protected** (D-014). Every change is a pull request, squash-merged, and only Adrian lands it.
  - **Reviews:** 1 approving review required (D-014). Adrian approves teammates' PRs; a teammate approves Adrian's.
- **Branch:** `feature/STORY-xx-short-desc`. The course requires it.
  - Several small branches per story are fine.
  - A fix uses the story it fixes; repo chores use STORY-00.
- **Commits on your branch:** `type(scope): subject`. Types: `feat fix docs style refactor perf test build ci chore revert`. The commit-msg hook checks this.
- **PR title:** `type(STORY-xx): summary`, with the summary starting in lowercase.
- **PR body:** fill in the template. It becomes the commit on `main`. Put `Closes #<task>` on the first line (and `Refs #<story>`).
- **Every PR targets `main`. Never stack PRs.** To catch up with `main`, run `git merge origin/main` on your branch.

## If you are an AI agent

- **You may:** create branches, commit, push feature branches, open pull requests, and comment on issues and PRs.
- **You may never:**
  - merge or approve a pull request
  - push to `main` or force-push
  - run `supabase db push` or `supabase link`
  - write to a shared database
  - change repository settings or rulesets
  - close issues, unless asked, and then only as "not planned"
- If a task seems to need one of these, that is the signal to stop and ask, not to find a way around it. `.claude/settings.json` blocks the main commands for Claude Code, but these rules apply to every tool.

## Windows: writing commit and PR text

Windows PowerShell 5.1 writes files with a byte-order mark (BOM) or as UTF-16.

- **Never** create a commit message or PR body with `Out-File`, `>` or `Set-Content`.
- **Use one of these instead:**
  - `git commit -m`
  - a Git Bash heredoc
  - `[IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))`, followed by `git commit -F` or `gh pr create --body-file`
- The commit-msg hook and the `pr-title` check both reject a BOM.

## Documentation duties

Every non-trivial change leaves a trace in the right place:

| What happened                              | Where it goes                           |
| ------------------------------------------ | --------------------------------------- |
| Ordinary work                              | The PR body (it becomes the commit)     |
| A decision between real alternatives       | A new entry in `docs/DECISIONS.md`      |
| A story's design                           | `docs/design/STORY-xx-*.md`             |
| Something broke or cost real debugging     | A postmortem in `notes/`                |
| A new term, or a word used two ways        | `docs/GLOSSARY.md`                      |
| An open question                           | A `decision-needed` issue               |
| A new script, command or environment value | The Commands block and `DEVELOPMENT.md` |

## AI credit

- The person who opens the PR owns the work and must be able to explain every line. The Final phase includes code authorship verification.
- Disclose AI use in the PR's "AI assistance" section, and end the PR body with a `Co-Authored-By:` line naming the tool.
  - For Claude, use `Co-Authored-By: Claude <noreply@anthropic.com>`.
  - For other tools, see `docs/guides/using-ai-assistants.md`.
- Agents add the same trailer to commits they write.

## Docs map

- [`docs/README.md`](docs/README.md): map, ground-truth order, where things go
- [`docs/SPRINT-1.md`](docs/SPRINT-1.md): the Sprint 1 brief in plain English: who
  does what, who waits for whom, how to test, and the dates
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisions and what was rejected
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md): the words to use
- [`docs/ONBOARDING.md`](docs/ONBOARDING.md): agent-run machine setup
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): accounts, environments, secrets, daily
  loop
- [`docs/guides/`](docs/guides/): planning a story, git and PRs, reviewing and merging,
  testing, AI assistants, postmortems, the board
- [`docs/design/`](docs/design/): one design doc per story, plus the template
- [`docs/course/`](docs/course/): SRS, planning worksheet, sprint plans, board snapshots
- [`notes/`](notes/): postmortems
