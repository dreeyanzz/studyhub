# STORY-10: Booking token, QR check-in and unit release

**Status:** draft · **Owner:** @lukedongque · **Story:** #59 · **FR:** FR-2.3, FR-2.4, FR-3.3 ·
**Depends on:** STORY-01, STORY-03, STORY-05, STORY-07, STORY-09, STORY-12 ·
**Flows:** [Check-in](../flows/check-in.md) (approved), [Reservation lifecycle](../flows/reservation-lifecycle.md) (approved), [Seeker journey](../flows/seeker-journey.md) (approved), [Host setup journey](../flows/host-setup-journey.md) (approved) ·
**Decisions:** D-002, D-004, D-008, D-009, D-010, D-011, D-027, D-042, D-044, D-046 to D-052, D-057, D-059, D-060, D-066, D-067, D-068

---

## 0. Scope

### In

- **Database migrations, functions, and pgTAP tests (Luke, D-066):**
  - Helper function `private.last_closing_time(p_opens_at time, p_closes_at time, p_at timestamptz)` determining the most recent closing boundary in `Asia/Manila` (D-027, D-048).
  - Complete `private.record_lapses(p_unit_ids uuid[])` (D-047) by adding steps 2, 3, and 4 to STORY-09's step 1:
    - Step 2: each `reserved` hold whose `wait_window_ends_at <= clock_timestamp()` transitions to `no_show`, with its payment updated to `forfeited` (R7, D-005).
    - Step 3: each `occupied` hold checked in before its Space's last closing time transitions to `completed` (R12), payment staying `paid`.
    - Step 4: each unit whose Host set it to `reserved` or `occupied` before its Space's last closing time resets `host_state = 'available'` (H3), leaving `units.host_updated_at` untouched (D-051).
  - Database function `public.check_in(p_token text, p_space_id uuid) returns jsonb`:
    - Validates caller is the Space's Host (`42501` on mismatch).
    - Unlocked probe on `reservations.booking_token` (`invalid_token`).
    - Enforces Space boundary check (`p_space_id = space_id`) before state changes; if wrong Space, fails early with `P0001` hint `wrong_space`, keeping reservation intact (D-060).
    - Locks the unit row first (`FOR UPDATE OF u`), then locks the reservation row (`FOR UPDATE`) to prevent deadlocks with Host overrides (D-047).
    - Runs `private.record_lapses(array[v_unit.id])`.
    - Evaluates status branches: returns outcome `wait_window_lapsed` without transaction rollback so fee forfeiture commits (C2); rejects `token_already_used` (C3), `reservation_cancelled` (C4), or `invalid_state`; transitions to `occupied` on success (C1, R6).
  - Database function `public.check_out(p_reservation_id uuid default null) returns jsonb`:
    - Validates caller is the Seeker who holds the active reservation (`42501` on mismatch, N8).
    - Locks unit row, then reservation row.
    - Transitions `occupied` reservation to `completed` (R10), setting `checked_out_at = clock_timestamp()` and `ended_at = clock_timestamp()`. Payment remains `paid`. Releases the unit so seat state reads `available`.
  - Update `public.unit_states(p_space_id uuid)`:
    - Populates `wait_window_ends_at` strictly for the Space's Host (`v_is_host`) when `r.status = 'reserved'`; returns `null` for non-hosts and other states (N20, FR-3.3).
  - Trigger `private.check_space_hours_on_update()` on `spaces` (N22):
    - Confirms that changing Space operating hours does not cut into active visits (`occupied`) or active holds (`pending_payment`, `reserved`).
  - Comprehensive pgTAP tests in `supabase/tests/10-check-in-release.sql` covering C1–C7, R6, R7, R10, R12, H3, N8, N9, N10, N16, N20, and C-N1 to C-N4.
  - Concurrency test in `supabase/tests/race/check-in.race.mjs`: two staff devices scanning the same token at once yield exactly one `occupied` check-in and one `token_already_used` refusal (C3).
- **Application logic, normalization & validation (`lib/`):**
  - Crockford base32 normalization in `lib/check-in/normalize.ts`: strip whitespace and hyphens, uppercase conversion, map `O`/`o` → `0`, map `I`/`i`/`L`/`l` → `1`, format as `ABCD-EFGH-JKMN` (D-059).
  - Zod validation schemas in `lib/validation/check-in.ts`: `checkInSchema` (12-character normalized Crockford base32 token, valid UUID `spaceId`) and `checkOutSchema` (optional UUID `reservationId`).
  - Countdown and time utilities in `lib/check-in/countdown.ts`: calculates remaining wait window seconds against server timestamps and formats as `MM:SS` or `X min left`.
  - Co-located Vitest unit tests in `lib/check-in/normalize.test.ts`, `lib/validation/check-in.test.ts`, and `lib/check-in/countdown.test.ts`.
