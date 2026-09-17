# Contributing to StudyHub

StudyHub is built by four students for CPEPE361 (Software Development 1). This page is
the short version of how we work.

- **Full rules:** [`AGENTS.md`](AGENTS.md). If the two disagree, `AGENTS.md` wins; fix the drift in a PR.
- **How-to guides:** [`docs/guides/`](docs/guides/).

## Team

| Member               | Role                                                 | GitHub               |
| -------------------- | ---------------------------------------------------- | -------------------- |
| Adrian Seth Tabotabo | Project Manager · the only merger · backend and data | `@dreeyanzz`         |
| Maria Faith Antigua  | Frontend design system · maintains the board         | `@fayeye-09`         |
| Luke Miguel Dongque  | Auth and security                                    | `@lukedongque`       |
| James Niño Mandawe   | Portal shells and QA                                 | `@JamesNino-Mandawe` |

## Course rules we never break

- **Board:** a GitHub Project with exactly these columns: Product Backlog, Sprint 1 Backlog, In Progress, Code Review, Done.
- **Tasks:** every story is split into tasks with story points (1–10) and day estimates.
- **Branch names:** `feature/STORY-xx-short-desc`.
- **Reviews:** every pull request is reviewed before it merges.

## Your first day

Open your AI assistant in the repository and say:

> Read docs/ONBOARDING.md and set up my machine.

Then read [`AGENTS.md`](AGENTS.md). It takes ten minutes and saves days.

## How work flows

1. **Story.** Work starts from a STORY-xx issue on the board.
2. **Design.** The story owner writes `docs/design/STORY-xx-*.md`
   ([planning a story](docs/guides/planning-a-story.md)). Adrian merging it is the
   approval. No code before that.
3. **Tasks.** The design's task table becomes TSK sub-issues with points and days.
4. **Branch.** From an up-to-date `main`: `git switch -c feature/STORY-xx-short-desc`.
5. **Build.** Small commits, tests alongside the code, and `npm run check` before you
   push ([git and PRs](docs/guides/working-with-git-and-prs.md),
   [testing](docs/guides/testing.md)).
6. **Pull request.** Fill in the template, and ask for a review
   ([reviewing and merging](docs/guides/reviewing-and-merging.md)).
7. **Merge.** Adrian squash-merges it. The issue closes, and the card moves to Done.

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
- **Every PR is reviewed.** Adrian approves teammates' PRs, and a teammate approves Adrian's. The required approval count is temporarily 0 while Adrian is the only active developer, and returns to 1 when the first teammate can review (issue #72).
- **Only Adrian can merge** ([D-014](docs/DECISIONS.md)). If he is unavailable, nothing merges, so keep PRs small.
- **Squash merge only.** The PR title and body become the commit on `main`, so write them for someone reading the history later.

## Definition of Done

A task or story is done when:

- [ ] CI is green (`checks`, `pr-title`, and `db` when SQL changed)
- [ ] every acceptance criterion is ticked by the person who verified it, named in the PR
- [ ] docs the change makes stale are updated in the same PR
- [ ] accessibility is checked (48×48 px targets, keyboard, focus, contrast, 360/768/1024
      px)
- [ ] it has been reviewed, and Adrian squash-merged it
- [ ] the issue is closed and the card is in Done

## AI assistants

Allowed, with rules:

- You own every line and can explain it.
- You disclose AI use in the PR.
- AI agents never merge, approve, push to `main`, or change a shared database.

See [using AI assistants](docs/guides/using-ai-assistants.md).

## What you need

- Node 24 (see `.nvmrc`), Git, and the GitHub CLI (`gh`).
- Docker, only if you run the local database (by default, Adrian does).

Details are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
