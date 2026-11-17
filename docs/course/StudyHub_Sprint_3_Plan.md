# StudyHub — Sprint 3 Plan: UI/UX, Reviews, Administration & Hardening

> **Course**: CPEPE361 (Software Development 1)  
> **Phase**: Final Phase — Sprint 3  
> **Sprint Duration**: 20 days (Tuesday 17 November to Sunday 6 December 2026; the last merge is Saturday 5 December)  
> **Development Lifecycle**: Sprint 3 of 3
>
> - **Sprint 1 (Midterm)**: Foundation, Identity & Primary CRUD (Walking Skeleton)
> - **Sprint 2 (Prefinal)**: The Booking Journey — Discovery, Seat Map, Holds, Sandbox Payments & Check-in
> - **Sprint 3 (Final)**: UI/UX, Reviews, Administration & Hardening
>
> **Status**: Baselined Wednesday 18 November 2026 (D-075)

---

## 1. Sprint Goal

Sprint 2 built the whole booking journey, from search to check-in. Sprint 3 makes it
something we would hand to a real Seeker, and finishes the SRS's functional scope before
the Final on Monday 7 December:

1. **The UI/UX, reworked.** Most of today's screens were generated and it shows. Maria
   and James audit every screen, choose a visual direction, and restyle it (STORY-17).
2. **Community reviews**: a Seeker who checked in rates the Space, and everyone, signed
   out included, sees the averages (FR-4.1, FR-4.2, D-009, D-076).
3. **Administration**: moderating reported reviews, reading sandbox payment records, and
   issuing sandbox refunds (FR-5.2, FR-5.3).
4. **Reservation history**: a Seeker's past visits, a "Hold again" button, and an email
   when a hold is confirmed (D-077, D-078).
5. **What STORY-15 left out**: rejection reasons, resubmitting a Rejected Space, and a
   second review after a Verified Space's name or location changes (D-079).
6. **Ready for the Final**: a production database, the concurrency test in CI, journeys
   for every role, and accessibility and performance checks (STORY-19).

There is no Sprint 4 and no separate hardening week. Everything here is done before 7
December; if it isn't, the cut order in §6 says what goes first.

---

## 2. Entry Conditions — what Sprint 2 delivered

Every condition holds. Sprint 2 ended on Monday 16 November (D-072) with all 66 of its
cards in Done, so nothing carries over.

| Needed from Sprint 2                                                 | Status                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Reservations with a check-in, for reviews (STORY-10)                 | Met: #291, #299, #300, #304, #305, #307                   |
| The Space profile, where reviews and averages appear (STORY-11)      | Met: #271, #274, #276, #283, #284, #285                   |
| Payments with paid, forfeited and refunded statuses (STORY-09, -10)  | Met: #255, #262, #263, #277, #295, #296, #297             |
| The `/admin` portal and its role guard (STORY-15)                    | Met: #225, #231, #235                                     |
| Both journeys as Playwright tests, and every flow `implemented`      | Met: #321, #322, #323                                     |
| `checks`, `db` and `e2e` green on `main`                             | Met: CI passed on `f1eb706`, after the fixes #330 to #334 |

---

## 3. Team Workload & Domain Distribution

Sprint 3 splits the work by layer, not by story (D-075):

- **Maria and James own the UI/UX.** They decide the visual direction (D-042), restyle
  the existing screens, and review the new ones once they're built (D-073).
- **Adrian builds the backend**: everything in `supabase/` (tables, policies, database
  functions, pgTAP tests, seed data), `app/api/`, the Stripe refund, the confirmation
  email, the production project and CI. He also draws both shared flows and writes the
  design docs of the feature stories.
- **Luke builds the app**: `lib/data/`, `lib/validation/`, Server Actions, pages and
  components, and their Vitest and Playwright tests. He writes the screens section of
  each feature design, and approves Adrian's pull requests (D-014).

| Developer                | Role & Primary Domain             | Sprint 3 work                                                                                                 | Points |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| **Adrian Seth Tabotabo** | Backend Lead & Database Architect | The database half of **STORY-13**, **STORY-14**, **STORY-16** and **STORY-20**; **STORY-19**'s production project, CI and #218 | 17     |
| **Luke Miguel Dongque**  | Auth & Security Specialist        | The app half of the same four stories; **STORY-19**'s accessibility, performance and end-to-end tests          | 14     |
| **Maria Faith Antigua**  | Frontend Design System Lead       | **STORY-17**: the audit, the visual direction and the restyle, with James                                      | 4      |
| **James Niño Mandawe**   | Portal Shells & QA Engineer       | **STORY-17**, with Maria                                                                                       | 4      |

