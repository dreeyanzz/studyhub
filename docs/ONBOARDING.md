# Onboarding: set up your machine

**This document is written for an AI agent to run, step by step.** A new teammate opens
their AI tool (Claude Code, Gemini CLI, Antigravity or Codex) in the repository and says:

> Read docs/ONBOARDING.md and set up my machine.

The agent runs each step, checks the output, and stops to ask whenever only a person can
do something. The teammate answers questions and clicks things in a browser.

## Rules for the agent

1. **Check every step before the next one.** Run the check and read the real output. A
   step that printed an error is not done.
2. **Never invent a value.** If a step needs a key, an account or a password you do not
   have, 🛑 stop and ask.
3. **Local Supabase keys are not secrets.** `npm run db:start` prints the same
   development defaults on every machine. **Cloud keys are secrets.** They are always a
   🛑 stop. Adrian shares them privately, and the teammate pastes them into `.env.local`
   themselves.
4. **Do not commit anything during setup.** `.env.local` stays untracked.
5. **Do not install anything system-wide without asking.** That includes a Node version
   manager, Docker, and global npm packages.
6. **When a step fails, check Troubleshooting before improvising.**
7. **Report what happened, not what should have happened.** Finish with "Report back".

## Part 0: ask first

🛑 **Stop. Ask these four questions and wait for the answers.**

1. **Which operating system and shell?** Most of the team uses Windows with PowerShell or
   Git Bash. The commands below are for Git Bash; PowerShell versions are given where
   they differ.
2. **Are you the database owner, or a cloud-dev user?** The database owner runs the
   local database in Docker; by default that is Adrian. Everyone else is a cloud-dev
   user.
3. **Which email does git commit with, and is it verified on your GitHub account?** Commits
   with an unverified email do not show as yours. That matters for the code authorship
   check in the Final phase.
4. **Which AI tool are you using right now?**

## Part 1: setup

### 1. Confirm the repository

```bash
git rev-parse --show-toplevel && git remote get-url origin && git log --oneline -1
```

**Expect:** the `studyhub` folder, `https://github.com/dreeyanzz/studyhub.git`, and a
commit. If not, 🛑 ask where the repository is, or whether to clone it with
`git clone https://github.com/dreeyanzz/studyhub.git`.

### 2. Git identity

```bash
git config user.name && git config user.email
```

**Expect:** the teammate's name and the email from Part 0. If either is wrong, ask for
the right value, then set it for this repository only, for example
`git config user.email "name@example.com"`.

🛑 If the email is not verified on their GitHub account, stop. They verify it at
<https://github.com/settings/emails>.

### 3. Node 24

```bash
node --version
```

**Expect:** `v24.x`. If not, 🛑 stop and tell the teammate which version they have.
Offer `winget install OpenJS.NodeJS.LTS` on Windows, or their version manager
(`fnm use`, `nvm use`). Install nothing without a yes.

### 4. GitHub CLI

```bash
gh --version && gh auth status
```

- **If `gh` is missing:** 🛑 ask before installing it (`winget install GitHub.cli`).
- **If they are not logged in:** 🛑 the teammate runs `gh auth login` themselves. It opens a browser.

### 5. Install dependencies

```bash
npm ci
```

**Expect:** it completes. A warning about `allow-scripts` and `unrs-resolver` is expected
and harmless. `EBADENGINE` or `ERESOLVE` are not; see Troubleshooting.

### 6. Git hooks

```bash
git config core.hooksPath
```

**Expect:** `.husky/_`. If it is empty, run `npm run prepare` and check again.

### 7. Environment file

```bash
[ -f .env.local ] || cp .env.example .env.local
```

PowerShell: `if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }`

### 8a. Database owner only: local Supabase

```bash
docker info > /dev/null 2>&1 && echo "docker: running" || echo "docker: NOT running"
```

🛑 If Docker is not running, ask the teammate to start Docker Desktop. Then:

```bash
npm run db:start
```

The first run downloads several images and can take five minutes or more. That is
normal; do not cancel it.

Copy the printed API URL and publishable key (called "anon key" on older CLI output) into
`.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then:

```bash
npm run db:reset && npm run db:types && npm run db:test
```

Until STORY-01 lands there are no migrations or tests. Report that plainly rather than
as a failure.

### 8b. Everyone else: the shared cloud dev project

🛑 **Stop.** Ask the teammate to get the dev project URL and publishable key from Adrian in
a private message, and to paste them into `.env.local` themselves. You never see or
repeat the values. If the dev project does not exist yet, skip this step and report it.

### 9. Checks

```bash
npm run check
```

**Expect:** typecheck, lint, format check and unit tests all pass.

### 10. Run the app

```bash
npm run dev
```

**Expect:** <http://localhost:3000> loads. Stop the server afterwards (Ctrl+C).

### 11. Confirm the AI tool reads AGENTS.md

| Tool                          | How it gets the rules                                           |
| ----------------------------- | --------------------------------------------------------------- |
| Claude Code                   | `CLAUDE.md` imports `AGENTS.md`. Nothing to do                  |
| Gemini CLI                    | `.gemini/settings.json` points it at `AGENTS.md`. Nothing to do |
| Antigravity (1.20.5 or newer) | Reads `AGENTS.md` natively                                      |
| Codex                         | Reads `AGENTS.md` natively                                      |
| ChatGPT or another chat tool  | Paste `AGENTS.md` at the start of each conversation             |

Ask the tool: "What must a branch be named in this repository?" It should answer
`feature/STORY-xx-short-desc`. If it does not, it is not reading `AGENTS.md`.

## Troubleshooting

| Symptom                                                 | Cause                                              | What to do                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/usr/bin/env: 'sh\r'` when committing                  | A hook file was checked out with CRLF line endings | Pull the latest `main` (its `.gitattributes` forces LF), then `git checkout -- .husky`        |
| Commit rejected: "the subject must look like…"          | The commit-msg hook                                | Use `type(scope): summary`; see [working with git](guides/working-with-git-and-prs.md)        |
| Commit rejected: "byte-order mark"                      | The message was written by PowerShell 5.1          | Use `git commit -m`, or Git Bash                                                              |
| `EBADENGINE` during `npm ci`                            | Node is not version 24                             | Install Node 24 (step 3)                                                                      |
| `ERESOLVE` during `npm ci`                              | A dependency conflict                              | 🛑 Report it. Never use `--force` or `--legacy-peer-deps`                                     |
| `lib/supabase/database.types.ts` is unreadable (UTF-16) | Types were generated with `>` in PowerShell        | Always run `npm run db:types`, never the raw command                                          |
| `npm run db:start` fails on ports 54321–54324           | Another Supabase stack is running                  | `npx supabase stop --all`, then try again                                                     |
| The app loads, but every list is empty                  | `.env.local` points at a wrong or paused project   | Check the URL. Free projects pause after about a week idle; wake it in the Supabase dashboard |
| `permission denied for table …`                         | A table has no GRANT                               | 🛑 Report it. A migration must grant that table                                               |

## Report back

Tell the teammate, in this order:

1. Which steps passed, including whether `npm run check` passed.
2. Anything skipped or failed, and why.
3. Any file you changed other than `.env.local`. There should be none, except
   `lib/supabase/database.types.ts` for the database owner.
4. What to read next: [`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md),
   and their story on the board.

Then stop. Do not start a task unless the teammate gives you one.
