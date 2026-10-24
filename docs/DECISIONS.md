# Decisions

One log of every decision that another story builds on, that is costly to reverse, or that a reasonable teammate would have chosen differently (D-044).

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

- **A, "main: PR, CI, reviews, and merge control"** (`.github/rulesets/main-pr-ci-reviews.json`):
  - A PR is required. The approval count is 1.
  - Stale approvals are dismissed, and review threads must be resolved.
  - An extra approval is required for changes GitHub cannot attribute to a user account.
  - Squash merge only.
  - Required checks: `checks`, `pr-title` and `db`.
  - Restrict updates: Collaborators cannot merge or push directly to `main`.
  - Bypass: Repository Admin (Adrian) has `bypass_mode: "always"`. This allows Adrian to land PRs without false "ref protected" blockers, bypass pending reviews/CI when verified locally or during rapid iteration, and push directly when needed, while teammates remain strictly held to the PR, 1-review, and CI requirements.
- **B, "main: core integrity"** (`.github/rulesets/main-core-integrity.json`):
  - No force-push and no branch deletion.
  - The bypass list is empty: even the Repository Admin cannot accidentally delete `main` or rewrite its history.

**Why:** CPEPE361 requires PR reviews and team governance. On a personal repository, collaborators cannot be read-only, and classic "restrict pushes" is organisation-only. By splitting rulesets into core integrity (unbypassable) and PR/review policy (bypassed only by the Project Manager), the repository guarantees history safety and holds all teammates to course compliance while giving Adrian full merge authority and superuser velocity.

**Evolution:**

