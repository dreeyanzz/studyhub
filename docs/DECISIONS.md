# Decisions

One log of every decision that had real alternatives.

**Format.** Each entry says what was decided, why, what was rejected, and when to revisit it, in about 15 lines or fewer.

**Citing.** Cite entries as `D-NNN` in code comments, design docs and PRs.

**Changing a decision.** The log is append-only. Mark the old entry "Superseded by D-NNN" and add a new one; don't rewrite history.

**Open questions** are `decision-needed` issues until they are settled here.

---

## D-001 · Reserve-now, current-state holds only

**Decision:** A Seeker can hold only a unit that is open **now**. There are no future bookings and no user-set study duration.

**Why:** It avoids the "seat still occupied when my booking starts" problem. The survey showed people check availability before leaving, not days ahead.

**Rejected:** Advance bookings with time slots, which need slot inventory the host cannot keep true.

**Revisit if:** Hosts ask for scheduled bookings after the course.

## D-002 · Availability is maintained by hosts

**Decision:** Hosts set unit states. Every availability view shows "host-updated · X min ago". Only holds made in the app are system-guaranteed.

**Why:** Sensors are out of scope, and the label is honest about freshness (SRS §2.6, §3.3).

**Rejected:** Occupancy sensors (hardware and cost), and calling host-maintained data "real-time".

## D-003 · Space → Zone → Unit, snap-grid map plus list view

**Decision:**

- A Space has Zones, and a Zone has Units. A unit is a seat, a standing desk, or a whole room with a capacity.
- Hosts build a snap-grid seat map.
- Seekers pick an exact unit. An accessible list view offers the same actions (SRS §3.2.2).

**Why:** A snap grid can be built in a semester and renders the same for Seekers.

**Rejected:** A freeform canvas editor (hard to build and to make accessible), and zone-level "any seat" holds.

## D-004 · Seat states and the two timers

**Decision:** States are `available → pending_payment → reserved → occupied → available` (SRS Figure 2). Hosts may set any unit to any state for walk-ins. There is **no** Maintenance state.

Two separate timers:

- the **payment window**: `pending_payment` back to `available`
- the **wait window**: `reserved` to no-show

Their lengths are decided in STORY-09's design.

**Rejected:** A Maintenance state (not in the SRS), and one shared "hold timer" (it mixes up two rules).

## D-005 · Prepaid reservation fee, sandbox only

**Decision:**

- A hold is guaranteed by a reservation fee, paid through a gateway's hosted checkout in test mode (PayMongo or Stripe).
- The fee is forfeited on a no-show.
- It is sandbox-refundable if the host cannot honour the hold (FR-5.3).

**Why:** It guards against no-shows without PCI scope: card and e-wallet data never touch StudyHub.

**Rejected:** No payment at all (leaves the no-show problem), and live payments (merchant onboarding and KYC).

## D-006 · Hybrid tags

**Decision:** Platform-curated tags drive the filters. Host custom tags are display-only. Both exist at space level and unit level.

**Why:** Free-text tags break filtering (FR-1.2, FR-1.3).

**Rejected:** Free-text tags only, and curated tags only.

## D-007 · Supabase Auth, RLS, and the Supabase client only

**Decision:**

- Supabase Auth handles identity.
- Postgres Row-Level Security enforces the roles `seeker`, `host` and `admin`.
- The app talks to the database only through the Supabase client.

**Why:** RLS is the security boundary. An ORM or a direct connection runs as a database role outside per-user RLS.

**Rejected:** Custom JWT and bcrypt auth, and Prisma (named in the Planning Worksheet) or any direct connection.

**Note:** SRS §3.5.2 asks for "parameterized queries or an ORM". The Supabase client's parameterized queries meet it.

## D-008 · One active hold per unit, in one transaction

**Decision:**

- A unit has at most one active hold (`pending_payment`, `reserved` or `occupied`).
- A Seeker has at most one active hold.
- Both rules are enforced in a single atomic database transaction (FR-2.5).

**Why:** It prevents double-booking under concurrency.

**Rejected:** Checks in application code, and external locks such as Redis.

**Test:** Two concurrent holds on one unit give exactly one success.

## D-009 · Reviews only after check-in

**Decision:** A review needs a completed check-in at that space, and each visit allows one review (FR-4.1).

**Why:** It makes "verified" mean something.

## D-010 · How the app reads and writes

**Decision:**

- Server Components read, and Server Actions mutate (one `actions.ts` per route segment).
- Route handlers in `app/api/` exist only for callers outside the app: the payment webhook, the QR check-in scan, scheduled jobs, and the Supabase auth callback.

**Why:** Fewer moving parts, and RLS applies either way. This is how StudyHub implements SRS §3.6.1's "RESTful JSON APIs": JSON route handlers exist where an outside system calls in.

**Rejected:** A REST endpoint for every mutation, which adds boilerplate without adding safety.

## D-011 · Vercel only

**Decision:** The app is hosted on Vercel's Hobby plan, on Adrian's account. `main` deploys to production, and pull requests get preview deployments.

**Why:** SRS §2.4. The earlier "Vercel / Cloudflare" wording is dropped.

**Consequence:** Hobby cron jobs run at most once a day, so expiry of holds and payment windows must not depend on cron.

## D-012 · OpenStreetMap and Leaflet only

**Decision:** Maps use Leaflet with OpenStreetMap tiles.

**Why:** SRS §2.5 forbids proprietary per-query map APIs.

**Rejected:** Mapbox and Google Maps.

## D-013 · Synthetic data only

