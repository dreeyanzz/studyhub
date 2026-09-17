# StudyHub — Sprint 2 Plan (DRAFT): Space Discovery & the Seat Map

> **Course**: CPEPE361 (Software Development 1)
> **Phase**: Prefinal Phase — Sprint 2
> **Sprint Duration**: 2 Weeks (Weeks 8–9)
> **Development Lifecycle**: Sprint 2 of 3
>
> - **Sprint 1 (Midterm)**: Foundation, Identity & Primary CRUD (Walking Skeleton)
> - **Sprint 2 (Prefinal)**: Space Discovery & Snap-Grid Seat Map Builder
> - **Sprint 3 (Final)**: Exact-Seat Holds, Sandbox Payments, Check-in & Moderation

---

## 0. Status: this is a draft, not a commitment

**Status: `DRAFT` — not baselined. Nothing here is committed work.**

This plan was written during Sprint 1 so the team can see where the work is heading, and
so the Sprint 1 design docs can be written with Sprint 2 in mind. It is a proposal:

- **No card moves because of this document.** These stories stay in Product Backlog (D-022).
- **No issue is created, renamed or re-scoped because of this document.**
- **No code starts.** The plan gate (D-016) still applies: every story needs its own
  merged design doc first, and that design doc is what decides the details.
- **Every estimate here is a guess made before Sprint 1 finished.** Sprint 1's actual
  velocity is the first thing that will change it.

**What makes it real.** This document becomes the Sprint 2 plan when, at the Sprint 1
review, all of the following are true and Adrian merges a pull request that applies §10:

1. Every Sprint 1 story is Done against the Sprint 1 Definition of Done, or has been
   explicitly carried over into Sprint 2 with its remaining points re-estimated.
2. The entry conditions in §2 hold.
3. The open questions in §8 are settled — each one either as a `decision-needed` issue
   resolved into `docs/DECISIONS.md`, or as an explicit "decide inside the design doc".
4. The stories, owners and estimates below have been re-checked against what Sprint 1
   actually cost.

Until then, treat this as a reading of the SRS, not as a schedule.

---

## 1. Sprint Goal

Turn the Sprint 1 walking skeleton into something a Seeker can actually browse: a Host
can lay out their venue on a snap grid, and a Seeker can find that venue on a map, filter
it by curated tags, and see which units are open right now.

At the end of Sprint 2 a Seeker can find a space and see an exact unit's state. They
still cannot hold it — holding, paying and checking in are Sprint 3 (FR-2.x).

Concretely:

1. **Space → Zone → Unit schema** with Row-Level Security (D-003).
2. **Snap-grid seat map builder** for Hosts (FR-3.1), with an accessible list view that
   offers the same actions (SRS §3.2.2).
3. **Geo-discovery** on Leaflet/OpenStreetMap with curated-tag filters (FR-1.1, FR-1.2,
   D-012).
4. **Space profile** with photos, curated and custom tags, and a host-updated
   availability view carrying its "last updated" time (FR-1.3, D-002).
5. **Host live occupancy control**: one tap sets any unit Available, Reserved or
   Occupied, including walk-ins (FR-3.2).

---

## 2. Entry Conditions — what Sprint 1 must have delivered

Sprint 2 is blocked, story by story, until these hold. If one is missing at the Sprint 1
review, the story that depends on it is re-scoped or carried over, not started on hope.

| Needed from Sprint 1                                                    | Needed by          |
| ----------------------------------------------------------------------- | ------------------ |
| `profiles` and `spaces` tables with RLS, and `npm run db:test` green    | Every story        |
| A migration workflow run end to end at least once (D-017)               | STORY-07           |
| Working `seeker` / `host` / `admin` roles and route guards (STORY-03)   | STORY-07, STORY-12 |
| Host portal shell and space CRUD (STORY-05)                             | STORY-07, STORY-12 |
| Design tokens and shadcn/ui primitives (STORY-02)                       | STORY-08, STORY-11 |
| Vitest harness, and the `db` CI job green on `main` (STORY-06)          | Every story        |