- _2026-09-16:_ Ruleset A had 0 approvals while Adrian was setting up foundation before teammates onboarded (#72).
- _2026-09-18:_ Restored to 1 approval requirement once teammates onboarded. Admin bypass mode set to `always` on the PR/review policy ruleset to prevent false "Cannot update this protected ref" blocks during PR merges and permit local-CI verified direct pushes. Core integrity isolated with zero bypass.
- _2026-09-26:_ `db` added to the required checks once STORY-01 brought the first migrations (#89).

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

**Superseded by D-038**, which renames the second column each sprint.

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

## D-025 · One reference document styles every course .docx

**Decision:** `scripts/reference.docx` holds the submission formatting — Times New Roman,
US Letter, one-inch margins — and `npm run docs:docx` passes it to pandoc for every course
document. It is the one `.docx` in the repository that is an input, so it is the one that
may be edited by hand; changing the look means editing its styles in Word and committing
it. Extends D-021.

**Why:** pandoc takes docx fonts and page size only from a reference document, and a
course submission has to look consistent across deliverables.

**Rejected:** Styling each exported file in Word (the next export overwrites it, which is
exactly what D-021 was written to prevent), and leaving Word's defaults, which gave Aptos
on whatever paper size the machine's locale picked.

**Consequence:** The `.docx` files exported before this entry were styled by the old
defaults. They change the next time anyone runs the export, so regenerate the whole set in
one PR rather than leaving a submission half-restyled.

## D-026 · Worq as application brand, StudyHub as technical codename

**Decision:** The consumer-facing application and product brand is **Worq**. The internal project, repository name (`dreeyanzz/studyhub`), package name, and academic course deliverable codename remains **StudyHub**.

**Why:** "Worq" provides a punchy, modern consumer brand suitable for both students seeking study spots and remote professionals/freelancers booking co-working spaces. Keeping "StudyHub" as the internal repository and technical codename avoids breaking git remotes for teammates, preserves CI workflow definitions, and maintains continuity with CPEPE361 course registrations and syllabus grading.

**Rejected:** A full codebase, repository, and course document rename (Option B), which would disrupt team git remotes, break external links, and create needless grading friction.

## D-027 · Sprint 1 profiles and spaces stay minimal

**Decision:**

- In Sprint 1, a profile holds a name and a phone number. A space holds a name, a description, an address, one opening and one closing time used every day, and a verification status.
- Study preferences and space tags move to STORY-08. Price arrives as the curated price-tier tag (STORY-08) and the reservation fee (STORY-09).
- A closing time earlier than the opening time means the space closes after midnight. Equal times mean it is open 24 hours.
- A Host's edit keeps a verified space verified until STORY-14 decides otherwise.

**Why:** Nothing in Sprint 1 reads preferences or tags. Storing either as free text now would clash with D-006's curated tags and need migrating later. The Midterm checks create, read, update and delete, which these fields already give. Until STORY-14 there is no Administrator screen, so sending an edited space back to pending would hide it with no way to approve it again.

**Rejected:** A `study_preferences` array and an `amenities` array in Sprint 1; an `hourly_rate` column (a reservation fee is not a rate, D-005); hours as free text; different hours for each weekday.

**Revisit:** STORY-08 for tags and preferences, and STORY-14 for re-verifying edited spaces.

## D-028 · Shared test accounts on the cloud dev project

**Decision:**

- The cloud dev project has the seed's invented Seeker and Host accounts: `host@`, `host2@` and `seeker@example.test`. It never has the Administrator (D-013).
- Adrian registers them with `npm run db:accounts` as soon as the migrations are pushed, not after STORY-03. The script signs up through Supabase Auth, the same path `/register` uses, so the sign-up trigger gives each account its role. It is safe to re-run, and it checks every account's role and password.
- Their password is `CLOUD_DEV_ACCOUNT_PASSWORD`, never the seed's. Adrian sends it privately inside `.env.local`, with the keys (D-029).
- No spaces are seeded there. Hosts create them through STORY-05.

**Why:** Teammates need known accounts to log in and test as soon as their pages exist, without waiting for `/register`. Signing up tests the real trigger instead of going around it. The seed password is public, because the repository is (D-013), so a cloud account with it is open to anyone who learns the project's address.

**Rejected:** Running `seed.sql` on the cloud project (it holds the Administrator and the public password); waiting for STORY-03's `/register` (it blocks login testing for days); creating users in the Supabase dashboard (no role in the metadata, so every account would become a Seeker); reusing the seed password.

**Revisit:** When the production project is created (D-017). Its demo accounts follow the same rules.

## D-029 · Who holds which Supabase key

**Decision:**

- Every teammate's `.env.local` holds the cloud dev project's URL, its publishable key and `CLOUD_DEV_ACCOUNT_PASSWORD` (D-028). Adrian sends it privately: never in the group chat, an issue or a PR.
- The secret key stays with Adrian. Nothing uses it yet (STORY-01 design §0). The first design that needs it for an `app/api` route handler names who else holds it.

**Why:** Least privilege. The publishable key is safe to hand out, because Row-Level Security limits what it can do. The secret key bypasses RLS: every extra copy is one more place it can leak from, and a leak means rotating it for everyone.

**Rejected:** One identical `.env.local` for all four of us, with the secret key in it.

**Revisit:** The first design that needs `lib/supabase/admin.ts`.

## D-030 · Board automation

**Decision:** The project board (D-022) runs four built-in workflows: sub-issues are added automatically; anything added starts in Product Backlog; a pull request that closes an issue moves it to Code Review; closing an issue moves it to Done. Only issues are cards, never pull requests. "Pull request merged" and "Auto-close issue" stay off. The [board guide](guides/board-guide.md#automation) lists them.

**Why:** Cards should follow the work without anyone remembering to move them. On 26 Sep every workflow except the sub-issue one was found off, because the columns they set no longer existed. STORY-01 and its four tasks were closed but still sat in Sprint 1 Backlog and Code Review. One card per task keeps the five course columns readable.

**Rejected:** Moving every card by hand (it went stale within a day); pull requests as cards too (each task would appear twice); "Auto-close issue" (dragging a card to Done would close an issue whose pull request hasn't merged).

**Revisit:** If the course asks to see pull requests on the board.

## D-031 · One set of design tokens, light mode only

**Decision:**

- Every color, font and corner radius comes from the design tokens in `app/globals.css`. Components use token classes such as `bg-primary`, never raw hex values or a palette of their own.
- Sprint 1 ships light mode only. There is no theme switch, and the unused neutral `.dark` block is removed.
- The shadcn/ui controls are at least 48×48 px (SRS §3.2.2). Their smaller generated sizes are removed, so no story can pick one.

**Why:** Contrast is checked once per token pair, in STORY-02's design, and every page inherits the result. A second theme would double those checks, and no requirement asks for one.

**Rejected:** Colors chosen per page (contrast fixes drift apart); dark mode in Sprint 1; shadcn's default 24–36 px control sizes.

**Revisit if:** A story needs dark mode. It adds a `.dark` block whose pairs pass the same checks.

## D-032 · Administrator portal access

**Decision:** The `admin` role may open every portal: `/admin`, `/seeker` and `/host`. Seekers may open only `/seeker`, and Hosts only `/host`.

**Why:** Administrators verify spaces and moderate reviews and listings (SRS §3.1.5, FR-5.1, FR-5.2), which means seeing what Seekers and Hosts see. This settles the Sprint 1 brief's question and matches what STORY-06's tests assume.

**Rejected:** Restricting Administrators to `/admin`, which would leave them auditing the other portals through separate test accounts.

**Revisit:** If role impersonation or a separate auditor view is introduced.

## D-033 · Illustrative examples on the public landing page

**Decision:** Allow a photo hero, Host promotion, an explanatory panel and four clearly illustrative, noninteractive example cards as a follow-up to the original STORY-02 shell. Label examples "illustrative spaces, not live listings". No card links, buttons or tab stops; no search-like controls, seat counts, "open now" or availability states. Calls to action target `/register`, `/login` or `#how-it-works`. D-002 remains unchanged: examples never represent live inventory.

Use free-license Unsplash or Pexels photography with no identifiable people. Verify and record each photo's source page URL, photographer and license in the STORY-02 design; commit sensibly compressed assets rather than hotlinking. Text uses `rem` and must reflow with enlargement.

**Why:** Faith's Public reference communicates the visual direction without pretending later discovery features exist. Adrian accepted option A in [PR #117](https://github.com/dreeyanzz/studyhub/pull/117#issuecomment-5866841931). This decision documents that direction for review; it does not mark the follow-up implemented.

**Timing:** Merge the canonical design revision first, then create its estimated task. Build from fresh `main` after #116 and only once Adrian confirms Sprint 1 Musts (STORY-03, 04 and 05) are safe, or early Sprint 2.

**Rejected:** Filtering invented examples, clickable example inventory, implied availability, hotlinked/unattributed stock, and displacing Sprint 1 Musts to ship this Should.

**Revisit:** When real discovery lands in STORY-08; any real search controls follow that story's approved design.

## D-034 · AI agents review, and approve only on their human's instruction

**Decision:**

- An AI agent may review any pull request. Its review follows the agent review standard in [the reviewing guide](guides/reviewing-and-merging.md#ai-agents).
- It submits that review as an approval only when its human explicitly tells it to, for that pull request, after reading the review. The required checks must be green and nothing blocking may remain. Otherwise it submits the review as a comment, or as a request for changes.
- It never approves a pull request it opened, and it never merges.
- Every agent review ends with a line naming the tool and the human who authorized it. An approval counts as that human's review: they own it, as they own the code they merge (D-014).
- `.claude/settings.json` no longer blocks `gh pr review`. Merging stays blocked.

**Why:** Waiting for reviews held up Sprint 1's critical path: #115, #118 and #119 merged without one. The agents already read the design, run the checks and test the pages, so they can write the review. Tying each approval to a named person's instruction keeps CPEPE361's peer review and the Final phase's authorship check honest.

**Rejected:** Agents approving whenever they find nothing blocking, which would give approvals with no person behind them. Reviews only, with a person still clicking Approve, which adds a manual step once that person has read the review.

**Revisit if:** The course forbids AI-submitted approvals, or an agent's approval lets a real defect through.

## D-035 · AI agents keep the project board current on their human's instruction

**Decision:**

- When its human asks, an AI agent may update any card on the project board (D-022), not only its own human's. It may move a card between columns and set its points, estimate, MoSCoW and sprint. The [board guide](guides/board-guide.md#commands-for-agents) has the commands.
- When it moves another person's card to a new column, it leaves a one-line comment on that issue saying what moved and why, so the owner isn't surprised.
- Done stays automatic (D-030): an agent never moves an open issue to Done. Closing the issue does that, and agents still close issues only when asked, and then only as "not planned".
- The WIP limits and Maria's weekly check still apply.

**Why:** Cards lag behind the work whenever their owner is busy. On 30 Sep, TSK-04.4 had a pushed branch while its card sat in Sprint 1 Backlog, and STORY-06 sat in Sprint 1 Backlog with its design PR in review. Adrian's agent found both while reporting status but couldn't fix them. The board is what the course screenshots.

**Rejected:** Keeping "never move another person's cards" (the board goes stale, and fixing it falls to clicking by hand); agents moving cards without being asked (surprise moves on other people's work); agents dragging cards to Done (it would show unmerged work as finished, which D-030's automation exists to prevent).

**Revisit if:** A card an agent moved misstates someone's work, or the course asks that only a card's owner moves it.

## D-036 · Sprint 2 builds every Must Have

**Dates moved by D-045**, which ends Sprint 2 on Tuesday 1 December.

**Decision:**

- Sprint 2 (Saturday 10 to Friday 23 October) holds every Must Have story, 55 points: STORY-07, STORY-08, STORY-09, STORY-10, STORY-11, STORY-12 and STORY-15 (D-037).
- STORY-09 (holds and sandbox payments) and STORY-10 (QR check-in and release) move in from Sprint 3. Adrian builds all of STORY-09, alongside STORY-07.
- As in Sprint 1, Adrian, the database owner, writes every migration, policy and pgTAP test, including the database half of STORY-08, STORY-10 and STORY-15.
- There is no cut line. If the critical path (STORY-07, then STORY-09, then STORY-10) slips, the Sprint 2 review decides what carries over.
- Sprint 3 keeps the Should Haves (STORY-13, STORY-14), any carry-over, and the preparation for Week 12.

**Why:** Adrian wants most of the application's core features in place at the Prefinal. The SRS measures the product by one journey, from finding a venue to holding a seat (SRS §3.2.1), and the drafts finished it only in Sprint 3. Sprint 1 delivered 44 points, five days early.

**Rejected:** The Sprint 2 draft's scope, discovery and the seat map only (34 points; no Seeker could hold a seat at the Prefinal); the booking journey without check-in (about 47 points); a cut line moving STORY-10 to Sprint 3 if STORY-09's hold wasn't merged by Monday 19 October; splitting STORY-09 between Adrian and Luke; Luke writing STORY-08's and STORY-10's migrations himself.

**Revisit:** At the Sprint 2 review, against what actually merged.

## D-037 · An Administrator makes a Space public

**Decision:**

- A new Space stays Pending until an Administrator approves it on `/admin`; a rejected Space stays hidden (FR-5.1). This is STORY-15 (#166), in Sprint 2: James builds the page and its actions, and Adrian adds the policy.
- Only an Administrator may change `spaces.status`, through a policy and a grant for that column alone. Hosts and Seekers are never granted it (STORY-01).
- Rejection reasons, and sending an edited Space back to Pending (D-027), wait for STORY-14 or later.

**Why:** Search (STORY-08) shows only Verified Spaces, and the verification queue was planned for Sprint 3 (STORY-14). Without an approval step, a Host's new Space could never go public during the Prefinal demo.

**Rejected:** Seeding Verified Spaces for the demo (a new Space would never go public, so FR-5.1 would only be faked); keeping verification in STORY-14 and letting that story span two sprints.

**Revisit:** STORY-14's design, for rejection reasons and re-verification.

## D-038 · Tracking

Supersedes D-022, which named the second column "Sprint 1 Backlog" for good.

**Decision:**

- A GitHub Project with the course's five columns: Product Backlog, Sprint N Backlog, In Progress, Code Review, Done.
- The second column is renamed when each sprint starts: "Sprint 2 Backlog" now, then "Sprint 3 Backlog", as the [board guide](guides/board-guide.md) already says.
- Each story is a STORY-xx parent issue, with TSK sub-issues for its tasks.
- Estimates use points (1–10) and days.
- WIP limits: In Progress ≤ 4, Code Review ≤ 4.

Maria maintains the board; Adrian is Project Manager.

**Why:** The course screenshots the board each sprint, and its second column should name the sprint it shows. The board guide said to rename it while D-022 still named it "Sprint 1 Backlog", and the Sprint 2 draft asked which one wins (its §8.2).

**Rejected:** A permanent "Sprint Backlog" column (a screenshot wouldn't say which sprint it shows); a new column for each sprint (the course allows exactly five).

**Revisit if:** The course names the columns for Sprint 2 or 3 itself.

## D-039 · The seat map is a 6-column grid per zone

**Withdrawn by D-043**, with STORY-07's design. A new design may propose it again.

**Decision:**

- Each zone of a Space's seat map is a band 6 cells wide, with as many rows as it needs. A seat or a standing desk takes one cell, and a whole room takes 2 or 3 cells in one row. Cells may stay empty, for aisles and gaps.
- The database rejects two units on overlapping cells, with an exclusion constraint, whatever the app checks first.
- Each change in the builder (adding, editing, moving or removing a unit, or changing a zone) saves at once through its own Server Action (D-010). There is no draft and no "Save layout" button.

**Why:** Six cells of 48 px fit a 360 px screen without scrolling sideways (SRS §3.2.2), and the bands match SRS Figure 3. One grid shape lets Hosts and Seekers share one renderer, so a saved map renders the same for both (FR-3.1). Saving each change keeps the grid and the list view on the same actions, and a closed tab loses nothing.

**Rejected:** Units in order with no positions (simplest, but no gaps, aisles or real layout); one floor-plan grid for the whole Space, with zones as areas on it (the most work, and a phone can't show it without zooming or scrolling sideways); editing a draft and saving the whole map at once (one large save, and the list view would need the same draft).

**Revisit if:** Hosts need rows wider than 6 cells, or rooms that span rows.

## D-040 · Venue photos are public

**Withdrawn by D-043**, with STORY-07's design. A new design may propose it again.

**Decision:**

- Venue photos live in a public Supabase Storage bucket, `space-photos`, at `<space_id>/<file name>`. Each is at most 5 MB, and JPEG, PNG or WebP.
- Only the Host who owns the Space may upload, replace or delete its photos. Listing them follows the Space's own visibility (STORY-01).
- Deleting a Space removes its photos first: `deleteSpace` empties the Space's folder through the Storage API, then deletes the row. Once the row is gone, no policy matches those photos, and the bucket is public.

**Why:** Photos are for everyone who can see the Space (FR-1.3), and plain URLs keep STORY-11's gallery simple.

**Rejected:** A private bucket with short-lived signed URLs: tighter, but more work for STORY-11, and it protects little, because the photos become public once the Space is Verified.

**Accepted risk:** Anyone who has the exact URL of a Pending or Rejected Space's photo can open it. Nothing publishes those URLs.

**Revisit if:** A photo ever needs to stay private, such as a document for verification.

## D-041 · The Host-updated time counts only the Host's own changes

**Withdrawn by D-043**, with STORY-07's design. A new design may propose it again.

**Decision:**

- `units.state_updated_at` is when the Host last set or confirmed a unit's state. It is set when the Host adds the unit, and by every state change the Host makes: STORY-12's one-tap change, walk-ins included, and the check-ins and check-outs a Host records (STORY-10).
- Changes made by the system or by a Seeker leave it alone: a hold starting or lapsing (STORY-09), and a no-show or closing-time release (STORY-10).
- No trigger sets it. The database functions that let a Host change a state set it themselves.

**Why:** "Host-updated · X min ago" (D-002) tells a Seeker how long ago the Host last vouched for the map, and the Sprint 2 Definition of Done says it shows when a Host last updated it. If a lapsed hold moved the time, a seat the Host last checked at 9:00 would read "Host-updated · 2 min ago" at 11:12. A trigger can't tell the two kinds of change apart, because a lapsed hold can be released inside the Host's own request (expiry runs on read and on write, D-011).

**Rejected:** A trigger that stamps every state change (the label would overstate freshness); a trigger that stamps only when the caller is the Space's Host (wrong whenever a release runs in the Host's own request); a second timestamp for changes of any kind (nothing reads it yet).

**Revisit if:** A surface needs the time of the last change of any kind.

## D-042 · Maria owns the user experience

**Decision:**

- Maria decides the user experience of every story: what users see, do and are told. That covers screens and the order of steps, wording, empty, loading and error states, accessibility, the design system, and journeys that cross stories, such as a Seeker going from search to a hold.
- What the system allows, stores and enforces stays with the owner of the rule: Adrian for data and money, Luke for security. Where the two meet, both approve, and the design doc or D-entry names both. For example, Maria proposes how long a Seeker has to pay, and Adrian confirms how long a held unit can stay unavailable to everyone else. If they disagree, Adrian decides as Project Manager.
- A design doc for a story with screens needs Maria's approving review of the user's steps (§1) and the UI (§3) before Adrian merges it, unless Maria wrote it. STORY-07's design was approved before this entry, so Maria reviews its builder before that task starts; its tables don't wait.
- GitHub asks for Maria's review on design docs and on code pull requests that change UI files (`.github/CODEOWNERS`), but Maria's approval is required only on designs with screens. Everyone still builds and owns their own pages.

**Why:** Maria leads the design system (STORY-02, D-031) and set the landing page's direction (D-033). Every Sprint 2 story has screens, and one owner keeps them consistent. It also evens out Sprint 2, where Maria has 8 points and Adrian 25. Rules stay with their owners, so nobody has to defend a choice outside their own area in the Final phase.

**Rejected:** Each story's owner deciding its own screens (four people, four styles); Maria deciding everything a user meets, rules included (Row-Level Security and the payment check meet users too, and neither is UX); Maria's approval on every code pull request (the build would queue behind one reviewer); a UX review after the build (changes cost more by then).

**Revisit if:** Maria's reviews start to hold up the critical path.

## D-043 · Sprint 2's story designs start again

**Decision:**

- Sprint 2's story work starts again from its plan. STORY-07's design (#169) is withdrawn, so no Sprint 2 story has an approved design, and each one goes through its design doc again (D-016).
- D-039, D-040 and D-041 are withdrawn with it. A new design may propose any of them again.
- What set up Sprint 2 stays: its plan and brief, D-036, D-037, D-038 and D-042. So do the Sprint 1 bug fixes merged during Sprint 2 (#164, #165).
- D-042's note on STORY-07's earlier design no longer applies: the new design gets Maria's review like every other.

**Why:** The flows that cross stories, such as a reservation from its hold to its check-in, were not decided before the stories were designed, and Sprint 2's designs depend on each other. STORY-07's design had already fixed choices that belong to the stories it feeds: D-041 decided what moves the Host-updated time before STORY-11 or STORY-12 had a design.

**Rejected:** Keeping STORY-07's design and designing the other stories around it (its choices would bind stories designed later); deleting the withdrawn entries (this log is append-only).

## D-044 · Shared flows are decided before the story designs that use them

**Decision:**

- A flow that crosses stories gets its own doc in `docs/flows/`, drawn in Mermaid, and it is merged before any story design that uses it is written. This extends D-016. The design links the flow in its §1 and draws only its own part. It never re-decides a shared flow: changing one is a pull request to the flow doc. A flow's branch and pull request use STORY-00, because it serves several stories (D-023).
- A flow crosses stories when two or more stories build or read it. It gets its own doc only if, as well, two or more stories change the same state (such as the seat state), one person's steps run through two or more stories, a caller from outside the app takes part (D-010), or a timer changes a state (D-004, D-011). Any other flow stays in its story's design, and a story that only reads what another story builds waits for that story's design.
- Who draws a flow follows D-042: Maria draws journeys, Adrian draws flows about data and money, and Luke draws flows about security. The owners of the other areas a flow touches approve it, and Adrian settles a disagreement as Project Manager. The [flows index](flows/README.md) names each flow, who draws and approves it, what it waits for, which story designs wait for it, and its status. Changing any of those is a pull request to the index, not a new entry here.
- The diagram follows the question: usually a state diagram, a sequence diagram or a swimlane, but any kind that answers the question better may be used, in a flow or in the part a story design draws itself.
- Every diagram names its tests. Each arrow of a state diagram names what makes it, such as a database function, and the pgTAP test that proves it. Everything else a diagram shows names its test or its manual check.
- A choice made in a flow or a design also gets its own entry in this log when another story builds on it, when it is costly to reverse once data exists, or when a reasonable teammate would have chosen differently.

**Why:** Three stories change the seat state (STORY-09, STORY-10 and STORY-12), a fourth shows it (STORY-11), and a fifth creates the units (STORY-07). Designed one story at a time, the first design decided for the others, as D-041 did for the Host-updated time (D-043). A shared flow decided once, before the designs, gives every story the same answer and one place to change it. Each flow is drawn by the owner of what it decides (D-042). A test named for every arrow makes the diagram the checklist the build is reviewed against, so the code can't drift from it unnoticed. "A decision between real alternatives" fits almost any choice; the three tests say which ones this log needs.

**Rejected:** Deciding a shared flow in the first story design that touches it (what D-043 undid); one design doc for all of Sprint 2 (seven stories behind one review); Adrian drawing every flow (D-042 gives the journeys to Maria and security to Luke); a doc for every flow (most flows belong to one story, and its design already draws them); diagrams as images, like `docs/course/diagrams/` (a pull request can't show what changed in one); writing a story design alongside a flow it uses, on assumptions about that flow (how STORY-07's design got ahead of the stories it feeds).

**Consequence:** D-004 and the Sprint 2 plan (§8) leave several questions to STORY-09's design, such as the lengths of the two timers, the fee and the gateway. Where another story builds on an answer, the flow that covers it settles it, and STORY-09's design links it. The plan stays as baselined (D-043).

**Revisit if:** A merged flow keeps changing while its stories are built, or most flows turn out to serve one story.

## D-045 · Sprint 2 ends on Tuesday 1 December

**Decision:**

- Sprint 2 runs from Saturday 10 October to Tuesday 1 December 2026, and its review and the Prefinal demo are on its last day. This moves only D-036's end date: Sprint 2 still holds every Must Have, 55 points.
- Sprint 3 starts after Sprint 2 ends. Its dates are set when it is planned, at the Sprint 2 review.
- The Sprint 2 plan stays as baselined (D-043). The Sprint 2 brief and the board's Sprint field change to match this entry.

**Why:** D-043 restarted every Sprint 2 story design on 20 October, and D-044 puts the shared flows before them, so no Sprint 2 story had a design by 23 October. A later deadline keeps D-036's scope, so the Prefinal demo still shows the whole booking journey.

**Rejected:** Keeping 23 October and carrying every unfinished story over to Sprint 3, as D-036 allows when the critical path slips (the Prefinal demo would show none of the booking journey); a smaller Sprint 2 (D-036 rejected the smaller drafts).

**Revisit if:** The critical path can't be merged by 1 December.
