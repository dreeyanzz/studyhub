# Check-in

**Status:** draft · **Owner:** @lukedongque · **Approved by:** @dreeyanzz, @fayeye-09 ·
**Stories:** STORY-09, STORY-10, STORY-12 · **Decisions:** D-004, D-009, D-010, D-011, D-046, D-047, D-050, D-058, D-059

This flow follows a reservation from the moment a Seeker arrives at a Space and presents
their booking token until the unit transitions to Occupied (R6). It defines what the
booking token holds, how the QR code is formatted, how the Host scans or enters it, why it
works only once, what happens at the wrong Space or after the wait window expires, and what
the Host and Seeker are told.

## What this flow covers

- What the booking token contains, its format, and its QR code representation (FR-2.3, D-058).
- The two check-in methods: device camera scan via route handler (`/api/check-in`, D-010) and
  manual alphanumeric entry via Server Action.
- The check-in sequence and its branches: success (R6), expired wait window / no-show (R7),
  already-used token, wrong Space, invalid token, and unauthorized caller.
- Every branch and negative case, and the pgTAP, Vitest, and Playwright tests that prove it.
- The `public.check_in` database function, its parameters, return shape, and security grants.
- What the Host and the Seeker are told for each outcome (D-042).

It leaves these to others:

- **The [reservation lifecycle](reservation-lifecycle.md)** (#173): how a hold starts (R1),
  confirmed sandbox payment (R2), payment window lapses (R3), cancellations (R4, R8), Host
  overrides (R5, R9, R11), and how a unit's seat state is worked out (D-046). It defines
  the R6 move (`reserved` → `occupied`) and R7 (`reserved` → `no_show`).
- **The Seeker journey** (#178): the Seeker's path from search to hold, and navigating to
  their `/seeker` dashboard to display their token (D-042).
- **The Host setup journey** (#177): the Host's onboarding and managing their Space.
- **STORY-10's design:** the visual layout of the Seeker's QR code card on `/seeker`, the
  Host's camera viewfinder interface, the manual token entry dialog, and the live wait-window
  countdown timers on the Host's seat map (FR-3.3).
- **STORY-12's design:** Host one-tap seat controls and walk-in occupancy.
- **STORY-13's design** (Sprint 3): writing a review, which requires a completed visit record
  created by a successful check-in (D-009, FR-4.1).

## The booking token and QR code

When a Seeker's sandbox payment is confirmed (R2 in STORY-09), the system issues a single-use
**booking token** stored in `reservations.booking_token` (FR-2.3):

1. **Format and Entropy (D-058):**
   - The token is a 12-character unguessable alphanumeric string chosen from a Crockford-like
     base32 / safe alphanumeric alphabet (omitting easily confused characters `0`, `O`, `1`,
     `I`, and `l`).
   - It provides over 60 bits of cryptographic entropy, preventing brute-force enumeration.
   - It contains no sensitive user data, PII, payment info, or database primary keys.
2. **Visual Presentation on `/seeker`:**
   - Rendered as an SVG QR code encoding the check-in URL:
     `https://<domain>/api/check-in?token=<booking_token>&space=<space_id>`
   - Formatted cleanly as a 3-group string (e.g. `ABC-DEF-GHJ`) directly underneath the QR code
     for manual entry when a camera is unavailable or fails to scan.

## Check-in methods

Hosts can check in Seekers in two ways (D-010):

1. **Camera Scan (Outside caller):**
   - The Host uses a device camera or native scanner.
   - The scan opens `GET /api/check-in?token=<token>&space=<space_id>` (or in-app video
     stream passes the decoded URL).
   - Per D-010, `app/api/` route handlers handle external callers. The route handler validates
     the Host's session, executes `public.check_in`, and redirects or returns JSON with the
     check-in result.
2. **Manual Token Entry (In-portal action):**
   - The Host opens the "Check In" dialog on `/host/spaces/[id]/check-in` or the seat map view.
   - The Host types or pastes the 12-character token.
   - The form submits a Server Action (`actions.ts` per D-010) calling `public.check_in`.

Both methods execute the same database function: `public.check_in(p_token, p_space_id)`.

## The sequence

```mermaid
sequenceDiagram
    autonumber
    actor Seeker
    participant SeekerUI as Seeker Dashboard (/seeker)
    actor Host
    participant HostUI as Host Portal (/host)
    participant CheckInHandler as Check-in Handler (API / Action)
    participant DB as PostgreSQL (public.check_in)

    Seeker->>SeekerUI: Open dashboard to view active reservation
    SeekerUI-->>Seeker: Display QR code and alphanumeric token
    Seeker->>Host: Present QR code or speak code on arrival

    alt Camera QR scan (D-010)
        Host->>HostUI: Scan Seeker QR code with camera
        HostUI->>CheckInHandler: GET /api/check-in?token=...&space=...
    else Manual token entry (D-010)
        Host->>HostUI: Enter 12-character token in check-in dialog
        HostUI->>CheckInHandler: Server Action: checkIn(token, spaceId)
    end

    CheckInHandler->>DB: CALL public.check_in(token, space_id)
    Note over DB: Step 1: private.record_lapses() runs first (D-047)

    alt Branch C1: Valid token at correct Space within wait window (R6)
        DB-->>CheckInHandler: Success: unit_id, unit_label, zone_name, seeker_name
        CheckInHandler-->>HostUI: Checked in: Unit marked Occupied
        HostUI-->>Host: "Checked in [Unit Label] for [Seeker]"
        SeekerUI-->>Seeker: Status updates to Occupied on next fetch
    else Branch C2: Wait window lapsed with no check-in (R7)
        Note over DB: Lapsed to no_show; fee forfeited (D-047)
        DB-->>CheckInHandler: Error: Wait window expired (no-show)
        CheckInHandler-->>HostUI: 410 Gone: "Reservation expired. Unit released."
        HostUI-->>Host: Show expired / no-show notification
    else Branch C3: Token already checked in or visit completed
        DB-->>CheckInHandler: Error: Token already consumed
        CheckInHandler-->>HostUI: 409 Conflict: "Token has already been used"
        HostUI-->>Host: Show replay warning: already checked in
    else Branch C4: Token presented at wrong Space (D-059)
        DB-->>CheckInHandler: Error: Token belongs to different Space
        CheckInHandler-->>HostUI: 422 Unprocessable: "Reservation is for [Other Space]"
        HostUI-->>Host: Show wrong venue notice (hold remains untouched)
    else Branch C5: Token not found or invalid format
        DB-->>CheckInHandler: Error: Invalid token
        CheckInHandler-->>HostUI: 404 Not Found: "Invalid booking token"
        HostUI-->>Host: Show invalid token alert
    else Branch C6: Caller is not the Host of the Space
        DB-->>CheckInHandler: Error: 42501 Unauthorized
        CheckInHandler-->>HostUI: 403 Forbidden: "Only the Space host can check in"
        HostUI-->>Host: Access denied
    end
```

## Every branch, and its test

Each branch corresponds to an outcome in the sequence diagram. Tests verify both the
database function (`supabase/tests/NN-check-in-release.sql`), the application token logic
(`lib/check-in/`), and the end-to-end user experience (`e2e/check-in.spec.ts`).

| #   | Branch              | Condition                                                                          | Database state move                                                                                                                       | Function / Route                                         | Test                                                                                                                                                                                                            |
| --- | ------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Valid check-in      | Active `reserved` hold, valid token, matching `space_id`, within wait window       | R6: `reservations.status` → `occupied`, `checked_in_at = clock_timestamp()`. Payment stays `paid`. Unit seat state reads Occupied (D-046) | `public.check_in` (STORY-10)                             | `check-in-release`: "a Host checks in a Reserved unit, which reads Occupied"; `e2e/check-in`: "Host scans valid QR code and unit becomes Occupied"                                                              |
| C2  | Lapsed wait window  | `wait_window_ends_at < clock_timestamp()`                                          | R7: `reservations.status` → `no_show`, `payments.status` → `forfeited`. Unit reads Available                                              | `private.record_lapses` (D-047) called inside `check_in` | `check-in-release`: "a booking token cannot check in once its wait window has lapsed"; `check-in-release`: "a no-show releases the unit and forfeits the fee"                                                   |
| C3  | Token already used  | `reservations.status` is `occupied` or `completed`                                 | None. Reservation remains in its existing state                                                                                           | `public.check_in`                                        | `check-in-release`: "a token cannot be checked in twice"; `lib/check-in`: "rejects check-in for already consumed token"                                                                                         |
| C4  | Wrong Space (D-059) | Token exists and is `reserved`, but unit belongs to another Space                  | None. Hold remains `reserved` so Seeker can still travel to correct Space                                                                 | `public.check_in`                                        | `check-in-release`: "a Host cannot check in a token for another Space"; `e2e/check-in`: "scanning token at wrong space preserves hold and shows informative error"                                              |
| C5  | Invalid token       | Token format invalid or not found in `reservations`                                | None. No row matches                                                                                                                      | `public.check_in`                                        | `check-in-release`: "an invalid token string is rejected"; `lib/check-in`: "validates token alphabet and length"                                                                                                |
| C6  | Unauthorized caller | Authenticated user is not the owning Host of `p_space_id`, or caller is signed out | None. Database raises error `42501`                                                                                                       | `public.check_in`                                        | `check-in-release`: "a Seeker cannot check in their own reservation"; `check-in-release`: "another Host cannot check in a Space they do not own"; `check-in-release`: "a signed-out caller cannot run check_in" |

## Moves nobody may make

Each has its negative test (AGENTS.md rule 5).

| #   | Nobody may                                 | Stopped by                                                             | Test                                                                                  |
| --- | ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| N1  | Check in signed out                        | `anon` has no execute grant on `public.check_in`                       | `check-in-release`: "a signed-out visitor cannot run check_in"                        |
| N2  | Check in as a Seeker                       | `public.check_in` verifies the caller is the Host of `space_id`        | `check-in-release`: "a Seeker cannot check in their own reservation"                  |
| N3  | Check in at another Space                  | `public.check_in` checks `unit.space_id = p_space_id`                  | `check-in-release`: "a Host cannot check in a token for another Space"                |
| N4  | Check in an expired wait window            | `private.record_lapses` runs first (D-047) and marks `no_show`         | `check-in-release`: "a booking token cannot check in once its wait window has lapsed" |
| N5  | Check in a token twice                     | `public.check_in` only updates reservations with `status = 'reserved'` | `check-in-release`: "a token cannot be checked in twice"                              |
| N6  | Check in an unpaid hold                    | Only `reserved` holds have a valid booking token generated at R2       | `check-in-release`: "a pending_payment hold cannot be checked in"                     |
| N7  | Write `checked_in_at` or `status` directly | Column grant and RLS policies block direct updates on `reservations`   | `check-in-release`: "no user can update reservation status or checked_in_at directly" |
| N8  | Check out another Seeker's visit           | `public.check_out` checks caller is the reservation's Seeker           | `check-in-release`: "a Seeker cannot check out another Seeker's visit"                |

## The database function

`public.check_in(p_token text, p_space_id uuid)` (STORY-10, written by Adrian):

```sql
create or replace function public.check_in(
  p_token text,
  p_space_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
-- 1. Verify caller is authenticated Host of p_space_id
-- 2. Record lapses first (D-047)
-- 3. Find reservation by p_token
-- 4. If not found -> raise invalid_token
-- 5. If space_id != p_space_id -> raise wrong_space (D-059)
-- 6. If status != 'reserved' -> raise token_already_used or lapsed
-- 7. Update reservations set status = 'occupied', checked_in_at = clock_timestamp()
-- 8. Return unit and seeker metadata for host feedback
$$;
```

- **Caller check:** Verifies `auth.uid()` matches `spaces.host_id` for `p_space_id`. Fails with `42501` otherwise.
- **Lapse step first (D-047):** Calls `private.record_lapses()` before evaluating the token, ensuring an expired wait window has already become `no_show` with fee `forfeited`.
- **Atomic transition:** The reservation moves to `occupied` and records `checked_in_at`. The unit's seat state immediately reads `occupied` on read without modifying `units.host_state` (D-046).
- **Payment remains paid:** The payment status stays `paid`.
- **Visit record created:** Stamping `checked_in_at` creates the permanent visit record required for Sprint 3 reviews (D-009, FR-4.1).
- **Grants:** Granted to `authenticated` only; `anon` has no execute grant.

## What Host and Seeker are told

Maria decides exact UX wording and component presentation (D-042):

| Event                    | What the Host sees                                                                                                                 | What the Seeker sees                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **C1 Success**           | Success banner with checkmark: "Checked in [Unit Label] ([Zone Name]) for [Seeker Name]". Unit highlights as Occupied on seat map. | Dashboard card transitions from "Reserved" (with QR code) to "Checked In · Seat [Unit Label]". Displays button for self-checkout. |
| **C2 Expired (No-show)** | Warning banner: "Wait window expired. Seat has been released and reservation fee forfeited."                                       | Dashboard shows "Reservation Expired · You did not arrive before the wait window ended." Seat is Available again.                 |
| **C3 Already used**      | Alert: "This token was already checked in at [Time]. Unit is currently [Occupied / Completed]."                                    | "Already checked in."                                                                                                             |
| **C4 Wrong Space**       | Warning: "This booking is for another study space: [Space Name]. No changes were made."                                            | Status remains "Reserved · Ready for check-in at [Correct Space Name]".                                                           |
| **C5 Invalid token**     | Error: "Invalid booking code. Please verify the code or ask the Seeker to refresh their dashboard."                                | Displays QR code with option to view alphanumeric code.                                                                           |
| **C6 Unauthorized**      | Error: "You must be signed in as the Host of this Space to perform check-in."                                                      | N/A                                                                                                                               |

## Choices made

Each choice has its entry in [DECISIONS](../DECISIONS.md):

- **D-058: Booking token format and QR encoding.** The booking token is an unguessable
  12-character alphanumeric code using a Crockford-like base32 alphabet (no `0`, `O`, `1`, `I`,
  `l`) generated at R2. The QR code encodes a verification URL
  `https://<domain>/api/check-in?token=<token>&space=<space_id>` for native cameras, while the
  12-character code is displayed for manual typing.
  _Why:_ Direct device cameras can scan without opening a special app mode, and noisy
  environments or damaged phone screens can rely on the 12-character manual input.
  _Rejected:_ Raw UUIDs (too long to type), proprietary bar codes, or storing seeker PII in the
  QR payload.
- **D-059: Space-scoped check-in and error isolation.** Check-in requires `space_id` alongside
  the token. When a token is presented at the wrong Space, the check-in is rejected with an
  explicit message naming the mismatch, and the reservation is left untouched in `reserved`
  status.
  _Why:_ It prevents accidental or fraudulent cross-venue seat claims while preserving the
  Seeker's valid hold if they simply walked into the wrong branch or building.
  _Rejected:_ Global unscoped token lookup that marks whichever space the Host happens to be
  at.

## Open questions

None. The state transitions align with the reservation lifecycle (PR #180, R6, R7), D-004,
D-009, D-010, D-011, and D-046.
