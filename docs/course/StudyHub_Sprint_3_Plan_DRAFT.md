# StudyHub — Sprint 3 Plan (DRAFT): Holds, Sandbox Payments, Check-in & Administration

> **Course**: CPEPE361 (Software Development 1)
> **Phase**: Final Phase — Sprint 3
> **Sprint Duration**: 2 Weeks (Weeks 10–11)
> **Development Lifecycle**: Sprint 3 of 3
>
> - **Sprint 1 (Midterm)**: Foundation, Identity & Primary CRUD (Walking Skeleton)
> - **Sprint 2 (Prefinal)**: Space Discovery & Snap-Grid Seat Map Builder
> - **Sprint 3 (Final)**: Exact-Seat Holds, Sandbox Payments, Check-in & Moderation

---

## 0. Status: this is a draft, and it is the more speculative of the two

**Status: `DRAFT` — not baselined. Nothing here is committed work.**

This plan sits two sprints away from today. It is written now so the team can see the
whole arc and so the Sprint 1 and 2 schemas are built with the end in mind — reservations
and payments are the hardest part of StudyHub, and the schema decisions that make them
possible are taken much earlier than this sprint.

The same rules as the Sprint 2 draft apply, and more strongly:

- **No card moves, no issue is created or re-scoped, and no code starts** because of this
  document. The plan gate (D-016) still applies to every story here.
- **This draft depends on a draft.** It assumes the Sprint 2 draft is adopted roughly as
  written. If Sprint 2 changes, this changes with it.
- **Two timer lengths are deliberately left blank** — the payment window and the wait
  window. D-004 says STORY-09's design doc decides them, and this plan does not
  pre-empt it.

**What makes it real.** This becomes the Sprint 3 plan when, at the Sprint 2 review:

1. Every Sprint 2 story is Done, or explicitly carried over with its points re-estimated.
2. The entry conditions in §2 hold — above all a seat map whose units have a real state.
3. The open questions in §8 are settled, above all the sandbox gateway choice, which has
   a lead time this plan cannot absorb.
4. Adrian merges a pull request applying §10.

---

## 1. Sprint Goal

Close the loop the SRS was written around: a Seeker holds an exact open unit, pays a
sandbox reservation fee to guarantee it, travels within a wait window they chose, and
checks in with a QR code. Administrators can then verify venues, moderate reviews and
oversee sandbox payments.

Concretely:

1. **Reserve-now holds** on an exact unit, one active hold per unit and per Seeker,
   enforced in a single atomic transaction (FR-2.1, FR-2.5, D-008).
2. **Sandbox reservation-fee payment** through the gateway's hosted checkout, with the
   Pending-Payment gate and the payment window (FR-2.2, FR-2.3, D-005).
3. **QR check-in, check-out and no-show release**, with the fee forfeited on a no-show
   (FR-2.4).
4. **Reviews after a completed check-in**, with aggregates on the space profile
   (FR-4.1, FR-4.2, D-009).
5. **Administration**: venue verification queue, review moderation, and sandbox payment
   oversight with refunds (FR-5.1, FR-5.2, FR-5.3).

This sprint completes the SRS v2.0 functional scope. Nothing is left for a Sprint 4;
Week 12 is hardening, not features (§9).

---

## 2. Entry Conditions — what Sprint 2 must have delivered

| Needed from Sprint 2                                                 | Needed by            |
| -------------------------------------------------------------------- | -------------------- |
| `zones` and `units` with a working `seat_state`, and RLS with tests  | STORY-09, STORY-10   |
| A seat map a Seeker can read and select from                         | STORY-09             |
| Host occupancy control that stamps `updated_at`                      | STORY-10             |
| Space profile with an availability view                              | STORY-13             |
| A public-visibility flag on `spaces` that search already honours     | STORY-14             |
| Sandbox gateway account, test keys, and a reachable hosted checkout  | STORY-09 (see §8.1)  |

---

## 3. Team Workload & Domain Distribution