**Decision:** Seed and demo data are invented, and emails use `@example.test`. The admin account is seeded locally only, never in a cloud project.

**Why:** Seed passwords are public in this repository, and no real person's data belongs in a class demo.

## D-014 · Governance of `main`

**Decision:** Two rulesets protect `main`. Their exported JSON is kept in `.github/rulesets/`.

- **A, "main: PR, 1 approval, CI":**
  - A PR is required. The approval count is **temporarily 0**; see the exception below.
  - Stale approvals are dismissed, and review threads must be resolved.
  - An extra approval is required for changes GitHub cannot attribute to a user account, so a pull request carrying unattributed commits needs 1 approval even while the count is 0.
  - Squash merge only.
  - Required checks: `checks` and `pr-title`.
  - No force-push and no deletion.
  - The bypass list is empty.
- **B, "main: only Adrian lands":** Restrict updates. Only the Repository admin (Adrian) may bypass, and only through a PR.

**Why:** CPEPE361 requires PR reviews. On a personal repository, collaborators cannot be read-only, and classic "restrict pushes" is organisation-only. Because nobody can bypass A, even Adrian is held to it.

**Temporary exception (2026-09-17):** STORY-00 was built before the teammates were onboarded. GitHub does not allow self-approval, so requiring one approval would have left the foundation pull requests unmergeable and the teammates unable to start. Ruleset A therefore requires **0** approvals for now, and the committed snapshot reflects that. Everything else still applies: a pull request, squash only, green CI, resolved threads, and an empty bypass list. Issue #72 tracks restoring it to 1 when the first teammate can review.

**Rejected:**

- Code-owner review, because Adrian cannot approve his own PRs.
- Convention only, because three collaborators could merge.
- A fork workflow, because there would be no shared branches.

**Revisit if:** The repository moves to a GitHub organisation.

## D-015 · Squash merges; the PR is the commit

**Decision:** Squash merge only. The PR title and body become the commit on `main` (settings `PR_TITLE` / `PR_BODY`). Every PR targets `main`, and PRs are never stacked.

**Why:** One readable commit per PR, which the `pr-title` check validates.

**Rejected:** `--no-ff` merge commits (from the first CONTRIBUTING draft). They make a noisy history, and every branch commit would need checking.

## D-016 · Plan gate: design before code

**Decision:** Every story has a design doc (`docs/design/STORY-xx-*.md`) merged before its code starts. Adrian's merge is the approval. Fixes, chores and docs-only changes are exempt.

**Why:** Mistakes are cheapest to fix in a design, and the course already requires reviews.

**Rejected:** Plans that live only inside issues, which cannot be reviewed as a document.

## D-017 · Supabase environments

**Decision:**

- Adrian owns migrations and runs the local Docker stack.
- Teammates use one shared cloud dev project, which is migrated only from merged `main` (Adrian runs `supabase db push`). No schema edits happen in the dashboard.
- A production project is created before the Final phase.
- CI runs the pgTAP tests on a fresh local stack, in a `db` job that arrives with the first migration (STORY-01).

**Why:** Docker is heavy on laptops, and a single migration owner avoids version collisions.

## D-018 · Latest compatible versions, pinned exactly

**Decision:** Every dependency is pinned exactly, at the latest version that works with the rest of the toolchain. Right now that means:

- TypeScript stays on 5.9, because typescript-eslint accepts only versions below 6.1.
- ESLint stays on 9, because jsx-a11y rejects ESLint 10.
- Node 24 LTS.

Each upgrade is its own `build(deps)` PR.

**Rejected:** The latest of everything (it breaks lint), and Next.js 14 from the first Sprint plan.

## D-019 · Test layout

**Decision:**

- Unit tests sit next to the code: `lib/**/x.test.ts`, run with Vitest.
- Database policy tests live in `supabase/tests/` (pgTAP).
- Journeys live in `e2e/` (Playwright).
- Every table or policy change ships with negative tests.

**Rejected:** A separate `tests/unit/` folder (from the first Sprint plan).

## D-020 · One instruction file for every AI tool; AI credit

**Decision:**

- `AGENTS.md` is the only source of agent instructions. `CLAUDE.md` imports it, `.gemini/settings.json` points Gemini CLI at it, and Antigravity and Codex read it natively.
- The human who opens a PR owns and can explain every line.
- AI use is disclosed in the PR and with a `Co-Authored-By:` line.

**Why:** The Final phase verifies code authorship. And with one file there is no copy to drift from.

## D-021 · Markdown is the source; .docx is generated

**Decision:** Course documents are edited as `.md`. `npm run docs:docx` regenerates the `.docx` files with pandoc for submission.

**Rejected:** Keeping both formats by hand, because they drift.

## D-022 · Tracking

**Decision:**

- A GitHub Project with exactly the course columns: Product Backlog, Sprint 1 Backlog, In Progress, Code Review, Done.
- Each story is a STORY-xx parent issue, with TSK sub-issues for its tasks.
- Estimates use points (1–10) and days.
- WIP limits: In Progress ≤ 4, Code Review ≤ 4.

Maria maintains the board; Adrian is Project Manager.

## D-023 · Branch names

**Decision:** Every branch is `feature/STORY-xx-short-desc` (course rule). Fixes go under the story they fix, and repository chores go under STORY-00.

**Rejected:** `type/desc` branches for work outside a story, which would break the course rule.

## D-024 · License (open)

**Status:** Open. There is no LICENSE file until the school's policy on course project IP has been checked. Until then, all rights are reserved by the team.
