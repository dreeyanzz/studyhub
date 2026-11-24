# Contributing to StudyHub

StudyHub is built by four students for CPEPE361 (Software Development 1). This page is
the short version of how we work.

- **Full rules:** [`AGENTS.md`](AGENTS.md). If the two disagree, `AGENTS.md` wins; fix the drift in a PR.
- **How-to guides:** [`docs/guides/`](docs/guides/).

## Team

| Member               | Role                                       | GitHub               |
| -------------------- | ------------------------------------------ | -------------------- |
| Adrian Seth Tabotabo | Project Manager · backend and data         | `@dreeyanzz`         |
| Maria Faith Antigua  | UX and design system · maintains the board | `@fayeye-09`         |
| Luke Miguel Dongque  | Auth and security                          | `@lukedongque`       |
| James Niño Mandawe   | Portal shells and QA                       | `@JamesNino-Mandawe` |

## Course rules we never break

- **Board:** a GitHub Project with exactly these columns: Product Backlog, Sprint 3 Backlog (renamed each sprint, D-038), In Progress, Code Review, Done.
- **Tasks:** every story is split into tasks with story points (1–10) and day estimates.
- **Branch names:** `feature/STORY-xx-short-desc`.
- **Reviews:** every pull request is reviewed before it merges.

## Your first day

Open your AI assistant in the repository and say:

> Read docs/ONBOARDING.md and set up my machine.

Then read [`AGENTS.md`](AGENTS.md). It takes ten minutes and saves days.

## How work flows

1. **Story.** Work starts from a STORY-xx issue on the board.
2. **Shared flows.** A flow that several stories share is drawn first, by its owner, in
   [`docs/flows/`](docs/flows/README.md) (D-044). A story's design waits for the flows it
   uses.
3. **Design.** The story owner writes `docs/design/STORY-xx-*.md`
   ([planning a story](docs/guides/planning-a-story.md)). Once its named approvers
   approve it (D-016, D-042, D-073) and CI is green, any teammate may squash-merge it
   (D-096). No code before that.
4. **Tasks.** The design's task table becomes TSK sub-issues with points and days.
5. **Branch.** From an up-to-date `main`: `git switch -c feature/STORY-xx-short-desc`.
6. **Build.** Small commits, tests alongside the code, and `npm run check` before you
   push ([git and PRs](docs/guides/working-with-git-and-prs.md),
   [testing](docs/guides/testing.md)).
7. **Pull request.** Fill in the template, and ask a teammate for a review
   ([reviewing and merging](docs/guides/reviewing-and-merging.md)).
8. **Merge.** Once approved and CI is green, any teammate squash-merges it (or enables
   auto-merge). The issue closes, and the card moves to Done.

## Formats

| Thing    | Format                        | Example                                        |
| -------- | ----------------------------- | ---------------------------------------------- |
| Branch   | `feature/STORY-xx-short-desc` | `feature/STORY-03-login-page`                  |
| Commit   | `type(scope): subject`        | `feat(STORY-03): add the login form`           |
| PR title | `type(STORY-xx): summary`     | `feat(STORY-03): add login and register pages` |

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Summaries** start with a lowercase letter.
- **Enforcement:** the commit-msg hook checks the `type(scope): subject` shape; the `pr-title` check enforces the lowercase summary on the PR title, which is what lands on `main`.

## Repository rules

- **Direct pushes to `main` are blocked for every change**, including docs. Everything goes through a pull request.
- **Every PR targets `main`.** Never base a PR on another PR's branch.
- **Every PR is reviewed.** 1 approval from a teammate is required ([D-014](docs/DECISIONS.md), [D-096](docs/DECISIONS.md)); nobody can approve their own PR.
- **Any teammate can squash-merge** once approved and all 4 required CI checks pass (or enable auto-merge, [D-096](docs/DECISIONS.md)). Keep PRs small.
- **Squash merge only.** The PR title and body become the commit on `main`, so write them for someone reading the history later.

## Definition of Done

A task or story is done when:

- [ ] CI is green (`checks`, `pr-title`, `db` and `e2e`)
- [ ] every acceptance criterion is ticked by the person who verified it, named in the PR
- [ ] docs the change makes stale are updated in the same PR
- [ ] accessibility is checked (48×48 px targets, keyboard, focus, contrast, 360/768/1024
      px)
- [ ] it has 1 peer approval and is squash-merged to `main`
- [ ] the issue is closed and the card is in Done

## AI assistants

Allowed, with rules:

- You own every line and can explain it.
- You disclose AI use in the PR.
- AI agents never merge, push to `main`, or change a shared database, and approve a PR
  only when their person explicitly says so (D-034).

See [using AI assistants](docs/guides/using-ai-assistants.md).

## What you need

- Node 24 (see `.nvmrc`), Git, and the GitHub CLI (`gh`).
- Docker, only if you run the local database (by default, Adrian does).

Details are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