| Developer                | Role & Primary Domain             | Draft story responsibility                                                                   |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------- |
| **Adrian Seth Tabotabo** | Backend Lead & Database Architect | **STORY-09**: `reservations` and `payments`, the atomic hold, hosted checkout, the webhook.  |
| **Luke Miguel Dongque**  | Auth & Security Specialist        | **STORY-10**: booking token and QR, host check-in scan, check-out, no-show release.          |
| **Maria Faith Antigua**  | Frontend Design System Lead       | **STORY-13**: review form gated on check-in, aggregate ratings, reporting a review.          |
| **James Niño Mandawe**   | Portal Shells & QA Engineer       | **STORY-14**: admin console, plus the concurrency test and the final DoD verification.       |

> **Note on story numbering.** STORY-09 (#58) and STORY-10 (#59) already exist as issues.
> **STORY-10 is re-scoped here**: the Sprint 1 plan's product backlog calls it "QR
> Check-in & Review Moderation", but moderation belongs with the rest of the admin
> console, so this draft moves it to STORY-14 and leaves STORY-10 as check-in and release.
> Adopting this draft means editing issue #59's title. STORY-13 and STORY-14 are
> **proposed** and have no issue yet.

---

## 4. Sprint 3 Backlog with MoSCoW Prioritization

| Priority            | Feature / User Need                        | Requirement           | Description                                                                     |
| ------------------- | ------------------------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| **Must Have (M)**   | Exact-unit hold with a seeker-set wait window | FR-2.1, D-001        | Only an Available unit can be held; one active hold per Seeker.                 |
| **Must Have (M)**   | Pending-Payment soft lock and payment window  | FR-2.2, D-004        | The unit is withheld from others, and returns to Available if payment lapses.   |
| **Must Have (M)**   | Sandbox reservation-fee hosted checkout       | FR-2.3, D-005        | Card and e-wallet data never touch StudyHub (SRS §3.5.2).                       |
| **Must Have (M)**   | No double-booking, in one transaction         | FR-2.5, D-008        | Two concurrent holds on one unit give exactly one success.                      |
| **Must Have (M)**   | Booking token and QR check-in                 | FR-2.4               | Host scans or enters the token; Reserved becomes Occupied.                      |
| **Must Have (M)**   | Check-out, no-show release, closing release   | FR-2.4               | The unit returns to Available; a no-show forfeits the fee.                      |
| **Must Have (M)**   | Administrator venue verification queue        | FR-5.1               | An unverified venue is not shown in public search.                              |
| **Should Have (S)** | Reviews restricted to checked-in visitors     | FR-4.1, D-009        | One review per completed visit.                                                 |
| **Should Have (S)** | Aggregate ratings and review reporting        | FR-4.2               | Aggregates on the profile; reported reviews go to moderation.                   |
| **Should Have (S)** | Review moderation                             | FR-5.2               | A removed review leaves the profile and the aggregates.                         |
| **Should Have (S)** | Sandbox payment oversight and refunds         | FR-5.3               | Admin reads payment records and issues a sandbox refund.                        |
| **Should Have (S)** | Host sees remaining wait windows              | FR-3.3               | Finishes what Sprint 2's STORY-12 left as an affordance.                        |
| **Could Have (C)**  | Seeker reservation history                    | —                    | Past holds on the seeker dashboard.                                             |
| **Could Have (C)**  | Email notification on hold confirmation       | —                    | Only if Supabase's free tier allows it without new cost.                        |
| **Won't Have (W)**  | Real-money settlement                         | _Future release_     | SRS §1.2 and D-005: sandbox only, all semester.                                 |
| **Won't Have (W)**  | Advance or scheduled bookings                 | _Out of scope_       | D-001: current-state only.                                                      |
| **Won't Have (W)**  | Occupancy sensors                             | _Out of scope_       | D-002: availability stays host-maintained.                                      |

---

## 5. Draft Stories & Task Decomposition

---

### [STORY-09] Reserve-Now Holds & Sandbox Reservation-Fee Payments — issue #58

- **Story**: _As a Seeker, I want to hold an exact open unit and pay a small sandbox fee, so that the seat is guaranteed while I travel to it._
- **Story Points**: `10 / 10`
- **Time Estimate**: `5 Days`
- **Assignee**: `Adrian Seth Tabotabo`
- **Git Branch**: `feature/STORY-09-reserve-now-holds`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-2.1, FR-2.2, FR-2.3, FR-2.5 · **Decisions**: D-001, D-004, D-005, D-008, D-010, D-011

#### Draft tasks

1. Migration: `reservations` (unit FK, seeker FK, state, `wait_window`, `booking_token`,
   timestamps) and `payments` (`fee_amount`, gateway reference, status: pending, paid,
   forfeited, refunded).
2. The atomic hold: one database function that moves an Available unit to
   `pending_payment` and creates the reservation in a single transaction, rejecting a
   second concurrent attempt and rejecting a Seeker who already holds a unit (D-008).
3. RLS: a Seeker sees only their own reservations; a Host sees reservations on their own
   units; nobody can edit another person's reservation or set their own payment to paid.
4. pgTAP tests, including the negatives: another Seeker gets **0 rows**; a Seeker
   **cannot** update `state` or the payment status on their own reservation.
5. Concurrency test: two simultaneous holds on one unit, exactly one succeeds (FR-2.5).
6. Hosted-checkout redirect to the sandbox gateway, and the payment webhook as a route
   handler in `app/api/` — the only correct place for it (D-010).
7. The payment window: `pending_payment` returns to Available when it lapses. Because
   Hobby cron runs at most daily (D-011), expiry is evaluated on read and on write, not
   by a scheduled job.
8. Seeker hold UI: pick the unit, choose a wait window within the Host's bounds, pay,
   and land on the confirmation.
9. Regenerate `lib/supabase/database.types.ts`.

#### Draft acceptance criteria

- [ ] Only a unit in Available state can be selected.
- [ ] A Seeker holding one unit cannot hold a second.
- [ ] A unit in Pending Payment is not offered to any other user.
- [ ] An unpaid hold returns to Available when the payment window lapses.
- [ ] A confirmed sandbox payment yields exactly one Reserved unit and one token, and
      records the fee amount and the gateway reference.
- [ ] Two concurrent holds on one Available unit give exactly one success; the other is
      told the seat is taken.

---

### [STORY-10] QR Check-in, Wait Window & No-Show Release — issue #59 _(re-scoped)_

- **Story**: _As a Host, I want to scan a Seeker's booking QR code, so that the seat becomes Occupied and unclaimed seats release themselves._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Luke Miguel Dongque`
- **Git Branch**: `feature/STORY-10-check-in-release`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-2.4, FR-3.3 · **Decisions**: D-004, D-010, D-011

#### Draft tasks

1. Booking token generation and its QR rendering on the Seeker dashboard, with the token
   unguessable and single-use.
2. Check-in route handler in `app/api/` for the host scan, plus manual token entry as a
   fallback when the camera is unavailable (D-010).
3. Check-in moves Reserved to Occupied; check-out and host release move Occupied to
   Available.
4. No-show: the wait window lapses without a check-in, the unit releases, and the fee is
   recorded as forfeited — evaluated lazily, not by cron (D-011).
5. Closing-time release, so units do not sit Occupied overnight.
6. Host view of active reservations and their remaining wait windows, finishing FR-3.3
   and wiring Sprint 2's override warning.
7. Tests: a token cannot be replayed; a Host cannot check in a token for another venue.

#### Draft acceptance criteria

- [ ] Scanning or entering a valid token moves that unit to Occupied.
- [ ] A token works once, and only at the venue that owns the unit.
- [ ] A no-show releases the unit and records the fee as forfeited.
- [ ] Check-out returns the unit to Available and frees it for others.
- [ ] Units in Reserved state show the Host the remaining wait time.

---

### [STORY-13] Community Reviews & Ratings _(proposed — no issue yet)_

- **Story**: _As a Seeker who actually visited, I want to review the amenities, so that other Seekers can trust what a space claims._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Maria Faith Antigua`
- **Git Branch**: `feature/STORY-13-reviews`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-4.1, FR-4.2 · **Decisions**: D-009

#### Draft tasks

1. Migration: `reviews` (space FK, reservation FK, author FK, per-amenity ratings for
   noise, Wi-Fi reliability, cleanliness and comfort, body text, status).
2. RLS enforcing D-009 in the database, not in the UI: an insert requires a reservation
   by this author at this space with a completed check-in, and at most one review per
   reservation.
3. pgTAP negatives: a user with no completed check-in **cannot** insert a review; a
   second review on the same reservation is rejected; another user gets **0 rows** when
   editing someone else's review.
4. Review form on the space profile, shown only when the Seeker is eligible.
5. Aggregate ratings on the profile and in search results, excluding removed reviews.
6. "Report this review", flagging it for moderation (feeds STORY-14).
7. Escape and sanitize all review text (SRS §3.5.2).

#### Draft acceptance criteria

- [ ] A user without a completed check-in cannot post a review for that space.
- [ ] Each completed visit allows at most one review.
- [ ] Aggregate ratings on the profile match the visible, non-removed reviews.
- [ ] A reported review is flagged for administrator moderation.

---

### [STORY-14] Administration Console _(proposed — no issue yet)_

- **Story**: _As an Administrator, I want to verify venues, moderate reported reviews and oversee sandbox payments, so that the platform stays trustworthy._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `James Niño Mandawe`
- **Git Branch**: `feature/STORY-14-admin-console`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-5.1, FR-5.2, FR-5.3 · **Decisions**: D-005, D-013

#### Draft tasks

1. Verification queue: pending venues with approve and reject actions, and a rejection
   reason the Host can see.
2. Enforce in RLS that a venue that is not verified never appears in public search
   (FR-5.1) — the same flag Sprint 2's search already honours.
3. Moderation queue for reported reviews, with hide and remove, and removal excluded
   from aggregates (FR-5.2).
4. Sandbox payment oversight: read fees paid, forfeited and refunded (FR-5.3).
5. Sandbox refund action for when a Host cannot honour a paid hold, with the new status
   visible to the Seeker.
6. pgTAP negatives: a Seeker or Host gets **0 rows** from the admin queues and cannot
   approve a venue, remove a review or issue a refund.
7. Final QA: Playwright journeys end to end (search → hold → pay → check in → review),
   the FR-2.5 concurrency test in CI, and the DoD verification for the Final phase.

#### Draft acceptance criteria

- [ ] An unverified venue does not appear in public search results.
- [ ] A removed review no longer appears on the profile or in the aggregates.
- [ ] A sandbox refund updates the payment status and is visible to the Seeker.
- [ ] A Seeker or Host attempting any admin action gets 0 rows and a rejected write.

---

## 6. Sequencing & Cross-Story Dependencies

| This story | Waits for                        | Because                                            |
| ---------- | -------------------------------- | -------------------------------------------------- |
| STORY-10   | STORY-09 tasks 1–3               | Check-in mutates a reservation that must exist     |
| STORY-13   | STORY-10 tasks 1–3               | A review needs a completed check-in (D-009)        |
| STORY-14   | STORY-09 task 1 and STORY-13 t.1 | Moderation and refunds need reviews and payments   |

**This is the sprint's main risk.** All four stories sit on one chain, so a slip in
STORY-09 pushes everything. Mitigation in §8.

---

## 7. Project Management Board Mapping

Board columns and WIP limits are unchanged (D-022). While this plan is a draft, STORY-09
and STORY-10 stay in **Product Backlog**, and STORY-13 and STORY-14 do not exist yet.

| Card ID    | Card Title                                     | Column (today)  | Assignee             | Points  | Time Est. | MoSCoW      |
| ---------- | ---------------------------------------------- | --------------- | -------------------- | ------- | --------- | ----------- |
| `STORY-09` | Reserve-Now Holds & Sandbox Payments           | Product Backlog | Adrian Seth Tabotabo | 10 / 10 | 5 Days    | Must Have   |
| `STORY-10` | QR Check-in, Wait Window & No-Show Release     | Product Backlog | Luke Miguel Dongque  | 8 / 10  | 4 Days    | Must Have   |
| `STORY-13` | Community Reviews & Ratings                    | _not created_   | Maria Faith Antigua  | 8 / 10  | 4 Days    | Should Have |
| `STORY-14` | Administration Console                         | _not created_   | James Niño Mandawe   | 8 / 10  | 4 Days    | Should Have |

**Draft sprint total: 34 points across 4 stories.**

---

## 8. Open Questions & Risks — settle these before baselining

1. **PayMongo or Stripe?** The SRS names both (§3.7.3) and D-005 has not chosen. This has
   an account and test-key lead time, so it should be a `decision-needed` issue settled
   during **Sprint 2**, not at the start of Sprint 3.
2. **How long is the payment window, and what bounds may a Host set on the wait window?**
   D-004 leaves both to STORY-09's design doc. They are the two numbers the whole
   reserve-now experience hangs on.
3. **What is the reservation fee?** A fixed sandbox amount, or a share of the Host's
   hourly rate. Sandbox money, real design question.
4. **Lazy expiry versus a scheduled job.** D-011 rules out cron for correctness, so
   expiry must be evaluated on read and on write. This draft assumes lazy evaluation is
   enough; STORY-09's design doc should confirm it and say what a user sees for a hold
   that expired while their page was open.
5. **The dependency chain in §6.** If STORY-09 slips past day 5, which story is dropped?
   The draft's answer: STORY-13 (Should Have) is dropped before STORY-14, because
   FR-5.1's verification gate is what keeps unverified venues out of public search. The
   team should confirm that ordering before the sprint starts.
6. **Does a whole-unit room with a capacity behave differently on a hold?** FR-2.1 treats
   it as one bookable object; confirm that a capacity of six does not mean six holds.

---

## 9. After Sprint 3 — Week 12 hardening

The worksheet reserves Week 12 for QA and integration testing, and Weeks 13–14 for final
evaluation and deployment. That is not a sprint and gets no story cards, but the Final
phase depends on it:

- Full Playwright journeys for all three roles.
- The FR-2.5 concurrency test running in CI, not only locally.
- Performance against SRS §3.4: search under about 1 s, FCP under about 2 s, LCP under
  about 3 s, allowing for serverless cold starts.
- Classroom-scale concurrency, 30–50 simultaneous users, with no double-booking.
- Accessibility sweep against WCAG 2.1 AA across every route (SRS §3.2.2).
- A production Supabase project, created before the Final phase (D-017).
- Code authorship verification, and AI disclosure checked against D-020.

If the team prefers this to be a card, it becomes STORY-15 rather than being folded into
STORY-14.

---

## 10. On Adoption — what the baselining pull request does

1. Renames this file to `StudyHub_Sprint_3_Plan.md`, and deletes §0 and this section.
2. Re-estimates against Sprint 2's actual velocity, and folds in any carried-over story.
3. Edits issue #59's title to match STORY-10's re-scope, and creates issues for STORY-13
   and STORY-14 (§3).
4. Adds STORY-11 to STORY-14 to the design index in
   [`docs/design/README.md`](../design/README.md), if Sprint 2's adoption has not already.
5. Records §8's answers in [`docs/DECISIONS.md`](../DECISIONS.md) — at minimum the
   gateway choice, the two timer lengths and the fee.
6. Updates [`docs/course/README.md`](README.md) and the board snapshot, and runs
   `npm run docs:docx`.

_End of Sprint 3 Plan (DRAFT)._
