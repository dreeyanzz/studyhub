# StudyHub — Sprint 3 Plan (DRAFT): Reviews, Administration & Hardening

> **Course**: CPEPE361 (Software Development 1)  
> **Phase**: Final Phase — Sprint 3  
> **Sprint Duration**: 2 Weeks (Weeks 10–11)  
> **Development Lifecycle**: Sprint 3 of 3
>
> - **Sprint 1 (Midterm)**: Foundation, Identity & Primary CRUD (Walking Skeleton)
> - **Sprint 2 (Prefinal)**: The Booking Journey — Discovery, Seat Map, Holds, Sandbox Payments & Check-in
> - **Sprint 3 (Final)**: Reviews, Administration & Hardening

---

## 0. Status: this is a draft

**Status: `DRAFT` — not baselined. Nothing here is committed work.**

Sprint 2 was baselined with every Must Have in the SRS, the whole booking journey from
search to check-in (D-036). Holds, sandbox payments and check-in (STORY-09, STORY-10)
moved there from this draft, and so did the Space verification queue, as STORY-15
(D-037). What is left for Sprint 3 is the Should Haves, whatever Sprint 2 carries over,
and the hardening before the Final.

The same rules as for any draft apply:

- **No card moves, no issue is created or re-scoped, and no code starts** because of this
  document. The plan gate (D-016) still applies to every story here.
- **Every estimate here is a guess.** Sprint 2's actual velocity, and what it carries
  over, will change it.

**What makes it real.** This becomes the Sprint 3 plan when, at the Sprint 2 review:

1. Every Sprint 2 story is Done, or explicitly carried over into Sprint 3 with its points
   re-estimated. Sprint 2 has no cut line (D-036), so this review is where that is
   decided.
2. The entry conditions in §2 hold.
3. The open questions in §8 are settled.
4. Adrian merges a pull request applying §10.

---

## 1. Sprint Goal

Make the booking journey trustworthy and finish the SRS's functional scope: Seekers who
actually visited can review a Space, and Administrators can moderate those reviews and
oversee sandbox payments.

Concretely:

1. **Reviews after a completed check-in**, with aggregates on the Space profile (FR-4.1,
   FR-4.2, D-009).
2. **Administration**: review moderation, and sandbox payment oversight with refunds
   (FR-5.2, FR-5.3), on the `/admin` portal that STORY-15 creates in Sprint 2.
3. **Whatever Sprint 2 carries over**, finished first.
4. **Getting ready for Week 12**: the concurrency test in CI and the full journeys for
   every role (§9).

This sprint completes the SRS v2.0 functional scope. Nothing is left for a Sprint 4;
Week 12 is hardening, not features (§9).

---

## 2. Entry Conditions — what Sprint 2 must have delivered

| Needed from Sprint 2                                                       | Needed by |
| -------------------------------------------------------------------------- | --------- |
| Completed check-ins on reservations (STORY-10)                             | STORY-13  |
| The Space profile, where reviews and aggregates appear (STORY-11)          | STORY-13  |
| `payments` with paid, forfeited and refunded statuses (STORY-09, STORY-10) | STORY-14  |
| The `/admin` portal shell and its role guard (STORY-15)                    | STORY-14  |

---

## 3. Team Workload & Domain Distribution

| Developer                | Role & Primary Domain             | Draft responsibility                                                                      |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------- |
| **Adrian Seth Tabotabo** | Backend Lead & Database Architect | Sprint 2 carry-over; the `reviews` schema and policies with Maria; the production project |
| **Luke Miguel Dongque**  | Auth & Security Specialist        | Sprint 2 carry-over; the FR-2.5 concurrency test in CI; the security pass for Week 12     |
| **Maria Faith Antigua**  | Frontend Design System Lead       | **STORY-13**: review form gated on check-in, aggregate ratings, reporting a review        |
| **James Niño Mandawe**   | Portal Shells & QA Engineer       | **STORY-14**: moderation and payment oversight, plus the final DoD verification           |