---

## 3. Team Workload & Domain Distribution

Each person keeps the domain they held in Sprint 1, so nobody restarts on unfamiliar
ground mid-project.

| Developer                | Role & Primary Domain             | Draft story responsibility                                                                                |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Adrian Seth Tabotabo** | Backend Lead & Database Architect | **STORY-07**: `zones` / `units` schema and RLS, the storage bucket, seat-map persistence, the builder.    |
| **Luke Miguel Dongque**  | Auth & Security Specialist        | **STORY-08**: Leaflet map, location and GPS search, curated-tag filter query, public-visibility rules.    |
| **Maria Faith Antigua**  | Frontend Design System Lead       | **STORY-11**: space profile page, photo gallery, tag display, availability view and accessible list view. |
| **James Niño Mandawe**   | Portal Shells & QA Engineer       | **STORY-12**: host occupancy control, plus the Sprint 2 test suite and DoD verification.                  |

> **Note on story numbering.** STORY-07 (#56) and STORY-08 (#57) already exist as issues,
> from the Sprint 1 plan's product backlog. STORY-11 and STORY-12 are **proposed** and
> have no issue yet; §10 covers creating them. They exist because two stories cannot
> cover the remaining discovery requirements, and would leave two of the four developers
> without a story of their own this sprint.

---

## 4. Sprint 2 Backlog with MoSCoW Prioritization

| Priority            | Feature / User Need                         | Requirement   | Description                                                                                          |
| ------------------- | ------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| **Must Have (M)**   | Zone & Unit schema with RLS                 | FR-3.1, D-003 | `zones` and `units` under a Space, with seat state and host-only mutation.                           |
| **Must Have (M)**   | Snap-grid seat map builder                  | FR-3.1        | Host places seats, standing desks and whole-unit rooms on a grid; the layout persists.               |
| **Must Have (M)**   | Accessible list view of units               | SRS §3.2.2    | The same select-and-inspect actions as the grid, without needing the visual map.                     |
| **Must Have (M)**   | Geo-search on Leaflet / OpenStreetMap       | FR-1.1, D-012 | Text and GPS search rendering venue pins and a synchronized list.                                    |
| **Must Have (M)**   | Curated multi-criteria filters              | FR-1.2, D-006 | Wi-Fi tier, outlets, noise, air-conditioning, hours, price tier, unit type — combined with AND.      |
| **Must Have (M)**   | Space profile with availability             | FR-1.3, D-002 | Photos, curated and custom tags, pricing, hours, and open units per zone with a "last updated" time. |
| **Must Have (M)**   | Host live occupancy control                 | FR-3.2        | One tap sets a unit Available, Reserved or Occupied, including walk-ins.                             |
| **Should Have (S)** | Venue photo upload (Supabase Storage)       | FR-3.1        | Host uploads venue photos into a bucket with its own access policy.                                  |
| **Should Have (S)** | Custom tags visibly distinct from curated   | FR-1.3, D-006 | Custom tags render differently and are never offered as filters.                                     |
| **Should Have (S)** | Sprint 2 test suite                         | D-019         | pgTAP policies for `zones` / `units`, unit tests for the filter query, first Playwright journey.     |
| **Could Have (C)**  | Unit-level and zone-level curated tags      | D-006         | Tags below space level, not only on the space itself.                                                |
| **Could Have (C)**  | Distance sort on results                    | FR-1.1        | Order results by distance from the searched point.                                                   |
| **Won't Have (W)**  | Holding, paying for or checking into a unit | _Sprint 3_    | FR-2.x in full — the seat map is read-only to Seekers this sprint.                                   |
| **Won't Have (W)**  | Reviews and ratings                         | _Sprint 3_    | FR-4.x, which depends on a completed check-in (D-009).                                               |
| **Won't Have (W)**  | Administrator verification queue UI         | _Sprint 3_    | FR-5.1; see the open question in §8 about how spaces get verified in the meantime.                   |

---

## 5. Draft Stories & Task Decomposition

Every story still needs its own merged design doc before code starts (D-016). The tasks
below are the expected shape of that design's build order, not a substitute for it.

---

### [STORY-07] Snap-Grid Seat Map Builder — issue #56

- **Story**: _As a Host, I want to lay out my venue's zones and units on a snap grid, so that Seekers can see, and later pick, an exact seat._
- **Story Points**: `10 / 10`
- **Time Estimate**: `5 Days`
- **Assignee**: `Adrian Seth Tabotabo`
- **Git Branch**: `feature/STORY-07-seat-map-builder`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-3.1, SRS §3.2.2 · **Decisions**: D-003, D-004, D-006

#### Draft tasks

1. Migration: `zones` (space FK, name, ordering) and `units` (zone FK, `unit_type`,
   label, capacity, grid position, `seat_state`), with enums named as in the Glossary.
2. RLS: public select of units in a publicly visible space; insert, update and delete
   restricted to the owning Host; admin oversight.
3. pgTAP negative tests: another Host gets **0 rows** for another venue's units, and
   **cannot** insert a unit into a zone they do not own.
4. Server Actions for the builder (D-010): create and rename a zone; add, move, relabel
   and remove a unit; save the layout.
5. Builder UI on a snap grid: place a seat, a standing desk or a whole-unit room; set a
   label; set capacity on whole units.
6. Accessible list view of the same layout, with the same add and edit actions
   (SRS §3.2.2).
7. Supabase Storage bucket for venue photos, with its access policy (consumed by
   STORY-11).
8. Regenerate `lib/supabase/database.types.ts` with `npm run db:types`.

#### Draft acceptance criteria

- [ ] A saved seat map persists and renders identically for a Host and for a Seeker.
- [ ] Every unit has a type and a label, and whole units have a capacity.
- [ ] A second Host gets 0 rows for another venue's units and cannot modify them.
- [ ] Every builder action is reachable from the list view, by keyboard alone.

---

### [STORY-08] Live Geo-Discovery & Curated Tag Filters — issue #57

- **Story**: _As a Seeker, I want to search spaces on a map and narrow them by amenities, so that I only see venues that actually suit me._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Luke Miguel Dongque`
- **Git Branch**: `feature/STORY-08-geo-discovery`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-1.1, FR-1.2, FR-5.1 · **Decisions**: D-006, D-012

#### Draft tasks

1. Migration: the curated tag vocabulary and the space-to-tag join, with custom tags
   stored apart from curated ones (D-006).
2. Leaflet + OpenStreetMap map component with venue pins, and a list synchronized to the
   viewport.
3. Location search by typed place or campus name, and by W3C Geolocation coordinates.
4. Filter panel for the seven curated criteria, combining them with AND, plus the mobile
   filter drawer (SRS §3.7.1).
5. Query helper in `lib/data/` that builds the filtered search and excludes spaces that
   are not publicly visible (FR-5.1).
6. Unit tests for the filter query builder: two filters return only venues satisfying
   both, and clearing one restores results without a full reload.

#### Draft acceptance criteria

- [ ] A valid location query renders matching pins on the map and in the list.
- [ ] Selecting a pin shows name, aggregate rating, price tier and distance.
- [ ] Two or more filters return only venues satisfying all of them.
- [ ] A space that is not publicly visible never appears in results.
- [ ] Custom tags are not offered as filters anywhere in the UI.

---

### [STORY-11] Space Profile & Host-Updated Availability _(proposed — no issue yet)_

- **Story**: _As a Seeker, I want a venue profile showing photos, verified amenities and which units are open right now, so that I can judge the space before travelling._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Maria Faith Antigua`
- **Git Branch**: `feature/STORY-11-space-profile`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-1.3, FR-3.1, SRS §3.2.2 · **Decisions**: D-002, D-006

#### Draft tasks

1. Space profile route with photos, pricing, operating hours and both tag kinds, custom
   tags visibly distinguished from curated ones.
2. Host photo upload form writing to the Sprint 2 storage bucket, and the gallery that
   reads it.
3. Availability view: Available unit count per zone, plus the read-only seat map.
4. "Host-updated · X min ago" label wherever availability appears, sourced from the
   unit's `updated_at` (D-002) — never the words "real-time" or "live" (Glossary).
5. Seeker-facing accessible list view of units and their states (SRS §3.2.2), sharing the
   component built in STORY-07.
6. Responsive verification at 360, 768 and 1024 px with no horizontal scrolling.

#### Draft acceptance criteria

- [ ] The availability view shows Available units per zone and when it was last updated.
- [ ] Custom tags are visibly distinct from curated tags, and are never filterable.
- [ ] The list view shows every unit's state and is fully keyboard navigable.
- [ ] The profile renders without horizontal scrolling at 360, 768 and 1024 px.

---

### [STORY-12] Host Live Occupancy Control _(proposed — no issue yet)_

- **Story**: _As a Host, I want to set any unit's state with one tap, so that walk-ins and departures are reflected without me answering messages._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `James Niño Mandawe`
- **Git Branch**: `feature/STORY-12-host-occupancy`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-3.2 · **Decisions**: D-002, D-004, D-010

#### Draft tasks

1. Host seat-map view with one-tap state control: Available, Reserved, Occupied — and no
   other state (D-004).
2. Server Action for the state change, stamping `updated_at` so the Seeker-facing
   freshness label is honest.
3. Walk-in marking: a Host sets Occupied with no reservation in the system.
4. Confirm-before-override affordance, wired to reservations in Sprint 3 (FR-3.3 cannot
   be finished until reservations exist).
5. pgTAP tests: a Host cannot change a unit's state in a venue they do not own.
6. Sprint 2 QA: extend the Vitest suite, add the first Playwright journey
   (search → filter → profile → list view), and verify the DoD.

#### Draft acceptance criteria

- [ ] A host state change appears in the Seeker-facing availability within one refresh.
- [ ] A Host can mark a walk-in Occupied with no reservation in the system.
- [ ] A Host gets 0 rows, and a rejected write, on another venue's units.
- [ ] `npm run check`, `npm run db:test` and `npm run build` pass.

---

## 6. Sequencing & Cross-Story Dependencies

STORY-07 lands first; the other three read the schema it creates.

| This story | Waits for                                                    | Because                                      |
| ---------- | ------------------------------------------------------------ | -------------------------------------------- |
| STORY-08   | Nothing in Sprint 2 (only Sprint 1's `spaces`)               | It can start on day one, in parallel with 07 |
| STORY-11   | STORY-07 tasks 1–3 (schema and RLS) and task 7 (the bucket)  | It renders units and photos                  |
| STORY-12   | STORY-07 tasks 1–4                                           | It mutates unit state                        |

**Deliberately unfinished this sprint:** FR-3.3 — showing a Host the remaining wait
window on reserved units — needs reservations, which arrive in STORY-09. Sprint 2 builds
the affordance; Sprint 3 wires it.

---

## 7. Project Management Board Mapping

The board keeps exactly the five columns the course requires (D-022): Product Backlog,
Sprint 1 Backlog, In Progress, Code Review, Done. WIP limits stay at 4 for In Progress
and 4 for Code Review.

**While this plan is a draft**, every story below stays in **Product Backlog**. See the
open question in §8 about what the second column is called once Sprint 2 opens.

| Card ID    | Card Title                                | Column (today)  | Assignee             | Points  | Time Est. | MoSCoW    |
| ---------- | ----------------------------------------- | --------------- | -------------------- | ------- | --------- | --------- |
| `STORY-07` | Snap-Grid Seat Map Builder                | Product Backlog | Adrian Seth Tabotabo | 10 / 10 | 5 Days    | Must Have |
| `STORY-08` | Live Geo-Discovery & Curated Tag Filters  | Product Backlog | Luke Miguel Dongque  | 8 / 10  | 4 Days    | Must Have |
| `STORY-11` | Space Profile & Host-Updated Availability | _not created_   | Maria Faith Antigua  | 8 / 10  | 4 Days    | Must Have |
| `STORY-12` | Host Live Occupancy Control               | _not created_   | James Niño Mandawe   | 8 / 10  | 4 Days    | Must Have |

**Draft sprint total: 34 points across 4 stories.** Sprint 1 carried 44 points across 7
stories, including the repository foundation. This number is a guess until Sprint 1's
real velocity is known.

---

## 8. Open Questions — settle these before baselining

Each of these is a `decision-needed` issue candidate (AGENTS.md working rule 2). None of
them should be answered by guessing inside a pull request.

1. **How does a space become publicly visible before the admin console exists?** FR-5.1
   says an unverified venue is not shown in public search, but the verification queue is
   Sprint 3 (STORY-14). Either seed verified spaces and set the flag in a migration or
   seed file for the demo, or bring a minimal admin approval action forward into
   Sprint 2. Affects STORY-08 task 5.
2. **What is the second board column called during Sprint 2?** The course fixes five
   columns, and the second is named "Sprint 1 Backlog" (D-022). Either it is renamed each
   sprint, or it becomes "Sprint Backlog". Maria owns the board; this needs deciding
   before any card moves.
3. **Do STORY-11 and STORY-12 become new issues, or do STORY-07 and STORY-08 absorb
   them?** §10 assumes new issues. The alternative keeps the four-story backlog from the
   Sprint 1 plan, but leaves two developers without a story of their own.
4. **What does a unit's grid position look like in the database?** Integer row and column
   on a fixed grid, or free x/y with a snap step. STORY-07's design doc can decide it,
   but it should be decided there and recorded — not discovered while coding.
5. **Zone-level and unit-level curated tags.** D-006 allows tags below space level.
   Sprint 2 may ship space level only and defer the rest.

---

## 9. Definition of Done

The Sprint 1 Definition of Done applies unchanged
([`StudyHub_Sprint_1_Plan.md`](StudyHub_Sprint_1_Plan.md) §6): branch and squash merge,
merged design doc first, local checks, green CI, RLS with negative tests, accessibility
and responsiveness, criteria ticked by the person who verified them, peer review, docs
updated, tracking closed.

Sprint 2 adds two checks, because this is the first sprint with a visual, spatial UI:

- **Seat map parity**: every action available on the snap grid is available in the list
  view, by keyboard alone (SRS §3.2.2).
- **Freshness honesty**: every surface showing availability shows when a Host last
  updated it, and no surface calls host-maintained data "real-time" or "live"
  (D-002, Glossary).

---

## 10. On Adoption — what the baselining pull request does

When §0's conditions are met, one pull request:

1. Renames this file to `StudyHub_Sprint_2_Plan.md`, and deletes §0 and this section.
2. Re-checks every estimate against Sprint 1's actual velocity, and folds in any Sprint 1
   story that was carried over.
3. Creates the issues for STORY-11 and STORY-12 (or merges them into 07 and 08, per
   §8.3), and adds their rows to the design index in
   [`docs/design/README.md`](../design/README.md).
4. Records the answers to §8 in [`docs/DECISIONS.md`](../DECISIONS.md), wherever they had
   real alternatives.
5. Updates [`docs/course/README.md`](README.md) and the board snapshot.
6. Runs `npm run docs:docx` so the submitted `.docx` matches.

_End of Sprint 2 Plan (DRAFT)._