**Sprint total: 39 points across 6 stories**, against 55 in Sprint 2 and 44 in Sprint 1.
STORY-17's 8 points are a placeholder: the audit re-estimates it, and if it finds more
than 10 points of work the story splits, and the second half is STORY-18. The split
points for shared stories are estimates of each half.

Sprint 3 is shorter than Sprint 2 (20 days against 38), so it needs a faster pace: about
two points a day, against Sprint 2's one and a half. The cut order in §6 is the plan if
it doesn't hold.

---

## 4. Sprint 3 Backlog with MoSCoW Prioritization

| Priority            | Feature / User Need                                          | Requirement       | Story              |
| ------------------- | ------------------------------------------------------------ | ----------------- | ------------------ |
| **Must Have (M)**   | UI/UX fixes and redesign, audited screen by screen           | SRS §3.2, §3.7.1  | STORY-17           |
| **Must Have (M)**   | A production database for the Final                          | D-017             | STORY-19           |
| **Must Have (M)**   | Concurrency test in CI, journeys for every role, a11y sweep  | FR-2.5, SRS §3.2.2 | STORY-19          |
| **Should Have (S)** | Reviews restricted to checked-in Seekers                     | FR-4.1, D-009     | STORY-13           |
| **Should Have (S)** | Aggregate ratings, editing and reporting a review            | FR-4.2, D-076     | STORY-13           |
| **Should Have (S)** | Review moderation                                            | FR-5.2            | STORY-14           |
| **Should Have (S)** | Sandbox payment records and refunds                          | FR-5.3            | STORY-14           |
| **Should Have (S)** | Reservation history and Hold again                           | D-077             | STORY-16           |
| **Could Have (C)**  | Rejection reasons and resubmitting a Rejected Space          | FR-5.1, D-079     | STORY-20           |
| **Could Have (C)**  | A second review after a name or location edit                | D-027, D-079      | STORY-20           |
| **Could Have (C)**  | An Administrator taking a Verified Space down                | FR-5.2, D-079     | STORY-20           |
| **Could Have (C)**  | Email on hold confirmation                                   | D-078             | STORY-16           |
| **Won't Have (W)**  | Sorting or filtering search by rating                        | D-076             | After the course   |
| **Won't Have (W)**  | Real-money settlement                                        | SRS §1.2, D-005   | Future release     |
| **Won't Have (W)**  | Advance or scheduled bookings                                | D-001             | Out of scope       |
| **Won't Have (W)**  | Occupancy sensors                                            | D-002             | Out of scope       |

---

## 5. Stories & Task Decomposition

Every story still needs its own merged design doc before code starts (D-016), and every
design waits for the shared flows it uses (D-044). The tasks below are the expected
shape of each design's build order, not a substitute for it. Each task names who builds
it.

---

### [STORY-17] UI/UX Refresh — issue #336

- **Story**: _As anyone using Worq, I want screens that are clear, consistent and quick to use on a phone, so that finding and holding a seat feels effortless._
- **Story Points**: `8 / 10` (re-estimated after the audit)
- **Time Estimate**: `4 Days`
- **Assignee**: `Maria Faith Antigua`, `James Niño Mandawe`
- **Git Branch**: `feature/STORY-17-ui-ux-refresh`
- **MoSCoW**: `Must Have`
- **Requirements**: SRS §3.2.1, §3.2.2, §3.7.1 · **Decisions**: D-031, D-042, D-073, D-074, D-075

#### Tasks

1. The audit: every route at 360, 768 and 1024 px, with text at 200% and with the
   keyboard only. Each finding is sorted (D-075): a **fix** makes a screen match its
   merged design, and becomes a bug issue under the story that built the screen; a
   **design change** alters what the design says, and comes here.
2. The visual direction, in this story's design doc: what changes in layout, type,
   spacing, components and wording, tried on one key screen first. Maria and James decide
   it (D-042).
