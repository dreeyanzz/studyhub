# StudyHub — Sprint 2 Plan: The Booking Journey, End to End

> **Course**: CPEPE361 (Software Development 1)  
> **Phase**: Prefinal Phase — Sprint 2  
> **Sprint Duration**: 2 Weeks (Weeks 8–9: Saturday 10 to Friday 23 October 2026)  
> **Development Lifecycle**: Sprint 2 of 3
>
> - **Sprint 1 (Midterm)**: Foundation, Identity & Primary CRUD (Walking Skeleton)
> - **Sprint 2 (Prefinal)**: The Booking Journey — Discovery, Seat Map, Holds, Sandbox Payments & Check-in
> - **Sprint 3 (Final)**: Reviews, Administration & Hardening
>
> **Status**: Baselined Tuesday 13 October 2026 (D-036)

---

## 1. Sprint Goal

Sprint 1 built the walking skeleton. Sprint 2 builds every Must Have that the SRS asks of
the product, so that by the Prefinal demo the whole booking journey works end to end:

1. A Host builds their Space's seat map on a snap grid, and keeps each unit's state
   current, walk-ins included.
2. An Administrator approves the Space, so it becomes public (FR-5.1).
3. A Seeker finds it on the map, filters by curated tags, and opens its profile.
4. The Seeker picks an open unit, pays a sandbox reservation fee, and gets a booking token
   as a QR code.
5. The Host scans or enters the token, and the unit becomes Occupied. A unit nobody
   claims releases itself.

This is the journey the SRS's usability target measures (SRS §3.2.1: from discovering a
venue to holding a seat in under 3 minutes). Sprint 3 keeps the Should Haves, reviews and
the rest of the administration console, and the hardening before the Final.

Concretely:

1. **Space → Zone → Unit schema** with Row-Level Security, and the **snap-grid seat map
   builder** with an accessible list view (FR-3.1, SRS §3.2.2, D-003).
2. **Geo-discovery** on Leaflet/OpenStreetMap with **curated-tag filters** (FR-1.1,
   FR-1.2, D-006, D-012).
3. **Space verification**: an Administrator approves or rejects a Pending Space (FR-5.1,
   D-037).
4. **Space profile** with photos, curated and custom tags, and a host-updated availability
   view carrying its "last updated" time (FR-1.3, D-002).
5. **Host live occupancy control**: one tap sets any unit Available, Reserved or Occupied
   (FR-3.2).
6. **Reserve-now holds** with a sandbox reservation fee, and at most one active hold per
   unit (FR-2.1–FR-2.3, FR-2.5, D-001, D-005, D-008).
7. **QR check-in**, check-out and no-show release, and the Host's view of wait windows
   (FR-2.4, FR-3.3, D-004).

---

## 2. Entry Conditions — what Sprint 1 delivered

Every condition holds, so every story may start once its design doc is merged (D-016).