> **Note on story numbering.** STORY-13 (#78) and STORY-14 (#79) exist as issues. STORY-14
> lost the verification queue to STORY-15 (#166) in Sprint 2, so it is re-estimated at
> Sprint 3 planning.

---

## 4. Sprint 3 Backlog with MoSCoW Prioritization

| Priority            | Feature / User Need                              | Requirement      | Description                                                         |
| ------------------- | ------------------------------------------------ | ---------------- | ------------------------------------------------------------------- |
| **Must Have (M)**   | Anything Sprint 2 carries over                   | —                | Finished before any new story starts.                               |
| **Should Have (S)** | Reviews restricted to checked-in visitors        | FR-4.1, D-009    | One review per completed visit.                                     |
| **Should Have (S)** | Aggregate ratings and review reporting           | FR-4.2           | Aggregates on the profile; reported reviews go to moderation.       |
| **Should Have (S)** | Review moderation                                | FR-5.2           | A removed review leaves the profile and the aggregates.             |
| **Should Have (S)** | Sandbox payment oversight and refunds            | FR-5.3           | An Administrator reads payment records and issues a sandbox refund. |
| **Could Have (C)**  | Rejection reasons and re-verifying edited Spaces | FR-5.1, D-027    | What STORY-15 left out.                                             |
| **Could Have (C)**  | Seeker reservation history                       | —                | Past holds on the Seeker dashboard.                                 |
| **Could Have (C)**  | Email notification on hold confirmation          | —                | Only if Supabase's free tier allows it without new cost.            |
| **Won't Have (W)**  | Real-money settlement                            | _Future release_ | SRS §1.2 and D-005: sandbox only, all semester.                     |
| **Won't Have (W)**  | Advance or scheduled bookings                    | _Out of scope_   | D-001: current-state only.                                          |
| **Won't Have (W)**  | Occupancy sensors                                | _Out of scope_   | D-002: availability stays host-maintained.                          |

---

## 5. Draft Stories & Task Decomposition

---

### [STORY-13] Community Reviews & Ratings — issue #78

- **Story**: _As a Seeker who actually visited, I want to review the amenities, so that other Seekers can trust what a space claims._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Maria Faith Antigua`
- **Git Branch**: `feature/STORY-13-reviews`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-4.1, FR-4.2 · **Decisions**: D-009

#### Draft tasks

1. Migration: `reviews` (Space FK, reservation FK, author FK, per-amenity ratings for
   noise, Wi-Fi reliability, cleanliness and comfort, body text, status).
2. RLS enforcing D-009 in the database, not in the UI: an insert requires a reservation
   by this author at this Space with a completed check-in, and at most one review per
   reservation.
3. pgTAP negatives: a user with no completed check-in **cannot** insert a review; a
   second review on the same reservation is rejected; another user gets **0 rows** when
   editing someone else's review.
4. Review form on the Space profile, shown only when the Seeker is eligible.
5. Aggregate ratings on the profile and in search results, excluding removed reviews.
6. "Report this review", flagging it for moderation (feeds STORY-14).
7. Escape and sanitize all review text (SRS §3.5.2).

#### Draft acceptance criteria

- [ ] A user without a completed check-in cannot post a review for that Space.
- [ ] Each completed visit allows at most one review.
- [ ] Aggregate ratings on the profile match the visible, non-removed reviews.
- [ ] A reported review is flagged for Administrator moderation.

---

### [STORY-14] Administration Console — issue #79 _(re-scoped)_

- **Story**: _As an Administrator, I want to moderate reported reviews and oversee sandbox payments, so that the platform stays trustworthy._
- **Story Points**: `8 / 10` (re-estimated at Sprint 3 planning)
- **Time Estimate**: `4 Days`
- **Assignee**: `James Niño Mandawe`
- **Git Branch**: `feature/STORY-14-admin-console`
- **MoSCoW**: `Should Have`
- **Requirements**: FR-5.2, FR-5.3 · **Decisions**: D-005, D-013

Space verification (FR-5.1) moved to STORY-15 in Sprint 2. This story adds its queues to
the `/admin` portal STORY-15 creates.

#### Draft tasks

1. Moderation queue for reported reviews, with hide and remove, and removal excluded from
   aggregates (FR-5.2).
2. Sandbox payment oversight: read fees paid, forfeited and refunded (FR-5.3).
3. Sandbox refund action for when a Host cannot honour a paid hold, with the new status
   visible to the Seeker.
4. pgTAP negatives: a Seeker or Host gets **0 rows** from the admin queues and cannot
   remove a review or issue a refund.
5. Final QA: Playwright journeys end to end (search → hold → pay → check in → review),
   and the DoD verification for the Final phase.

#### Draft acceptance criteria

- [ ] A removed review no longer appears on the profile or in the aggregates.
- [ ] A sandbox refund updates the payment status and is visible to the Seeker.
- [ ] A Seeker or Host attempting any admin action gets 0 rows and a rejected write.

---

## 6. Sequencing & Cross-Story Dependencies

| This story | Waits for                                   | Because                                          |
| ---------- | ------------------------------------------- | ------------------------------------------------ |
| STORY-13   | Sprint 2's STORY-10 (completed check-ins)   | A review needs a completed check-in (D-009)      |
| STORY-14   | STORY-13 task 1, and Sprint 2's `payments`  | Moderation and refunds need reviews and payments |

Anything Sprint 2 carries over goes first, because both stories build on it.

---

## 7. Project Management Board Mapping

The second column is renamed **Sprint 3 Backlog** when Sprint 3 starts (D-038). While
this plan is a draft, both stories stay in **Product Backlog**.

| Card ID    | Card Title                  | Column (today)  | Assignee            | Points | Time Est. | MoSCoW      |
| ---------- | --------------------------- | --------------- | ------------------- | ------ | --------- | ----------- |
| `STORY-13` | Community Reviews & Ratings | Product Backlog | Maria Faith Antigua | 8 / 10 | 4 Days    | Should Have |
| `STORY-14` | Administration Console      | Product Backlog | James Niño Mandawe  | 8 / 10 | 4 Days    | Should Have |

**Draft sprint total: 16 points across 2 stories, plus Sprint 2's carry-over.**

---

## 8. Open Questions — settle these before baselining

1. **What does Sprint 2 carry over?** Sprint 2 holds 55 points with no cut line (D-036),
   so its review decides what moves here, and who finishes it.
2. **Rejection reasons and re-verifying an edited Space.** STORY-15 approves or rejects
   with no reason, and D-027 still lets a Host edit a Verified Space without sending it
   back to Pending. Does STORY-14 add both, or do they wait?
3. **Does Week 12 hardening get a card?** If it does, it becomes a new story rather than
   being folded into STORY-14 (§9).

STORY-09's own questions (the gateway, the two timers, the fee, lazy expiry, and whether
a whole room takes one hold) moved to its design doc in Sprint 2.

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

---

## 10. On Adoption — what the baselining pull request does

1. Renames this file to `StudyHub_Sprint_3_Plan.md`, and deletes §0 and this section.
2. Re-estimates against Sprint 2's actual velocity, and folds in every carried-over story.
3. Records §8's answers in [`docs/DECISIONS.md`](../DECISIONS.md), wherever they had real
   alternatives.
4. Updates [`docs/course/README.md`](README.md), and runs `npm run docs:docx`.

_End of Sprint 3 Plan (DRAFT)._