3. The restyle, one task per group of screens: public pages and discovery; the Seeker's
   dashboard, hold and payment pages; the Host portal; the Administrator portal.
4. Reviewing the screens STORY-13, STORY-14, STORY-16 and STORY-20 add, once each is
   built, and restyling what doesn't fit (D-073).
5. Each restyle updates the tests it breaks, in the same pull request, and checks WCAG 2.1
   AA contrast and 48 × 48 px controls (SRS §3.2.2, D-031).

#### Acceptance criteria

- [ ] Every route is audited, and every finding is filed as a fix or listed as a design
      change.
- [ ] The visual direction is in the design doc before the restyle starts.
- [ ] Every restyled screen meets WCAG 2.1 AA contrast and keeps 48 × 48 px controls.
- [ ] The new feature screens are reviewed once they're built, and restyled where unfit.

---

### [STORY-13] Community Reviews & Ratings — issue #78

- **Story**: _As a Seeker who actually visited, I want to review the amenities, so that other Seekers can trust what a space claims._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Adrian Seth Tabotabo` (the database), `Luke Miguel Dongque` (the app)
- **Git Branch**: `feature/STORY-13-reviews`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-4.1, FR-4.2, SRS §3.5.2 · **Decisions**: D-009, D-076

#### Tasks

1. Migration (Adrian): a reviews table (the reservation, the Space, the author, four 1–5
   ratings, an optional comment of up to 500 characters, a moderation status, and when
   it was edited) and a table of reports.
2. RLS and functions (Adrian) enforcing D-009 in the database: only the Seeker of a
   reservation with a check-in at that Space can review it, once per reservation; only
   the author can edit or delete it, and never a hidden or removed one; anyone, signed
   out included, reads the visible reviews, with the author shown by first name and last
   initial.
3. The averages (Adrian): each of the four, and the overall, over visible reviews only.
4. pgTAP negatives (Adrian): a Seeker with no check-in **cannot** insert a review; a
   second review of one reservation is refused; another user gets **0 rows** when
   editing someone's review; the author **cannot** edit a hidden one.
5. The review form (Luke): a Server Action with its Zod schema, on the Space profile and
   from STORY-16's history, shown only to an eligible Seeker.
6. The reviews and averages on the Space profile, and the overall average on STORY-08's
   Space card (Luke).
7. Editing, deleting and "Report this review" (Luke). Review text renders as text, never
   as HTML (SRS §3.5.2), with a test.
8. Regenerate `lib/supabase/database.types.ts` (Adrian).

#### Acceptance criteria

- [ ] A user without a check-in at a Space cannot post a review for it, enforced in RLS.
- [ ] Each checked-in reservation allows at most one review.
- [ ] The author can edit ("edited" shows) or delete their review; a hidden or removed
      one can't be edited back into view.
- [ ] The averages on the profile and the Space card match the visible reviews, and a
      signed-out visitor can read them.
- [ ] A reported review is flagged for Administrator moderation.

---

### [STORY-14] Administration Console — issue #79 _(re-scoped)_

- **Story**: _As an Administrator, I want to moderate reported reviews and oversee sandbox payments, so that the platform stays trustworthy._
- **Story Points**: `7 / 10`
- **Time Estimate**: `3.5 Days`
- **Assignee**: `Adrian Seth Tabotabo` (the database and the refund), `Luke Miguel Dongque` (the pages)
- **Git Branch**: `feature/STORY-14-admin-console`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-5.2, FR-5.3 · **Decisions**: D-005, D-013, D-076

Space verification moved to STORY-15 in Sprint 2 (D-037), and its follow-ups move to
STORY-20 now, so that this story stays within 10 points. It adds its queues to the
`/admin` portal STORY-15 created.

#### Tasks

1. Moderation functions (Adrian): read the reported reviews, and hide or remove one,
   for Administrators only. A hidden or removed review leaves the profile and the
   averages.
2. Payment records (Adrian): an Administrator reads every sandbox payment, paid,
   forfeited or refunded, with its reservation and Space.
3. The sandbox refund (Adrian): a Stripe test-mode refund for a hold a Host can't honour,
   recorded on the payment as refunded (D-005, D-070).
4. pgTAP negatives (Adrian): a Seeker or Host gets **0 rows** from the admin queues and
   **cannot** hide or remove a review or issue a refund.
5. The moderation page on `/admin` (Luke): reported reviews, with hide and remove.
6. The payments page on `/admin` (Luke), with its Refund action; the Seeker's reservation
   page shows the refund.
7. A Playwright test (Luke): an Administrator removes a reported review, and the average
   changes.

#### Acceptance criteria

- [ ] A removed review no longer appears on the profile or in the averages.
- [ ] An Administrator reads paid, forfeited and refunded payments.
- [ ] A sandbox refund updates the payment's status, and the Seeker sees it.
- [ ] A Seeker or Host attempting any admin action gets 0 rows and a refused write.

---

### [STORY-16] Reservation History & Hold Again — issue #335

- **Story**: _As a Seeker, I want to see my past visits and hold the same seat again, so that going back to a Space I liked takes one tap._
- **Story Points**: `6 / 10`
- **Time Estimate**: `3 Days`
- **Assignee**: `Adrian Seth Tabotabo` (the database and the email), `Luke Miguel Dongque` (the pages)
- **Git Branch**: `feature/STORY-16-reservation-history`
- **MoSCoW**: `Should Have` (the email: `Could Have`)
- **Requirements**: none in the SRS (a Sprint 3 addition, D-075) · **Decisions**: D-001, D-013, D-077, D-078

#### Tasks

1. A database function (Adrian) returning the Seeker's past reservations: Space, unit,
   dates, how it ended, its payment status, and whether it has a review. Reservations are
   read only through functions, so this is new.
2. pgTAP negatives (Adrian): another Seeker gets **0 rows**, and so does a Host.
3. The confirmation email (Adrian): when the payment webhook confirms a hold, Resend
   sends the Seeker one email, never two for a repeated event. Local tests and CI never
   call Resend (D-078).
4. The history page on the Seeker's dashboard (Luke): newest first, with an empty state.
5. Hold again (Luke): opens the Space profile with the same unit picked in STORY-09's
   hold panel if it is Available now, and otherwise shows the seat map and says why
   (D-077).
6. "Leave a review" on a visit with no review, opening STORY-13's form (Luke).
7. Tests (Luke): Vitest for Hold again's rules; a Playwright journey from a completed
   visit to Hold again.

#### Acceptance criteria

- [ ] A Seeker sees their own past reservations, newest first, and nobody else's.
- [ ] Hold again opens the profile with the unit picked when it is Available, and says
      why when it isn't. It never holds anything by itself.
- [ ] A checked-in visit with no review links to the review form.
- [ ] A confirmed payment sends one confirmation email.

---

### [STORY-20] Space Verification Follow-ups — issue #338

- **Story**: _As a Host, I want to know why my Space was rejected and send it back once I've fixed it, so that one mistake doesn't end my listing._
- **Story Points**: `5 / 10`
- **Time Estimate**: `2.5 Days`
- **Assignee**: `Adrian Seth Tabotabo` (the status rules), `Luke Miguel Dongque` (the pages)
- **Git Branch**: `feature/STORY-20-verification-follow-ups`
- **MoSCoW**: `Could Have`
- **Requirements**: FR-5.1, FR-5.2 · **Decisions**: D-027, D-037, D-054, D-079

Split out of STORY-14. Its design waits for the Space verification flow's Sprint 3 change
(#340), which also says what happens to a Space's active holds when it leaves Verified.

#### Tasks

1. Migration (Adrian): a rejection reason; the Host's resubmission of a Rejected Space;
   a name or location edit sending a Verified Space back to Pending; an Administrator
   taking a Verified Space down.
2. pgTAP (Adrian): a Host **cannot** make a Space Verified or Rejected, their own
   included; a rejection with no reason is refused; a name edit moves a Verified Space to
   Pending, and an edit to its hours doesn't.
3. `/admin` (Luke): a reason on Reject, an "Edited" mark in the queue, and Take down.
4. The Host portal (Luke): the rejection reason, Resubmit, and a warning before a name or
   location edit.
5. A Playwright journey (Luke): reject with a reason, the Host fixes and resubmits, and
   an Administrator approves.

#### Acceptance criteria

- [ ] Rejecting a Space needs a reason, and its Host sees it.
- [ ] A Host can resubmit a Rejected Space for a second review.
- [ ] A name or location edit sends a Verified Space back to Pending, after a warning,
      and its active holds keep running.
- [ ] Only an Administrator makes a Space Verified or Rejected.

---

### [STORY-19] Final Hardening — issue #337

- **Story**: _As the team, we want the Final build on a production database, tested end to end for every role, and checked for accessibility and speed, so that the Final demo runs on something we trust._
- **Story Points**: `5 / 10`
- **Time Estimate**: `3 Days`
- **Assignee**: `Adrian Seth Tabotabo` (production, CI and #218), `Luke Miguel Dongque` (accessibility, performance and the end-to-end tests)
- **Git Branch**: `feature/STORY-19-final-hardening`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-2.5, SRS §3.2.2, §3.4 · **Decisions**: D-008, D-013, D-017, D-061

#### Tasks

1. The production Supabase project (Adrian, D-017): every migration applied, the Final
   deployment pointed at it, and its demo accounts following D-013 and D-061. Created
   early, not on the last day.
2. The concurrency tests (`npm run db:race`) in CI (Adrian, FR-2.5).
3. #218 decided and recorded (Adrian).
4. Playwright journeys for every role, the Administrator's included (Luke).
5. An accessibility sweep of every route against WCAG 2.1 AA (Luke, SRS §3.2.2).
6. Search time, First Contentful Paint and Largest Contentful Paint measured on the
   deployment against SRS §3.4, and the results recorded (Luke).
7. The Definition of Done check of every Sprint 3 story, before the last merge (Adrian).

#### Acceptance criteria

- [ ] The Final deployment runs on the production project.
- [ ] `npm run db:race` runs in CI.
- [ ] Every role's journey is a Playwright test.
- [ ] Every route passes the accessibility sweep, and the performance results are
      recorded.

---

## 6. Sequencing, Cut Order & Risks

There are no dates inside the sprint (D-075). Each piece starts as soon as what it needs
is merged, and the only fixed point is the **last merge on Saturday 5 December**, which
leaves a day to check the deployed build before the Final.

| This story | Waits for                                                                              | Because                                                      |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| STORY-17   | Nothing; its review of the new screens waits for each of them                          | The audit and the direction start on day one                 |
| STORY-13   | The review lifecycle flow (#339)                                                       | Reviews change state from three stories (D-044)              |
| STORY-14   | The review lifecycle flow, and STORY-13 tasks 1–2                                      | It moderates the reviews STORY-13 stores                     |
| STORY-16   | Nothing; its "Leave a review" link waits for STORY-13's form                           | The reservation lifecycle it reads is merged                 |
| STORY-20   | The Space verification flow's Sprint 3 change (#340)                                   | It adds moves to a merged flow                               |
| STORY-19   | Nothing for the production project; the final checks wait for the other stories        | The Final needs the database early                           |

**Critical path:** the review lifecycle flow → STORY-13's design → STORY-13's tables →
STORY-13's and STORY-14's screens → Maria and James's review of them → the last merge.
Adrian is on most of it, so his database pull requests are reviewed and merged first,
and Luke builds his pages against sample data until they land.

**Cut order.** If 5 December comes too close, work is cut from the bottom up (D-075):

1. UI/UX fixes
2. UI/UX design changes
3. Reviews (STORY-13) and moderation (STORY-14)
4. Reservation history and Hold again (STORY-16)
5. Sandbox refunds (STORY-14)
6. Rejection reasons, resubmitting and the second review (STORY-20)
7. Taking a Space down (STORY-20)
8. The confirmation email (STORY-16)

The production project (STORY-19) isn't on the list, because the Final can't run
without it (D-017).

**Risks.**

- **The pace.** 39 points in 20 days is faster than Sprint 2. The cut order is the
  answer, decided now rather than on 5 December.
- **One merger, one database writer.** Adrian holds the backend of five stories and
  merges every pull request. Database work goes first, so nobody waits on it at the end.
- **Two people changing the same screens.** The restyle and the feature stories touch
  the same pages. Small pull requests merged often keep conflicts small, and after a
  restyle, a change to that screen's look needs Maria's or James's approval (D-074).
- **Email reaches one inbox.** Without a domain, Resend delivers only to its account
  owner (D-078), so the demo uses that address.

---

## 7. Project Management Board Mapping

The board keeps the five columns the course requires. At the start of Sprint 3 the second
column is renamed **Sprint 3 Backlog** (D-038). WIP limits stay at 4 for In Progress and
4 for Code Review.

| Card ID    | Card Title                          | Column (at baselining) | Assignee                    | Points | Time Est. | MoSCoW      |
| ---------- | ----------------------------------- | ---------------------- | --------------------------- | ------ | --------- | ----------- |
| `STORY-17` | UI/UX Refresh                       | Sprint 3 Backlog       | Maria Faith Antigua, James  | 8 / 10 | 4 Days    | Must Have   |
| `STORY-13` | Community Reviews & Ratings         | Sprint 3 Backlog       | Adrian, Luke Miguel Dongque | 8 / 10 | 4 Days    | Should Have |
| `STORY-14` | Administration Console              | Sprint 3 Backlog       | Adrian, Luke Miguel Dongque | 7 / 10 | 3.5 Days  | Should Have |
| `STORY-16` | Reservation History & Hold Again    | Sprint 3 Backlog       | Adrian, Luke Miguel Dongque | 6 / 10 | 3 Days    | Should Have |
| `STORY-20` | Space Verification Follow-ups       | Sprint 3 Backlog       | Adrian, Luke Miguel Dongque | 5 / 10 | 2.5 Days  | Could Have  |
| `STORY-19` | Final Hardening                     | Sprint 3 Backlog       | Adrian, Luke Miguel Dongque | 5 / 10 | 3 Days    | Must Have   |

**Issue mapping.** `STORY-13` #78 · `STORY-14` #79 · `STORY-16` #335 · `STORY-17` #336 ·
`STORY-19` #337 · `STORY-20` #338. The shared flows are #339 (review lifecycle) and #340
(the Space verification flow's Sprint 3 change). STORY-18 is kept for a second UI/UX
story if the audit splits STORY-17.

---

## 8. Decisions Taken at Baselining

The draft of this plan left three questions open (its §8). They are settled here:

1. **What does Sprint 2 carry over?** Nothing. Every Sprint 2 story merged before the
   Prefinal on 16 November (D-072).
2. **Rejection reasons and re-verifying an edited Space?** Both, in a new story,
   STORY-20, with resubmitting a Rejected Space and taking a Verified one down (D-079).
   Only a name or location edit sends a Verified Space back to Pending.
3. **Does hardening get a card?** Yes, STORY-19. It has no week of its own, because the
   Final is on 7 December (D-075).

Sprint 3 planning also settled these:

- **Scope, dates, the split by layer, and the cut order** (D-075).
- **Maria and James review the feature screens after they're built**, not in the design
  docs (D-073).
- **Maria's and James's built UI wins** over older flows and design docs on what users
  see, below the SRS and the decisions (D-074).
- **Reviews**: four ratings and a comment, allowed from check-in with no deadline,
  editable, public, with reviewers shown by first name and last initial (D-076).
- **Hold again** opens the Space profile with the same unit picked, and never holds
  anything by itself (D-077).
- **The confirmation email** goes through Resend's free tier, with no domain (D-078).

The designs settle the rest:

- STORY-13: the tables' names, and how reports are stored.
- STORY-14: whether a refund is recorded by the refund call or by Stripe's webhook.
- STORY-16: how tests check the email without calling Resend.
- STORY-19: how `db:race` runs in CI.
- STORY-20, through the flow change: what status a taken-down Space has, and what
  happens to its holds.

---

## 9. Definition of Done

The Sprint 1 Definition of Done applies unchanged
([`StudyHub_Sprint_1_Plan.md`](StudyHub_Sprint_1_Plan.md) §6), and so do Sprint 2's four
checks ([`StudyHub_Sprint_2_Plan.md`](StudyHub_Sprint_2_Plan.md) §9): seat map parity,
freshness honesty, no double booking, and sandbox only.

Sprint 3 adds four:

- **Fix or design change**: every UI change is one or the other. A fix cites the story
  that built the screen, and a design change belongs to STORY-17 (D-075).
- **Built UI first**: after Maria or James restyle a screen, a change to its look has
  their approval (D-074).
- **Reviews are honest**: only a Seeker with a check-in can review, and the averages
  count visible reviews only (D-009, D-076).
- **Accessible everywhere**: every route passes the WCAG 2.1 AA sweep (SRS §3.2.2).

_End of Sprint 3 Plan._