| Needed from Sprint 1                                                  | Status                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `profiles` and `spaces` tables with RLS, and `npm run db:test` green  | Met: STORY-01 (#90–#93); `db` green on `main`               |
| A migration workflow run end to end at least once (D-017)             | Met: both migrations are on the cloud dev project           |
| Working `seeker` / `host` / `admin` roles and route guards (STORY-03) | Met: #115, #118, #119                                       |
| Host portal shell and Space CRUD (STORY-05)                           | Met: #136, #143, #144, #147                                 |
| Design tokens and shadcn/ui primitives (STORY-02)                     | Met: #102, #116                                             |
| Vitest harness, and the `db` CI job green on `main` (STORY-06)        | Met: 128 unit tests; `checks`, `db` and `e2e` green on main |

Sprint 1 left two bugs open, #145 and #146. They carry over as Sprint 2's first items, and
both fixes are in review (#164, #165).

---

## 3. Team Workload & Domain Distribution

Each person keeps the domain they held in Sprint 1. As in Sprint 1, Adrian, the database
owner, writes every migration, policy and pgTAP test, and the other stories' owners say
in their design docs what they need (DEVELOPMENT.md, "Changing the database").

| Developer                | Role & Primary Domain             | Sprint 2 stories                                                                                                                     | Points |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Adrian Seth Tabotabo** | Backend Lead & Database Architect | **STORY-07** seat map builder and **STORY-09** holds and sandbox payments, plus the database half of STORY-08, STORY-10 and STORY-15 | 25     |
| **Luke Miguel Dongque**  | Auth & Security Specialist        | **STORY-08** map discovery and **STORY-10** QR check-in and release, the application side of both                                    | 12     |
| **Maria Faith Antigua**  | Frontend Design System Lead       | **STORY-11** Space profile and availability                                                                                          | 8      |
| **James Niño Mandawe**   | Portal Shells & QA Engineer       | **STORY-12** host occupancy, **STORY-15**'s `/admin` page, and Sprint 2 QA                                                           | 10     |

**Sprint total: 55 points across 7 stories.** Sprint 1 delivered 44 points across 7
stories, all merged by Sunday 4 October, five days early. Adrian's agent built several of
the teammates' Sprint 1 tasks; in Sprint 2 each person builds their own part, because the
Final phase checks who wrote the code.

The load is uneven by choice: Adrian keeps both database-heavy stories and every
migration, and most of them sit on the critical path (§6, D-036).

---

## 4. Sprint 2 Backlog with MoSCoW Prioritization

| Priority            | Feature / User Need                                    | Requirement             | Story              |
| ------------------- | ------------------------------------------------------ | ----------------------- | ------------------ |
| **Must Have (M)**   | Zone & Unit schema with RLS                            | FR-3.1, D-003           | STORY-07           |
| **Must Have (M)**   | Snap-grid seat map builder                             | FR-3.1                  | STORY-07           |
| **Must Have (M)**   | Accessible list view with the same actions as the map  | SRS §3.2.2              | STORY-07, STORY-11 |
| **Must Have (M)**   | Geo-search on Leaflet / OpenStreetMap                  | FR-1.1, D-012           | STORY-08           |
| **Must Have (M)**   | Curated multi-criteria filters, combined with AND      | FR-1.2, D-006           | STORY-08           |
| **Must Have (M)**   | Space verification by an Administrator                 | FR-5.1, D-037           | STORY-15           |
| **Must Have (M)**   | Space profile with host-updated availability           | FR-1.3, D-002           | STORY-11           |
| **Must Have (M)**   | Host live occupancy control, walk-ins included         | FR-3.2, D-004           | STORY-12           |
| **Must Have (M)**   | Reserve-now hold with a sandbox reservation fee        | FR-2.1–FR-2.3, D-005    | STORY-09           |
| **Must Have (M)**   | One active hold per unit, in one transaction           | FR-2.5, D-008           | STORY-09           |
| **Must Have (M)**   | QR check-in, check-out and no-show release             | FR-2.3, FR-2.4, D-004   | STORY-10           |
| **Must Have (M)**   | Host sees each reservation's remaining wait window     | FR-3.3                  | STORY-10           |
| **Should Have (S)** | Venue photo upload (Supabase Storage)                  | FR-3.1                  | STORY-07, STORY-11 |
| **Should Have (S)** | Custom tags visibly distinct from curated ones         | FR-1.3, D-006           | STORY-11           |
| **Should Have (S)** | Sprint 2 test suite                                    | D-019                   | Every story; James |
| **Could Have (C)**  | Zone-level and unit-level curated tags                 | D-006                   | STORY-08           |
| **Could Have (C)**  | Distance sort on results                               | FR-1.1                  | STORY-08           |
| **Could Have (C)**  | A Seeker's study preferences as default filters        | D-027                   | STORY-08           |
| **Won't Have (W)**  | Reviews and ratings                                    | FR-4.x, D-009           | Sprint 3, STORY-13 |
| **Won't Have (W)**  | Review moderation, payment records and refunds         | FR-5.2, FR-5.3          | Sprint 3, STORY-14 |
| **Won't Have (W)**  | Future-dated bookings                                  | D-001                   | Out of scope       |

---

## 5. Stories & Task Decomposition

Every story still needs its own merged design doc before code starts (D-016). The tasks
below are the expected shape of that design's build order, not a substitute for it.

---

### [STORY-07] Snap-Grid Seat Map Builder — issue #56

- **Story**: _As a Host, I want to build my Space's seat map on a snap grid, so that Seekers can see, and then hold, an exact unit._
- **Story Points**: `10 / 10`
- **Time Estimate**: `5 Days`
- **Assignee**: `Adrian Seth Tabotabo`
- **Git Branch**: `feature/STORY-07-seat-map-builder`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-3.1, SRS §3.2.2 · **Decisions**: D-003, D-004, D-006

#### Tasks

1. Migration: `zones` (Space FK, name, ordering) and `units` (zone FK, `unit_type`,
   label, capacity, grid position, seat state), with enums named as in the Glossary.
2. RLS: public select of the units in a Verified Space; insert, update and delete only by
   the owning Host; read access for an Administrator.
3. pgTAP negative tests: another Host gets **0 rows** for another Space's zones and units,
   and **cannot** insert a unit into a zone they don't own.
4. Server Actions for the builder (D-010): create and rename a zone; add, move, relabel
   and remove a unit; save the layout.
5. Builder UI on a snap grid: place a seat, a standing desk or a whole room; set a label;
   set the capacity of a whole room.
6. Accessible list view of the same layout, with the same add and edit actions
   (SRS §3.2.2).
7. A Supabase Storage bucket for venue photos, with its access policy (STORY-11 uploads
   to it).
8. Regenerate `lib/supabase/database.types.ts` with `npm run db:types`.

#### Acceptance criteria

- [ ] A saved seat map persists and renders the same for a Host and a Seeker.
- [ ] Every unit has a type and a label, and a whole room has a capacity.
- [ ] Another Host gets 0 rows for a Space's zones and units, and cannot change them.
- [ ] Every builder action is reachable from the list view, by keyboard alone.

---

### [STORY-08] Live Geo-Discovery & Curated Tag Filters — issue #57

- **Story**: _As a Seeker, I want to search spaces on a map and narrow them by amenities, so that I only see venues that actually suit me._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Luke Miguel Dongque` (the application), `Adrian Seth Tabotabo` (the database)
- **Git Branch**: `feature/STORY-08-geo-discovery`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-1.1, FR-1.2, FR-5.1 · **Decisions**: D-006, D-012, D-027

#### Tasks

1. Migration (Adrian): the curated tag vocabulary and the Space-to-tag join, with custom
   tags stored apart from curated ones (D-006), the policies that let a Host tag only
   their own Space, and their pgTAP tests.
2. A Leaflet + OpenStreetMap map component with Space pins, and a list synchronized to
   the map; and the Host's form for assigning tags.
3. Location search by a typed place or campus name, and by W3C Geolocation coordinates.
4. A filter panel for the seven curated criteria, combined with AND, plus the mobile
   filter drawer (SRS §3.7.1).
5. A query helper in `lib/data/` that builds the filtered search. Only Verified Spaces
   come back, because RLS already hides the rest (FR-5.1).
6. Unit tests for the filter query builder: two filters return only Spaces that satisfy
   both, and clearing one restores results without a full reload.

#### Acceptance criteria

- [ ] A typed place or campus name, or the device's location, renders matching pins on
      the map and in the list.
- [ ] Selecting a pin shows the Space's name, price tier and distance, and links to its
      profile.
- [ ] Two or more filters return only Spaces that satisfy all of them.
- [ ] A Space that isn't Verified never appears in results.
- [ ] Custom tags are never offered as filters.

---

### [STORY-15] Space Verification (Approve or Reject) — issue #166

- **Story**: _As an Administrator, I want to approve or reject a Pending Space, so that only verified venues reach public search._
- **Story Points**: `3 / 10`
- **Time Estimate**: `1.5 Days`
- **Assignee**: `James Niño Mandawe` (the page), `Adrian Seth Tabotabo` (the policy)
- **Git Branch**: `feature/STORY-15-space-verification`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-5.1 · **Decisions**: D-032, D-037

Split out of STORY-14 so that a Host's new Space can go public during the Prefinal demo.
STORY-14 keeps moderation and payment records in Sprint 3.

#### Tasks

1. Migration (Adrian): a policy and a column grant that let an Administrator change a
   Space's `status`, and nothing else on the row. Nobody else is ever granted `status`
   (STORY-01).
2. pgTAP (Adrian): a Host **cannot** change `status`, their own Space's included; a
   Seeker cannot either; an Administrator can.
3. The `/admin` portal shell (James): a header with the role badge and Log out, like the
   Seeker and Host shells.
4. The verification queue (James): every Pending Space with its address and hours, and
   Approve and Reject buttons.
5. Server Actions for approve and reject (James, D-010): they check the session and the
   input, and RLS decides.
6. A Playwright journey (James): an Administrator approves a Space, and a Seeker then
   finds it.

#### Acceptance criteria

- [ ] An Administrator sees every Pending Space on `/admin` and approves or rejects it.
- [ ] An approved Space is readable by everyone; a Pending or Rejected one stays hidden
      from Seekers.
- [ ] A Host cannot change any Space's Verification status, their own included, and
      neither can a Seeker.
- [ ] Only an Administrator can open `/admin` (D-032).

---

### [STORY-11] Space Profile & Host-Updated Availability — issue #76

- **Story**: _As a Seeker, I want a venue profile showing photos, verified amenities and which units are open right now, so that I can judge the space before travelling._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Maria Faith Antigua`
- **Git Branch**: `feature/STORY-11-space-profile`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-1.3, FR-3.1, SRS §3.2.2 · **Decisions**: D-002, D-006

#### Tasks

1. The Space profile route with photos, hours and both tag kinds, custom tags visibly
   distinguished from curated ones.
2. The Host's photo upload form writing to STORY-07's bucket, and the gallery that reads
   it.
3. The availability view: Available units per zone, and the read-only seat map.
4. A "Host-updated · X min ago" label wherever availability appears, from the unit's
   `updated_at` (D-002), never the words "real-time" or "live" (Glossary).
5. The Seeker's accessible list view of units and their states (SRS §3.2.2), sharing
   STORY-07's component. STORY-09 adds the hold action to an Available unit, in both the
   seat map and the list view.
6. Responsive checks at 360, 768 and 1024 px with no horizontal scrolling.

#### Acceptance criteria

- [ ] The availability view shows the Available units per zone and when they were last
      updated.
- [ ] Custom tags are visibly distinct from curated tags, and are never filterable.
- [ ] The list view shows every unit's state and is fully keyboard navigable.
- [ ] The profile renders without horizontal scrolling at 360, 768 and 1024 px.

---

### [STORY-12] Host Live Occupancy Control — issue #77

- **Story**: _As a Host, I want to set any unit's state with one tap, so that walk-ins and departures are reflected without me answering messages._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `James Niño Mandawe`
- **Git Branch**: `feature/STORY-12-host-occupancy`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-3.2 · **Decisions**: D-002, D-004, D-010

#### Tasks

1. The Host's seat map view with one-tap state control: Available, Reserved, Occupied,
   and no other state (D-004).
2. A Server Action for the state change, stamping `updated_at` so the Seeker-facing
   freshness label stays honest.
3. Walk-in marking: a Host sets Occupied with no reservation in the system.
4. A confirmation before overriding a unit that a Seeker has reserved. STORY-10 adds the
   remaining wait window to the same view.
5. pgTAP tests (Adrian, with STORY-07's policies): a Host cannot change a unit's state in
   a Space they don't own.
6. Sprint 2 QA: extend the test suite, add the Playwright journey from search to the seat
   map and grow it through the hold as STORY-09 and STORY-10 land, and verify the
   Definition of Done before the review.

#### Acceptance criteria

- [ ] A Host's state change shows in the Seeker-facing availability within one refresh.
- [ ] A Host can mark a walk-in Occupied with no reservation in the system.
- [ ] A Host gets 0 rows, and a rejected write, on another Space's units.
- [ ] `npm run check`, `npm run db:test` and `npm run build` pass.

---

### [STORY-09] Reserve-Now Holds & Sandbox Reservation-Fee Payments — issue #58

- **Story**: _As a Seeker, I want to hold an exact open unit and pay a small sandbox fee, so that the seat is guaranteed while I travel to it._
- **Story Points**: `10 / 10`
- **Time Estimate**: `5 Days`
- **Assignee**: `Adrian Seth Tabotabo`
- **Git Branch**: `feature/STORY-09-reserve-now-holds`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-2.1, FR-2.2, FR-2.3, FR-2.5, SRS §3.2.2 · **Decisions**: D-001,
  D-004, D-005, D-008, D-010, D-011

Moved from Sprint 3 when Sprint 2 was baselined (D-036). The design picks the gateway
(PayMongo or Stripe, in test mode, D-005) and the length of both timers (D-004).

#### Tasks

1. Migration: `reservations` (unit FK, Seeker FK, state, wait window, booking token,
   timestamps) and `payments` (fee amount, gateway reference, status: pending, paid,
   forfeited, refunded).
2. The atomic hold: one database function that moves an Available unit to Pending
   Payment and creates the reservation in a single transaction. It rejects a second
   concurrent attempt, and a Seeker who already holds a unit (D-008).
3. RLS: a Seeker sees only their own reservations; a Host sees the reservations on their
   own units; nobody can edit another person's reservation or mark their own payment
   paid.
4. pgTAP tests, including the negatives: another Seeker gets **0 rows**; a Seeker
   **cannot** update the state or the payment status of their own reservation.
5. A concurrency test: two simultaneous holds on one unit, and exactly one succeeds
   (FR-2.5).
6. The hosted-checkout redirect to the sandbox gateway, and the payment webhook as a
   route handler in `app/api/`, the only correct place for it (D-010). The webhook
   checks the gateway's signature before it trusts a payment.
7. On a confirmed payment: the unit becomes Reserved, and the reservation gets an
   unguessable booking token (FR-2.3). STORY-10 shows it as a QR code.
8. The payment window: Pending Payment returns to Available when it lapses. Because
   Hobby cron runs at most daily (D-011), expiry is evaluated on read and on write, not
   by a scheduled job.
9. The Seeker's hold flow: pick an Available unit on the seat map or in the list view
   (SRS §3.2.2), choose a wait window within the Host's bounds, pay, and land on the
   confirmation.
10. Regenerate `lib/supabase/database.types.ts`.

#### Acceptance criteria

- [ ] Only an Available unit can be selected, with a wait window inside the Host's bounds.
- [ ] A Seeker holding one unit cannot hold a second.
- [ ] A unit in Pending Payment is offered to nobody else, and returns to Available when
      the payment window lapses.
- [ ] A confirmed sandbox payment gives exactly one Reserved unit and one booking token,
      and records the fee amount and the gateway reference.
- [ ] Two concurrent holds on one Available unit give exactly one success; the other
      Seeker is told the seat is taken.

---

### [STORY-10] QR Check-in, Wait Window & No-Show Release — issue #59

- **Story**: _As a Host, I want to scan or enter a Seeker's booking token, so that the unit becomes Occupied, and a unit nobody claims releases itself._
- **Story Points**: `8 / 10`
- **Time Estimate**: `4 Days`
- **Assignee**: `Luke Miguel Dongque` (the application), `Adrian Seth Tabotabo` (the database)
- **Git Branch**: `feature/STORY-10-check-in-release`
- **MoSCoW**: `Must Have`
- **Requirements**: FR-2.3, FR-2.4, FR-3.3 · **Decisions**: D-004, D-010, D-011

Moved from Sprint 3 when Sprint 2 was baselined (D-036). It checks in the reservations
and booking tokens that STORY-09 creates.

#### Tasks

1. Database (Adrian): check-in, check-out and release as database functions that change a
   reservation and its unit together, use the token up, and record a forfeited fee; their
   policies; and pgTAP tests (a token works once, and only for the Host of its Space).
2. The booking token as a QR code on the Seeker's dashboard, `/seeker`, in place of the
   "coming in Sprint 3" preview.
3. The check-in route handler in `app/api/` for the Host's scan, plus manual token entry
   when no camera is available (D-010).
4. Check-in moves Reserved to Occupied; check-out and the Host's release move Occupied to
   Available.
5. No-show: when the wait window lapses without a check-in, the unit is released and the
   fee recorded as forfeited, evaluated on read and on write, not by cron (D-011).
6. Closing-time release, so units don't sit Occupied overnight.
7. The Host's view of active reservations and their remaining wait windows (FR-3.3), in
   STORY-12's seat map view.
8. Tests: a token cannot be replayed; a Host cannot check in a token for another Space.

#### Acceptance criteria

- [ ] The Seeker's dashboard shows their booking token as a QR code.
- [ ] Scanning or entering a valid token moves that unit to Occupied.
- [ ] A token works once, and only at the Space that owns the unit.
- [ ] A no-show releases the unit and records the fee as forfeited.
- [ ] Check-out, and the Space's closing time, return the unit to Available.
- [ ] The Host sees each Reserved unit's remaining wait window.

---

## 6. Sequencing & Cross-Story Dependencies

STORY-07 goes first: three stories read the tables it creates.

| This story | Waits for                                                    | Because                         |
| ---------- | ------------------------------------------------------------ | ------------------------------- |
| STORY-07   | Nothing                                                      | Its schema is everyone's base   |
| STORY-08   | Its own task 1 (Adrian's tag tables), for the filters        | The map can start on day one    |
| STORY-15   | Nothing                                                      | It changes only `spaces.status` |
| STORY-11   | STORY-07 tasks 1–3 (schema and RLS) and task 7 (the bucket)  | It renders units and photos     |
| STORY-12   | STORY-07 tasks 1–4                                           | It changes unit state           |
| STORY-09   | STORY-07 tasks 1–3, and STORY-11's seat map and list view    | It holds a unit a Seeker picks  |
| STORY-10   | STORY-09 tasks 1–3 and 7, and its own task 1 (Adrian)        | It checks in a reservation      |

**Critical path:** STORY-07's design → STORY-07's tables → STORY-09's hold and payment →
STORY-10's check-in → the Prefinal demo. A delay anywhere on it delays the demo, so its
pull requests are reviewed and merged first.

| When            | What has to be true                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tue 13 – Wed 14 | All seven design docs open; STORY-07's merged first, then STORY-09's, which STORY-10's design reads                                                               |
| Thu 15 – Fri 16 | STORY-07's tables and RLS merged (tasks 1–3), then STORY-08's tag tables and STORY-15's policy; STORY-08's map and STORY-15's page building                       |
| Sat 17 – Tue 20 | STORY-09's hold and payment, then STORY-10's database functions; STORY-07's builder; STORY-11 and STORY-12 on STORY-07's tables; STORY-10's QR code and scan page |
| Wed 21 – Thu 22 | STORY-10 wired to STORY-09's reservations; a full walk-through as each role; fixes                                                                                |
| Fri 23          | Sprint 2 review and the Prefinal demo                                                                                                                             |

**Risks.**

- The critical path runs through Adrian: his two 10-point stories, and the database half
  of STORY-08, STORY-10 and STORY-15. Database pull requests are reviewed and merged
  first, because the other stories wait for them. There is no cut line (D-036): if the
  path slips, the Sprint 2 review decides what carries over.
- The sandbox gateway is new to the team. Its test keys, hosted checkout and webhook
  (which needs a public URL, such as a Vercel preview) are set up first in STORY-09.
- FR-2.5 needs a real concurrency test, two holds at the same moment, not two holds one
  after the other.

---

## 7. Project Management Board Mapping

The board keeps the five columns the course requires. At the start of Sprint 2 the second
column is renamed **Sprint 2 Backlog** (D-038). WIP limits stay at 4 for In Progress and
4 for Code Review.

| Card ID    | Card Title                                 | Column (at baselining) | Assignee                        | Points  | Time Est. | MoSCoW    |
| ---------- | ------------------------------------------ | ---------------------- | ------------------------------- | ------- | --------- | --------- |
| `STORY-07` | Snap-Grid Seat Map Builder                 | Sprint 2 Backlog       | Adrian Seth Tabotabo            | 10 / 10 | 5 Days    | Must Have |
| `STORY-08` | Live Geo-Discovery & Curated Tag Filters   | Sprint 2 Backlog       | Luke Miguel Dongque, Adrian     | 8 / 10  | 4 Days    | Must Have |
| `STORY-15` | Space Verification (Approve or Reject)     | Sprint 2 Backlog       | James Niño Mandawe, Adrian      | 3 / 10  | 1.5 Days  | Must Have |
| `STORY-11` | Space Profile & Host-Updated Availability  | Sprint 2 Backlog       | Maria Faith Antigua             | 8 / 10  | 4 Days    | Must Have |
| `STORY-12` | Host Live Occupancy Control                | Sprint 2 Backlog       | James Niño Mandawe              | 8 / 10  | 4 Days    | Must Have |
| `STORY-09` | Reserve-Now Holds & Sandbox Payments       | Sprint 2 Backlog       | Adrian Seth Tabotabo            | 10 / 10 | 5 Days    | Must Have |
| `STORY-10` | QR Check-in, Wait Window & No-Show Release | Sprint 2 Backlog       | Luke Miguel Dongque, Adrian     | 8 / 10  | 4 Days    | Must Have |

**Issue mapping.** `STORY-07` #56 · `STORY-08` #57 · `STORY-09` #58 · `STORY-10` #59 ·
`STORY-11` #76 · `STORY-12` #77 · `STORY-15` #166. The carried-over bugs are #145 and #146
(fixes in review: #164, #165).

---

## 8. Decisions Taken at Baselining

The draft of this plan left five questions open (its §8). They are settled here:

1. **How does a Space become public before the administration console exists?** An
   Administrator approves or rejects it, in a story of its own: STORY-15 (D-037).
   Seeding Verified Spaces was rejected, because a Host's new Space could never go
   public.
2. **What is the second board column called?** It is renamed each sprint, "Sprint 2
   Backlog" now (D-038, which supersedes D-022; the board guide already said so).
3. **Do STORY-11 and STORY-12 get their own issues?** Yes: #76 and #77. STORY-15 is new
   (#166), and STORY-09 (#58) and STORY-10 (#59) move in from Sprint 3, because Sprint 2
   builds every Must Have (D-036).
4. **How is a unit's grid position stored?** STORY-07's design decides it and records
   it.
5. **Zone-level and unit-level curated tags?** Not this sprint. Sprint 2 ships tags at
   Space level; the rest is a Could Have (§4).

STORY-09's design doc settles the questions the Sprint 3 draft used to carry:

- the sandbox gateway, PayMongo or Stripe (D-005). Its account and test keys take time, so
  this comes first;
- the length of the payment window, and the bounds a Host may set on the wait window
  (D-004);
- the reservation fee: a fixed sandbox amount, or one the Host sets;
- what a Seeker sees when their hold expires while the page is open, given that expiry is
  evaluated on read and on write (D-011);
- whether a whole room with a capacity takes one hold (FR-2.1 treats it as one unit).

---

## 9. Definition of Done

The Sprint 1 Definition of Done applies unchanged
([`StudyHub_Sprint_1_Plan.md`](StudyHub_Sprint_1_Plan.md) §6): branch and squash merge,
merged design doc first, local checks, green CI, RLS with negative tests, accessibility
and responsiveness, criteria ticked by the person who verified them, peer review, docs
updated, tracking closed.

Sprint 2 adds four checks, because this is the first sprint with a spatial UI and real
holds:

- **Seat map parity**: every action available on the snap grid is available in the list
  view, by keyboard alone, the hold included (SRS §3.2.2).
- **Freshness honesty**: every surface showing availability shows when a Host last updated
  it, and no surface calls host-maintained data "real-time" or "live" (D-002, Glossary).
- **No double booking**: the concurrent-hold test passes, with exactly one success
  (FR-2.5, D-008).
- **Sandbox only**: payments use the gateway's test keys, kept only in environment
  variables, and no card or e-wallet data touches StudyHub (D-005, D-029).

_End of Sprint 2 Plan._