- **Seeker Dashboard QR Code & Active Reservation (`/seeker`):**
  - Pure SVG QR code component in `components/reservation/qr-code.tsx`: accessible, high-contrast, zero-runtime-dependency vector QR rendering the raw 12-character token string (D-059).
  - Active reservation card `app/(dashboard)/seeker/_components/active-reservation-card.tsx`:
    - `reserved`: venue name, address, unit label, zone name, live wait-window countdown, SVG QR code, grouped token `ABCD-EFGH-JKMN` with one-click copy, and "Cancel hold" action (R8, forfeits fee with confirmation).
    - `occupied`: "Checked In · Unit [Label] ([Zone])", check-in timestamp, and self check-out button (`check_out`, R10).
    - `pending_payment`: prompt linking to `/seeker/reservations/[id]`.
  - Server Actions in `app/(dashboard)/seeker/actions.ts`: `checkOutAction` and `cancelPaidHoldAction`.
- **Host Check-In Portal (`/host/spaces/[spaceId]/check-in`):**
  - Server Component `page.tsx`: verifies Host ownership of `spaceId`, loads Space details.
  - Dual-mode check-in shell `check-in-shell.tsx`: camera viewfinder scanner and manual alphanumeric entry.
  - Camera Viewfinder `camera-scanner.tsx`: HTML5 camera capture via `navigator.mediaDevices.getUserMedia` using standard `BarcodeDetector` API (with canvas stream fallback), torch toggle if supported, camera permission request handling, and clear fallback states.
  - Manual Entry `manual-entry-form.tsx`: auto-normalizing input, 12-character Crockford base32 validation, and immediate submission.
  - Server Action `checkInAction(spaceId, token)` in `app/(dashboard)/host/spaces/[spaceId]/check-in/actions.ts` (D-010, D-060).
  - Result Banner `check-in-result-banner.tsx`: accessible alerts for C1 success, C2 lapsed window, C3 already used, C4 cancelled, C5 wrong space, C6 invalid token, and C7 forbidden.
- **Host Live Occupancy Wait Window Display (`/host/spaces/[spaceId]/occupancy`):**
  - Update `UnitControlCard` and `OccupancyList`: render remaining wait window badge/chip on `reserved` units (`wait_window_ends_at`) with live countdown (FR-3.3).
  - Navigation shortcut to `/host/spaces/[spaceId]/check-in` from occupancy page header.
- **End-to-End Tests (`e2e/check-in.spec.ts`):**
  - Seeker reserves and pays → receives QR token on dashboard → Host checks in at `/host/spaces/[spaceId]/check-in` → unit turns Occupied → Seeker checks out → unit returns to Available.
  - Host at Space B enters token for Space A → receives `wrong_space` refusal → Space A hold remains intact.

### Out

- Creating the reservation, sandbox checkout, and generating the token (STORY-09, #58).
- One-tap Host seat overrides and manual walk-ins (STORY-12, #77).
- Space profile presentation and unit selection (STORY-11, #76).
- Post-visit reviews (STORY-13, Sprint 3, FR-4.1).
- Sandbox refunds (P1) and Administrator moderation (STORY-14, Sprint 3, FR-5.3).

---

## 1. Flow

### Shared flows (D-044)

- **[Check-in](../flows/check-in.md):**
  - Implements branches C1 through C7, camera viewfinder scan and manual alphanumeric entry methods, input normalization, and `public.check_in`.
- **[Reservation lifecycle](../flows/reservation-lifecycle.md):**
  - Implements moves R6 (`reserved` → `occupied`), R7 (`reserved` → `no_show`), R10 (`occupied` → `completed`), R12 (`occupied` → `completed` at closing), and H3 (Host-set state reset at closing).
  - Implements the lapse step's steps 2, 3, and 4 in `private.record_lapses`.
  - Implements wait windows in `public.unit_states` (N20, FR-3.3).
- **[Seeker journey](../flows/seeker-journey.md):**
  - Implements step S34 (Reserved unit and booking token on `/seeker`) and step S39 (token ready for check-in).
- **[Host setup journey](../flows/host-setup-journey.md):**
  - Implements Host access to the check-in interface from the Space dashboard.

### This story's own part

```mermaid
sequenceDiagram
    autonumber
    actor S as Seeker
    participant SUI as Seeker Dashboard (/seeker)
    actor H as Host
    participant HUI as Host Check-In (/host/spaces/[id]/check-in)
    participant A as Server Action (actions.ts)
    participant DB as Postgres (RLS & Functions)

    Note over S,SUI: 1. Display Booking Token (FR-2.3)
    S->>SUI: Opens dashboard to view active reservation
    SUI->>DB: Calls my_reservation()
    DB-->>SUI: Returns reserved status, wait_window_ends_at, booking_token
    SUI-->>S: Displays SVG QR code, ABCD-EFGH-JKMN text, and wait countdown
    S->>H: Presents QR code or speaks code at venue desk

    Note over H,HUI: 2. Check-In Arrival (FR-2.4, D-060)
    alt In-Portal Camera Scan
        H->>HUI: Points camera at Seeker QR code
        HUI->>HUI: Reads raw 12-char token string
        HUI->>A: checkInAction(spaceId, token)
    else Manual Entry
        H->>HUI: Types code (e.g. ABCD-EFGH-JKMN) and submits
        HUI->>HUI: Normalizes input (strip hyphens, map O/I/L)
        HUI->>A: checkInAction(spaceId, token)
    end

    A->>DB: CALL public.check_in(token, space_id)
    Note over DB: Step 1: Host authorization check (42501)<br/>Step 2: Unlocked probe by token (invalid_token)<br/>Step 3: Wrong Space check (p_space_id != space_id)<br/>Step 4: Lock unit (FOR UPDATE OF u), then reservation (FOR UPDATE)<br/>Step 5: private.record_lapses(array[unit_id])

    alt C1: Valid check-in within wait window (R6)
        DB-->>A: { outcome: 'success', unit_label, zone_name }
        A-->>HUI: Success banner: "Checked in unit [Unit Label] ([Zone Name])"
        HUI-->>H: Unit highlights Occupied on seat map
        SUI-->>S: Dashboard card transitions to "Checked In · Unit [Unit Label]"
    else C2: Wait window lapsed with no check-in (R7)
        Note over DB: Lapses committed without rollback: status=no_show, payment=forfeited
        DB-->>A: { outcome: 'wait_window_lapsed', unit_label }
        A-->>HUI: Notice: "Wait window lapsed. Unit released and fee forfeited."
        SUI-->>S: Dashboard shows: "Wait window lapsed · Unit released"
    else C5: Token presented at wrong Space (D-060)
        DB-->>A: P0001 (wrong_space)
        A-->>HUI: Warning: "This reservation is for a different Space. No changes were made."
        Note over SUI: Hold at correct Space remains intact
    else Other refusals (C3, C4, C6, C7)
        DB-->>A: P0001 hint or 42501 error
        A-->>HUI: Alert banner with specific error reason
    end

    Note over S,SUI: 3. Seeker Self Check-Out (FR-2.4, R10)
    S->>SUI: Clicks "Check Out" on occupied reservation
    SUI->>A: checkOutAction(reservationId)
    A->>DB: CALL public.check_out(reservation_id)
    Note over DB: Locks unit and reservation; sets status=completed, checked_out_at=now()<br/>Releases unit so seat_state reads available
    DB-->>A: { outcome: 'success' }
    A-->>SUI: Visit completed; unit reads Available
```

---

## 2. Data and state

### Modified tables

No new tables are introduced. This story operates on the schema established in `20261108033000_reservations.sql`:

- `public.reservations`:
  - `status public.reservation_status` (transitions `reserved` → `occupied`, `reserved` → `no_show`, `occupied` → `completed`).
  - `checked_in_at timestamptz`: set by `public.check_in` upon successful check-in (R6).
  - `checked_out_at timestamptz`: set by `public.check_out` upon Seeker checkout (R10).
  - `ended_at timestamptz`: set whenever a reservation reaches a terminal state (`no_show`, `completed`).
- `public.payments`:
  - `status public.payment_status`: moves from `paid` → `forfeited` when a reservation lapses into `no_show` (R7).
- `public.units`:
  - `host_state text`: resets to `'available'` at Space closing time (H3) without touching `host_updated_at` (D-051).

### State transitions

| From                         | Event              | To          | Precondition                                           | Who / Function                                    | Payment                           |
| :--------------------------- | :----------------- | :---------- | :----------------------------------------------------- | :------------------------------------------------ | :-------------------------------- |
| `reserved`                   | Host check-in      | `occupied`  | Valid token, matching `space_id`, within wait window   | Space's Host (`public.check_in`) [R6]             | Stays `paid`                      |
| `reserved`                   | Wait window lapses | `no_show`   | `wait_window_ends_at <= clock_timestamp()`             | Time / lapse step (`private.record_lapses`) [R7]  | `paid` → `forfeited`              |
| `occupied`                   | Seeker check-out   | `completed` | Caller is the hold's Seeker (`seeker_id = auth.uid()`) | Seeker (`public.check_out`) [R10]                 | Stays `paid`                      |
| `occupied`                   | Space closing time | `completed` | `checked_in_at < last_closing_time`                    | Time / lapse step (`private.record_lapses`) [R12] | Stays `paid`                      |
| Host `reserved` / `occupied` | Space closing time | `available` | `host_updated_at < last_closing_time`                  | Time / lapse step (`private.record_lapses`) [H3]  | N/A (`host_updated_at` unchanged) |

### Database functions contract

#### 1. `private.last_closing_time(p_opens_at time, p_closes_at time, p_at timestamptz) returns timestamptz`

- Computes the most recent closing boundary for a Space in `Asia/Manila` (UTC+8, D-027, D-048).
- If `p_opens_at = p_closes_at` (24-hour venue), returns `null`.
- Let `v_closing_today := ((p_at at time zone 'Asia/Manila')::date + p_closes_at) at time zone 'Asia/Manila'`.
- If `p_at >= v_closing_today`, returns `v_closing_today`.
- Otherwise, returns `(((p_at at time zone 'Asia/Manila')::date - 1) + p_closes_at) at time zone 'Asia/Manila'`.

#### 2. `private.record_lapses(p_unit_ids uuid[]) returns void`

- Step 1 (STORY-09): expired `pending_payment` holds (`payment_window_ends_at <= clock_timestamp()`) → `expired`.
- Step 2 (STORY-10): lapsed `reserved` holds (`wait_window_ends_at <= clock_timestamp()`):
  - Sets `reservations.status = 'no_show'`, `ended_at = clock_timestamp()`.
  - Sets corresponding `payments.status = 'forfeited'` (R7).
- Step 3 (STORY-10): closing visits on `occupied` holds:
  - If `last_closing_time` exists and `checked_in_at < last_closing_time`:
  - Sets `reservations.status = 'completed'`, `ended_at = clock_timestamp()` (R12).
- Step 4 (STORY-10): reset Host manual occupancy at closing:
  - For units where `host_state in ('reserved', 'occupied')` and `host_updated_at < last_closing_time`:
  - Resets `units.host_state = 'available'`, leaving `units.host_updated_at` unchanged (H3, D-051).

#### 3. `public.check_in(p_token text, p_space_id uuid) returns jsonb`

- Caller verification: `auth.uid()` must be the owner of `p_space_id` (`spaces.host_id = auth.uid()`). If not, raises `42501` (`insufficient_privilege`).
- Unlocked probe: lookup `reservations` where `booking_token = p_token`. If not found, raises `P0001` hint `invalid_token`.
- Wrong Space check (D-060): if `reservation.space_id != p_space_id`, raises `P0001` hint `wrong_space`.
- Lock order: locks `units` row first `FOR UPDATE OF u`, then locks `reservations` row `FOR UPDATE` (D-047).
- Lapses: executes `private.record_lapses(array[v_unit.id])`.
- Re-reads status:
  - If `no_show`: returns `jsonb_build_object('outcome', 'wait_window_lapsed', 'unit_id', v_unit.id, 'unit_label', v_unit.label)` (returns JSON without raising so the lapse commit persists).
  - If `cancelled`: raises `P0001` hint `reservation_cancelled`.
  - If `occupied` or `completed`: raises `P0001` hint `token_already_used`.
  - If not `reserved`: raises `P0001` hint `invalid_state`.
- Mutation: `update public.reservations set status = 'occupied', checked_in_at = clock_timestamp() where id = v_res.id`.
- Return: `jsonb_build_object('outcome', 'success', 'unit_id', v_unit.id, 'unit_label', v_unit.label, 'zone_name', v_unit.zone_name)`.

#### 4. `public.check_out(p_reservation_id uuid default null) returns jsonb`

- Caller verification: `auth.uid()` must not be null.
- Lookup: finds reservation where `status = 'occupied'` and `seeker_id = auth.uid()` (scoped to caller's row). If `p_reservation_id` is supplied, matches exact id; otherwise selects caller's active occupied reservation.
- If not found or belongs to another user: raises `P0001` hint `reservation_not_found` or `42501`.
- Lock order: locks unit `FOR UPDATE OF u`, then reservation `FOR UPDATE`.
- Mutation: `update public.reservations set status = 'completed', checked_out_at = clock_timestamp(), ended_at = clock_timestamp() where id = v_res.id`.
- Return: `jsonb_build_object('outcome', 'success', 'reservation_id', v_res.id, 'unit_id', v_res.unit_id)`.

#### 5. `public.unit_states(p_space_id uuid)`

- Executes `private.record_lapses(v_unit_ids)` on all units in Space.
- Evaluates `v_is_host := ((select auth.uid()) is not distinct from v_host_id)`.
- Returns `case when v_is_host and r.status = 'reserved' then r.wait_window_ends_at else null end as wait_window_ends_at` (N20, FR-3.3).

### Zod schemas (`lib/validation/check-in.ts`)

```typescript
import { z } from 'zod'

/**
 * Validates 12-character Crockford base32 booking token (D-059).
 * Preprocessing strips whitespace and hyphens, and normalizes O->0 and I/L->1.
 */
export const bookingTokenSchema = z
  .string()
  .min(1, 'Please enter a booking token')
  .transform((val) => val.replace(/[\s-]/g, '').toUpperCase())
  .transform((val) => val.replace(/[O]/g, '0').replace(/[IL]/g, '1'))
  .pipe(
    z
      .string()
      .regex(
        /^[0-9A-HJKMNP-TV-Z]{12}$/,
        'Booking token must be 12 characters from the Crockford base32 alphabet',
      ),
  )

export const checkInSchema = z.object({
  spaceId: z.string().uuid('Invalid Space ID'),
  token: bookingTokenSchema,
})

export const checkOutSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID').optional(),
})

export const cancelPaidHoldSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
})
```

### RLS policies and GRANTs

| Object                      | Verb / Call | Role                  | Condition / Grant                                       |
| :-------------------------- | :---------- | :-------------------- | :------------------------------------------------------ |
| `private.last_closing_time` | EXECUTE     | None                  | Revoked from `public, anon, authenticated`              |
| `private.record_lapses`     | EXECUTE     | None                  | Revoked from `public, anon, authenticated`              |
| `public.check_in`           | EXECUTE     | `authenticated`       | Revoked from `public, anon`; granted to `authenticated` |
| `public.check_out`          | EXECUTE     | `authenticated`       | Revoked from `public, anon`; granted to `authenticated` |
| `public.unit_states`        | EXECUTE     | `anon, authenticated` | Granted to `anon, authenticated`                        |

---

## 3. UI and files

### User experience (Maria decides, D-042)

#### 1. Seeker Dashboard (`/seeker`)

- **Active Reservation Card (`ActiveReservationCard`):**
  - Displays above `ProfileForm` and `PreviewCards` whenever the Seeker has an active hold or visit (`my_reservation()`).
  - **Reserved State (Ready for Check-In):**
    - Header: Space name, address, unit label, and zone badge.
    - Countdown timer: "Time remaining to check in: MM:SS" with clock icon; updates smoothly in client state against server `wait_window_ends_at`.
    - Pure SVG QR code (minimum 180×180 px on mobile, 220×220 px on desktop) centered in a crisp white border with high contrast (WCAG 2.1 AA).
    - Grouped alphanumeric text directly below QR: `ABCD-EFGH-JKMN` with a 48×48 px "Copy code" button.
    - Supporting note: "Present this QR code to the host or recite your code upon arrival."
    - Secondary action: "Cancel hold" button triggering a confirmation modal: "Cancelling a paid reservation releases your seat immediately and forfeits the ₱50.00 fee."
  - **Occupied State (Checked In):**
    - Banner: "Checked In · Unit [Unit Label] ([Zone Name])".
    - Timestamp: "Arrived at [Time]".
    - Primary action: 48×48 px "Check Out" button. Prompts confirmation: "Are you ready to leave? This will release unit [Unit Label] for other seekers."
  - **Pending Payment State:**
    - Notice with button: "Complete your reservation payment before the payment window ends" linking directly to `/seeker/reservations/[id]`.

#### 2. Host Check-In Portal (`/host/spaces/[spaceId]/check-in`)

- Accessible via a prominent "Check-In Desk" action button in the Host portal navigation and on `/host/spaces/[spaceId]/occupancy`.
- **Check-in Shell (`CheckInShell`):**
  - Mobile-optimized card layout with tabbed switcher:
    - Tab 1: **Camera Scanner** (default on mobile devices with camera access).
    - Tab 2: **Manual Entry** (text input with auto-formatting).
- **Camera Scanner (`CameraScanner`):**
  - Viewfinder with rounded visual scan frame and animated alignment reticle.
  - Camera permission status handling: "Allow camera access to scan booking QR codes" button if not granted.
  - Fallback message if no camera detected: "Camera unavailable. Use manual code entry below."
  - Auto-submits on recognized QR code without double-triggering.
- **Manual Entry Form (`ManualEntryForm`):**
  - Monospace text input with placeholder `ABCD-EFGH-JKMN`.
  - Auto-capitalizes, strips hyphens, and formats in 4-character blocks as the Host types.
  - "Check In" button (disabled when string length < 12, enabled with high contrast when valid).
- **Result Banner (`CheckInResultBanner`):**
  - **C1 Success:** Emerald banner: "Checked in unit [Unit Label] ([Zone Name])" with link to occupancy seat map.
  - **C2 Lapsed Wait Window:** Amber alert: "Wait window lapsed. Unit has been released and reservation fee forfeited."
  - **C3 Already Used:** Amber alert: "This token was already checked in. Unit is currently Occupied."
  - **C4 Cancelled:** Amber alert: "This reservation was cancelled."
  - **C5 Wrong Space:** Red warning: "This reservation is for a different Space. No changes were made."
  - **C6 Invalid Token:** Destructive alert: "Invalid booking token. Please check the code."
  - **C7 Forbidden:** Destructive alert: "Access denied. You must be signed in as the host of this Space."

#### 3. Host Live Occupancy Wait Window Badges (`/host/spaces/[spaceId]/occupancy`)

- On each unit tile in `reserved` state on the seat map and in the accessible list:
  - Blue clock badge displaying live remaining time: "Wait: 18m left" or "Wait: < 1m".
  - Refreshes automatically or warns when expiry is reached.

### Routes and components

| Route / File                                                                            | Type             | Purpose                                                                 |
| :-------------------------------------------------------------------------------------- | :--------------- | :---------------------------------------------------------------------- |
| `app/(dashboard)/seeker/page.tsx`                                                       | Server Component | Fetches profile and active reservation; renders `ActiveReservationCard` |
| `app/(dashboard)/seeker/actions.ts`                                                     | Server Action    | `checkOutAction`, `cancelPaidHoldAction`                                |
| `app/(dashboard)/seeker/_components/active-reservation-card.tsx`                        | Client Component | Renders QR code, grouped token, countdown, and checkout button          |
| `components/reservation/qr-code.tsx`                                                    | Client Component | Pure SVG QR code vector generator                                       |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/page.tsx`                               | Server Component | Host check-in portal page; verifies Host ownership                      |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/actions.ts`                             | Server Action    | `checkInAction(spaceId, token)`                                         |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/_components/check-in-shell.tsx`         | Client Component | Shell managing camera scan / manual entry tabs and result states        |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/_components/camera-scanner.tsx`         | Client Component | HTML5 camera viewfinder using `BarcodeDetector` / video element         |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/_components/manual-entry-form.tsx`      | Client Component | Crockford base32 text input form with auto-formatting                   |
| `app/(dashboard)/host/spaces/[spaceId]/check-in/_components/check-in-result-banner.tsx` | Client Component | Accessible result notification for C1–C7 outcomes                       |
| `app/(dashboard)/host/spaces/[spaceId]/occupancy/_components/unit-control-card.tsx`     | Client Component | Enhanced with remaining wait window badge for reserved units            |
| `app/(dashboard)/host/spaces/[spaceId]/occupancy/_components/occupancy-list.tsx`        | Client Component | Accessible list view updated with wait window display                   |

### Where the files go

```
app/
  (dashboard)/
    seeker/
      _components/
        active-reservation-card.tsx
        active-reservation-card.test.tsx
      actions.ts
      actions.test.ts
      page.tsx
    host/
      spaces/
        [spaceId]/
          check-in/
            _components/
              camera-scanner.tsx
              check-in-result-banner.tsx
              check-in-shell.tsx
              manual-entry-form.tsx
              manual-entry-form.test.tsx
            actions.ts
            actions.test.ts
            page.tsx
components/
  reservation/
    qr-code.tsx
    qr-code.test.tsx
lib/
  check-in/
    countdown.ts
    countdown.test.ts
    normalize.ts
    normalize.test.ts
  validation/
    check-in.ts
    check-in.test.ts
supabase/
  migrations/
    20261113000000_check_in_and_release.sql
  tests/
    10-check-in-release.sql
    race/
      check-in.race.mjs
e2e/
  check-in.spec.ts
```

### Accessibility

- **Touch targets:** All interactive buttons (Check Out, Copy Code, Scan, Submit) meet or exceed the 48×48 px minimum target requirement (WCAG 2.1 AA, D-031).
- **High contrast:** SVG QR code modules render in dark charcoal (`#09090b`) on pure white (`#ffffff`) background with quiet zone margins, ensuring high optical contrast ratio exceeding 7:1.
- **Screen reader announcements:**
  - QR code contains accessible metadata: `role="img"` and `aria-label="Booking QR code for token ABCD-EFGH-JKMN"`.
  - Countdown timer updates are designated `aria-live="polite"` with rate-throttled updates every 30 seconds to prevent screen reader buffer flooding.
- **Keyboard navigation:** Full keyboard-only workflow on the check-in portal: focus lands cleanly on the token input field; Enter triggers submission; Tab moves to clear and submit controls.
- **Responsive design:** Layout fluidly accommodates 360 px, 768 px, and 1024 px viewports without horizontal scrolling.

---

## 4. Security and test matrix

| Layer           | Case                                                              | Expected Result                                                                                                                                                                                              |
| :-------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pgTAP**       | C1: Host checks in valid token for their Space within wait window | `public.check_in` succeeds; unit seat state reads Occupied; `checked_in_at` stamped; payment stays `paid`                                                                                                    |
| **pgTAP**       | C2: Token presented after wait window has lapsed                  | `public.check_in` returns `{ outcome: 'wait_window_lapsed' }`; reservation is `no_show`; payment is `forfeited`; unit reads Available                                                                        |
| **pgTAP**       | C3: Token already checked in (`occupied` or `completed`)          | Refused with `P0001` hint `token_already_used`                                                                                                                                                               |
| **pgTAP**       | C4: Reservation cancelled before check-in                         | Refused with `P0001` hint `reservation_cancelled`                                                                                                                                                            |
| **pgTAP**       | C5: Token for Space A presented at Space B (D-060)                | Refused with `P0001` hint `wrong_space`; Space A reservation stays intact                                                                                                                                    |
| **pgTAP**       | C6: Invalid or non-existent token string                          | Refused with `P0001` hint `invalid_token`                                                                                                                                                                    |
| **pgTAP**       | C7: Caller is not the Host of `p_space_id` (or signed-out)        | Rejected with SQLSTATE `42501` (`insufficient_privilege`)                                                                                                                                                    |
| **pgTAP**       | R10: Seeker checks out their occupied reservation                 | `public.check_out` succeeds; status is `completed`; `checked_out_at` stamped; unit reads Available; payment stays `paid`                                                                                     |
| **pgTAP**       | N8: Seeker attempts to check out another Seeker's reservation     | Rejected with `42501` or `P0001`                                                                                                                                                                             |
| **pgTAP**       | R12: Space closing time passes while unit is Occupied             | `record_lapses` moves status to `completed`; unit reads Available; payment stays `paid`                                                                                                                      |
| **pgTAP**       | H3: Space closing time passes for Host-set Reserved/Occupied unit | `record_lapses` resets `host_state` to `available`; `host_updated_at` remains unchanged (D-051, N16)                                                                                                         |
| **pgTAP**       | N20: Non-host reads `unit_states`                                 | `wait_window_ends_at` is `null` for signed-out visitors and Seekers                                                                                                                                          |
| **Concurrency** | Two staff devices scanning the same token concurrently            | Dedicated Node script (`check-in.race.mjs`) executing two simultaneous calls: exactly one succeeds (R6), other receives `token_already_used` (C3)                                                            |
| **Vitest**      | Crockford base32 normalization (`lib/check-in/normalize.ts`)      | Strips hyphens/spaces; upper-cases; maps `O`→`0`, `I`/`L`→`1`; rejects invalid characters; formats `ABCD-EFGH-JKMN`                                                                                          |
| **Vitest**      | Zod validation schemas (`lib/validation/check-in.ts`)             | Rejects malformed tokens, non-UUID space IDs, and invalid checkout parameters                                                                                                                                |
| **Vitest**      | Countdown helper (`lib/check-in/countdown.ts`)                    | Accurately calculates remaining seconds against deadline and handles expired timestamps                                                                                                                      |
| **Vitest**      | Pure SVG QR code generator (`components/reservation/qr-code.tsx`) | Produces valid SVG DOM, accurate dark/light module matrix, and accessible ARIA attributes                                                                                                                    |
| **Vitest**      | Server Actions (`actions.ts`)                                     | Validates caller session, forwards validated arguments, and translates SQLSTATE hints into UI messages                                                                                                       |
| **Manual**      | Full check-in & release journey on local stack                    | Seeded Seeker holds and pays for unit → receives QR code on `/seeker` → Host scans/enters token at `/host/spaces/[spaceId]/check-in` → unit becomes Occupied → Seeker checks out → unit returns to Available |
| **Manual**      | Wrong Space isolation                                             | Host at Space B enters token for Space A → sees `wrong_space` alert → Space A reservation remains intact                                                                                                     |

---

## 5. Tasks and estimates

These rows become the story's TSK sub-issues once this design doc is merged.

| Task         | What                                                                                          | Owner        | Points (1–10) | Days | Depends on                   |
| :----------- | :-------------------------------------------------------------------------------------------- | :----------- | :------------ | :--- | :--------------------------- |
| **TSK-10.1** | Database migration, check-in, check-out, lapse steps 2–4, and pgTAP tests (D-066)             | @lukedongque | 2             | 1    | STORY-09                     |
| **TSK-10.2** | Token normalization, Zod validation schemas, countdown logic, and unit tests                  | @lukedongque | 1             | 0.5  | none                         |
| **TSK-10.3** | Pure SVG QR code generator and Seeker dashboard active reservation card with check-out        | @lukedongque | 2             | 1    | TSK-10.2                     |
| **TSK-10.4** | Host check-in portal with camera scanner, manual token entry, and outcome banners             | @lukedongque | 2             | 1    | TSK-10.1, TSK-10.2           |
| **TSK-10.5** | Host occupancy wait-window countdowns, check-in concurrency race test, and Playwright journey | @lukedongque | 1             | 0.5  | TSK-10.1, TSK-10.3, TSK-10.4 |

Total: **8 points**, **4 days** (matches issue #59).

---

## 6. Build order

One pull request per row, and every pull request targets `main`.

| #   | Branch                              | PR title                                                                            | Contains                                                                                                                                                                |
| :-- | :---------------------------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `feature/STORY-10-validation`       | `feat(STORY-10): token normalization, validation schemas, and countdown utilities`  | `lib/check-in/normalize.ts`, `lib/validation/check-in.ts`, `lib/check-in/countdown.ts`, and unit tests (TSK-10.2)                                                       |
| 2   | `feature/STORY-10-db`               | `feat(STORY-10): check-in and release functions, lapse extensions, and pgTAP tests` | Migration adding `private.last_closing_time`, extending `record_lapses`, `public.check_in`, `public.check_out`, updating `unit_states`, and pgTAP test suite (TSK-10.1) |
| 3   | `feature/STORY-10-seeker-qr`        | `feat(STORY-10): SVG QR code and seeker dashboard active reservation card`          | `components/reservation/qr-code.tsx`, `ActiveReservationCard`, Seeker actions (`checkOutAction`, `cancelPaidHoldAction`), and dashboard updates (TSK-10.3)              |
| 4   | `feature/STORY-10-host-check-in`    | `feat(STORY-10): host check-in portal with camera scanner and manual entry`         | Route `/host/spaces/[spaceId]/check-in`, camera scanner, manual entry form, result banners, and Server Action (TSK-10.4)                                                |
| 5   | `feature/STORY-10-occupancy-timers` | `feat(STORY-10): host occupancy wait-window timers, race test, and e2e journey`     | Occupancy view countdown badges, `check-in.race.mjs` test, and `e2e/check-in.spec.ts` Playwright test (TSK-10.5)                                                        |

---

## 7. Rejected alternatives

- **Encoding URLs or `space_id` in the QR code payload:**
  - _Rejected:_ Violates D-059 and D-060. Encoding URLs exposes booking tokens in browser histories, bookmarks, and web server access logs. Encoding `space_id` allows scanning devices to be tricked into checking in units at incorrect venues without validating physical desk presence.
- **Unscoped global check-in endpoint:**
  - _Rejected:_ Allowing check-in without establishing the Host's current physical Space context would permit multi-venue Hosts or compromised tokens to check in reservations indiscriminately. D-060 requires explicit Space binding (`p_space_id`).
- **External scheduled cron job for releasing seats:**
  - _Rejected:_ Violates D-011. Vercel Hobby plan limits cron executions to once daily, which is inadequate for 15-minute wait windows. On-demand lapse evaluation during state reads and mutations (`record_lapses`, D-047) guarantees immediate consistency without background worker dependencies.
- **Rolling back transaction on lapsed check-in (Branch C2):**
  - _Rejected:_ If `check_in` raised an exception when encountering a lapsed wait window, PostgreSQL would abort the transaction and roll back the writes performed by `record_lapses()` (marking the hold `no_show` and payment `forfeited`). Returning a structured JSON response `{ outcome: 'wait_window_lapsed' }` allows the lapse mutations to commit while informing the Host.
- **Heavy external QR scanning npm packages:**
  - _Rejected:_ Avoids adding heavy bundle dependencies like `html5-qrcode` or `@zxing/library` with canvas or polyfill bloat. Modern mobile browsers natively support the web-standard `BarcodeDetector` API, and lightweight SVG generation renders tokens cleanly without third-party runtime assets.

---

## 8. Open questions

- **#199 (`decision-needed`): Network latency grace period after `wait_window_ends_at`:**
  - _Question:_ Should `public.check_in` allow a small grace period (e.g. 30 to 60 seconds) past `reservations.wait_window_ends_at` to tolerate network latency or cellular delays at the door, or should `clock_timestamp()` strictly enforce the exact deadline?
  - _Current baseline:_ In accordance with the approved [Check-in flow](../flows/check-in.md) and [Reservation lifecycle](../flows/reservation-lifecycle.md) (N10), `clock_timestamp()` strictly enforces the deadline with zero grace period. If Adrian settles #199 in favor of a grace period, `record_lapses` and `check_in` can evaluate `clock_timestamp() <= wait_window_ends_at + interval '60 seconds'`.

---

## 9. After the build

_(To be filled in when the story is done)_

- what turned out different from this plan, and why
- the status line changed to `implemented YYYY-MM-DD`
- the docs this story changed
- who verified each acceptance criterion
