# STORY-20: Space verification follow-ups

**Status:** implemented 2026-11-27 · **Owner:** @dreeyanzz (status rules, migrations, triggers, functions, take-down cleanup helper and pgTAP tests), @lukedongque (pages, actions, Realtime live notice and tests) (D-073, D-075) · **Story:** #338 · **FR:** FR-5.1, FR-5.3 · **Depends on:** STORY-05, STORY-09, STORY-14, STORY-15 · **Flows:** [Space verification](../flows/space-verification.md), [Reservation lifecycle](../flows/reservation-lifecycle.md), [Host setup journey](../flows/host-setup-journey.md), [Sandbox payment confirmation](../flows/sandbox-payment-confirmation.md) · **Decisions:** D-027, D-037, D-052, D-053 to D-055, D-073 to D-075, D-079, D-083 to D-086, D-088, D-093, D-095, D-096

Sprint 2's STORY-15 added the first verification queue: Pending Spaces could be approved or
rejected once, with no reason and no way back (D-054). This story finishes verification
(D-079, D-084 to D-086): rejecting or taking down a Space requires a reason its Host can
read, a Host can resubmit a Rejected or Taken down Space, editing a Verified Space's name,
address or map pin sends it back to Pending after a warning, an Administrator can take a
Verified Space down (cancelling unstarted holds and refunding their fees) or undo either
decision, and `/admin` gains each Space's list of changes and a live notice when a Host
edits a Space an Administrator has open.

Adrian writes this design, the database half, and the take-down hold-cleanup helper; Luke
reviews and approves this design, then builds the pages, Server Actions, Realtime live
notice, and Playwright tests (D-073, D-075). Maria and James review the built screens in
STORY-17 (D-073, D-074).

## 0. Scope

**In:**

- **Status rules, enum, columns, triggers and functions (Adrian):**
  - `space_status` enum gains `taken_down` (in its own migration before any migration that
    uses it, because Postgres forbids using a newly added enum value in the same
    transaction).
  - `spaces` gains `status_reason`, `status_changed_at` and `status_changed_by` (no direct
    insert/update grant to any role).
  - `space_events` (the list of changes) with Administrator-only `select` RLS and no write
    grants (written only by the functions and trigger).
  - `reservations` gains `cancelled_by_take_down` (and `public.my_reservation` returns it)
    so a Seeker's hold page says the Space was taken down (D-085).
  - `public.set_space_status` replaced with the 4-argument version supporting V2, V3, V7,
    V9 and V10, mandatory reasons for V3 and V7, R13/R14 hold cancellation, and returning
    cancelled holds for Stripe checkout closure and refund orchestration.
  - `public.resubmit_space` (V8) for the Space's Host on `rejected` or `taken_down` Spaces.
  - `before update` trigger (V6) sending a `verified` Space back to `pending` when `name`,
    `address`, `latitude` or `longitude` changes; `after update` trigger logging identity
    edits (and V6's move) in `space_events`.
  - `public.unit_states` and `public.hold_terms` updated to hide every Space whose status
    is not `verified` (N15, D-084).
  - `public.spaces` added to the `supabase_realtime` publication (D-086).
  - Complete pgTAP suite extending `supabase/tests/05-space-verification.sql` (and updating
    `02-spaces.sql`'s V4 test, which currently renames a Verified Space), plus `db:types`.
- **Take-down Stripe cleanup helper (Adrian):** `lib/payments/take-down.ts` (server-only)
  to close cancelled Pending Payment checkouts (`expireCheckoutSession`) and refund
  cancelled Reserved holds through STORY-14's `createRefund` / `findRefund` /
  `record_refund`, returning a per-hold summary so any failed refund is reported cleanly
  and remains `paid` on `/admin/payments` for retry (D-085, D-088).
- **Admin and Host pages, Server Actions and tests (Luke):**
  - `/admin` verification console updates: Pending queue ordered by `status_changed_at asc`
    with `"Edited"` and `"Resubmitted"` marks (plus last reason), Verified / Rejected /
    Taken down status tabs, Reject reason dialog, Take down reason dialog, Undo (V9) and
    Put back (V10) confirmations, the list of changes (`space_events`) highlighting
    entries since last Verified and the newest entry, and the Supabase Realtime live
    notice pausing decisions until the latest version loads.
  - `/host` portal and edit page updates: `"Taken down"` status badge, showing
    `status_reason` to the Host on Rejected, Taken down and resubmitted Pending Spaces,
    `"Resubmit"` action (`resubmitSpaceAction`), and the pre-save warning before changing a
    Verified Space's name, address or map pin.
  - Seeker hold page (`EndedView`): distinct wording when `cancelledByTakeDown` is true
    (D-085).
  - Updated `lib/validation/verification.ts`, `lib/data/` helpers, Vitest tests, and
    Playwright tests extending `e2e/space-verification.spec.ts` and
    `e2e/host-setup.spec.ts`.

**Out:**

- **Review moderation and standalone refunds** (STORY-14). Take-down reuses STORY-14's
  refund code (`createRefund`, `findRefund`, `record_refund`) and leaves failed refunds on
  `/admin/payments` for retry.
- **Email notifications** on rejection, take-down, resubmission or cancellation. The only
  email in Worq is the hold confirmation (D-083, D-085, D-089).
- **Watching photos, tags or seat maps over Realtime** (D-086). Only the `spaces` row is
  watched, matching N9's `updated_at` check.
- **Cut-order boundary (D-075, D-083):** Taking a Space down (`V7`, `V10`, `R13`, `R14`) is
  the first thing cut if Sprint 3 runs short. Rejection reasons (`V3`), resubmitting (`V8`),
  and re-verifying edited Spaces (`V6`) remain higher priority.
- **The final visual restyle** (STORY-17). Maria and James review these screens once built
  (D-073, D-074).

## 1. Flow

### Shared flows (D-044)

- **[Space verification](../flows/space-verification.md)** (#174, Sprint 3 change #340):
  this story implements every Sprint 3 transition and denial — V2–V4 updates, V6–V10,
  N3–N5, N7, N9–N15, `space_events`, and the Realtime live notice.
- **[Reservation lifecycle](../flows/reservation-lifecycle.md)** (#173, Sprint 3 change
  #340): this story implements R13 (`pending_payment` → `cancelled`) and R14
  (`reserved` → `cancelled`) inside `public.set_space_status`, leaving `occupied` holds
  running to check-out or closing time (D-085).
- **[Sandbox payment confirmation](../flows/sandbox-payment-confirmation.md)** (#175): a
  payment Stripe confirms before its checkout closes is P2 (`late_payment`) and waits on
  `/admin/payments` for refund.
- **[Host setup journey](../flows/host-setup-journey.md)** (#177, Sprint 3 change #340):
  this story adds the Playwright coverage for `host-edit-returns-pending`,
  `host-resubmits-space`, `host-admin-takes-down-space`, `host-admin-restores-space`, and
  updates `host-admin-rejects-space` / `host-sees-rejected`.

### This story's own part

An Administrator taking a Verified Space down (V7) or rejecting an edited Space (V3),
including hold cancellation, Stripe cleanup, and the Realtime live-notice backstop.

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    participant B as Browser (/admin)
    participant RT as Supabase Realtime (spaces)
    participant SA as setSpaceStatusAction
    participant DB as Postgres (set_space_status)
    participant ST as Stripe (test mode)

    B->>RT: Subscribes to UPDATE on spaces (RLS enforced)
    Note over B,RT: If Host edits the Space while A is viewing it,<br/>RT pushes a live notice and disables actions until A reloads.

    A->>B: Submits Reject or Take down with reason (1–500 chars)
    B->>SA: spaceId, targetStatus, updatedAt, reason
    Note over SA: Parses with Zod, verifies session
    SA->>DB: public.set_space_status(spaceId, status, updatedAt, reason)

    alt Not admin (N3/N4), stale_version (N9), invalid_transition (N5), or invalid_reason (N10)
        DB-->>SA: 42501 or P0001 with hint
        SA-->>B: Inline error; on stale_version prompts reload
    else V2 / V9 / V10 (approved, undone, or put back)
        DB-->>SA: { status: 'verified', cancelled_holds: [] }
        SA-->>B: revalidatePath + success announcement
    else V3 or V7 (rejected or taken_down)
        Note over DB: Records lapses (D-047), locks units -> reservations -> payments,<br/>cancels pending_payment (R13) & reserved (R14) holds with cancelled_by_take_down = true,<br/>keeps occupied holds running, writes space_events row.
        DB-->>SA: { status, cancelled_holds: [...] }
        loop For each cancelled pending_payment hold with checkout_session_id
            SA->>ST: expireCheckoutSession (best-effort; errors logged)
        end
        loop For each cancelled reserved hold with payment_status = 'paid'
            SA->>ST: createRefund (Idempotency-Key: refund-<payment_id>); findRefund on failure
            alt Stripe accepted or findRefund recovered
                SA->>DB: public.record_refund(payment_id, refund_id, refundReason)
            else Refund failed or timed out
                Note over SA: Payment stays paid on /admin/payments for manual retry (D-085)
            end
        end
        SA-->>B: revalidatePath + summary (incl. any holds needing manual refund retry)
    end
```

## 2. Data and state

### Enums

1. **`public.space_status`** (Migration 1, alone in its own file):
   - Adds `'taken_down'` via `alter type public.space_status add value if not exists 'taken_down';`.
   - Values become `'pending'`, `'verified'`, `'rejected'`, `'taken_down'`.

### Tables and columns

#### `public.spaces` (three new columns, no role granted insert or update)

| Column              | Type          | Rule                                                                                                                                                                                                                                               |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status_reason`     | `text`        | Null, or 1 to 500 characters after trimming. Set on V3/V7, preserved on V8, cleared on V2/V9/V10 (N10/N12)                                                                                                                                         |
| `status_changed_at` | `timestamptz` | Not null, default `now()`. Backfilled from `created_at` for existing rows (so pre-existing Sprint 2 Verified and Rejected rows display their creation date as `"Verified:"` / `"Rejected:"` until their next status move); drives queue wait order |
| `status_changed_by` | `uuid`        | Null, references `public.profiles(id)` `on delete set null`                                                                                                                                                                                        |

Check constraints on `public.spaces`:

- `spaces_status_reason_length`: `status_reason is null or char_length(regexp_replace(status_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 500`
- `spaces_verified_has_no_reason`: `status <> 'verified' or status_reason is null` (guarantees N12 even at the schema level: a Verified Space never carries a stale reason).
- `spaces_rejected_or_taken_down_has_reason` is **not** forced retroactively on pre-existing Sprint 2 rejected rows (if any exist without a reason); `set_space_status` enforces a mandatory reason for every new V3 and V7 move (N10).

No `grant insert` or `grant update` is given on `status_reason`, `status_changed_at`, or
`status_changed_by` (matching `status`, N2). `select` remains granted via table-level
`grant select on table public.spaces`, governed by STORY-01's select policy (only the
Space's Host and Administrators read non-Verified Spaces, and Verified Spaces have
`status_reason is null`, enforcing N12). Because `status_changed_by` adds a second foreign
key from `public.spaces` to `public.profiles`, PostgREST embeds that read a Space's Host
name must disambiguate the relationship as `profiles!spaces_host_id_fkey(full_name)`.

Index:

- `spaces_status_changed_at_idx on public.spaces (status, status_changed_at asc)` — serves
  the Pending queue (oldest waiting first) and the Rejected / Taken down lists.
- `spaces_status_changed_by_idx on public.spaces (status_changed_by)` — so deleting a
  profile can set `status_changed_by` to null without scanning every Space (added in
  TSK-20.1, as STORY-14 indexed `payments.refunded_by`).

#### `public.space_events` (the list of changes, D-086)

| Column          | Type                  | Rule                                                                           |
| --------------- | --------------------- | ------------------------------------------------------------------------------ |
| `id`            | `uuid`                | Primary key, `gen_random_uuid()`                                               |
| `space_id`      | `uuid`                | Not null, references `public.spaces(id)` `on delete cascade`                   |
| `from_status`   | `public.space_status` | Nullable; null for an identity edit on a non-Verified Space (no status change) |
| `to_status`     | `public.space_status` | Nullable; set together with `from_status` on any status move (V2, V3, V6–V10)  |
| `reason`        | `text`                | Nullable; holds the Administrator's reason on V3 and V7                        |
| `old_name`      | `text`                | Nullable; set with `new_name` when `name` changed                              |
| `new_name`      | `text`                | Nullable                                                                       |
| `old_address`   | `text`                | Nullable; set with `new_address` when `address` changed                        |
| `new_address`   | `text`                | Nullable                                                                       |
| `old_latitude`  | `double precision`    | Nullable; set with `new_latitude`/`old_longitude`/`new_longitude` on pin edit  |
| `new_latitude`  | `double precision`    | Nullable                                                                       |
| `old_longitude` | `double precision`    | Nullable                                                                       |
| `new_longitude` | `double precision`    | Nullable                                                                       |
| `actor_id`      | `uuid`                | Nullable, references `public.profiles(id)` `on delete set null`                |
| `created_at`    | `timestamptz`         | Not null, default `clock_timestamp()`                                          |

Check constraints:

- `space_events_status_pair`: `(from_status is null) = (to_status is null)`, so a status
  move has both ends and an identity edit with no move has neither (added in TSK-20.1).
- `space_events_has_change`: either `(from_status is not null and to_status is not null)`
  or at least one of `(old_name is distinct from new_name)`, `(old_address is distinct from new_address)`, `(old_latitude is distinct from new_latitude)`, `(old_longitude is distinct from new_longitude)` is true.

Indexes:

- `space_events_space_created_idx on public.space_events (space_id, created_at desc, id desc)`
- `space_events_actor_id_idx on public.space_events (actor_id)`

Grants and RLS on `public.space_events` (N13, N14):

- `revoke all on table public.space_events from anon, authenticated;`
- `grant select on table public.space_events to authenticated;`
- `alter table public.space_events enable row level security;`
- Select policy `"space_events: administrators read the list of changes"` for `authenticated`
  using `(select private.has_role('admin'))`. No insert/update/delete grant to any role.

How the queue derives `"Edited"` vs `"Resubmitted"` without a redundant status column:
For a `pending` Space, the latest `space_events` row with `to_status = 'pending'` tells
the queue how it got there:

- no row → newly created (V1, no mark);
- `from_status = 'verified'` → `"Edited"` (V6);
- `from_status in ('rejected', 'taken_down')` → `"Resubmitted"` (V8), showing `spaces.status_reason` as the last reason.

#### `public.reservations` (one new column, D-085)

| Column                   | Type      | Rule                                                                                   |
| ------------------------ | --------- | -------------------------------------------------------------------------------------- |
| `cancelled_by_take_down` | `boolean` | Not null, default `false`. Check: `not cancelled_by_take_down or status = 'cancelled'` |

`public.my_reservation` is updated (starting from its latest definition on `main`, D-066)
to return `cancelled_by_take_down boolean` alongside its existing columns so `EndedView`
can distinguish a take-down cancellation (R13, R14) from a Seeker or Host cancellation.

### State transitions

Every status move V1–V10 and hold cancellation R13–R14 is defined in the
[Space verification flow](../flows/space-verification.md#every-move-and-its-test) and the
[Reservation lifecycle](../flows/reservation-lifecycle.md#every-move-and-its-test).
Allowed Administrator transitions in `public.set_space_status`:

| Current `status` | Target `p_status` | Move | Reason required? | Reason stored | Holds cancelled? |
| ---------------- | ----------------- | ---- | ---------------- | ------------- | ---------------- |
| `pending`        | `verified`        | V2   | No (ignored)     | Cleared       | No               |
| `pending`        | `rejected`        | V3   | Yes (1–500)      | Saved         | Yes (R13, R14)   |
| `verified`       | `taken_down`      | V7   | Yes (1–500)      | Saved         | Yes (R13, R14)   |
| `rejected`       | `verified`        | V9   | No (ignored)     | Cleared       | No               |
| `taken_down`     | `verified`        | V10  | No (ignored)     | Cleared       | No               |

Any other pair (e.g. target `pending`, rejecting a `verified` Space, taking down a
`pending`/`rejected`/`taken_down` Space, approving a `verified` Space) is refused with
`P0001` and hint `invalid_transition` (N5).

### Database functions and triggers

All public functions run as `security definer` with `set search_path = ''`, revoke execute
from `public`, `anon`, and `authenticated`, and grant execute to `authenticated` only
(except `unit_states` and `hold_terms`, which keep `anon, authenticated`).

1. **`public.set_space_status(p_space_id uuid, p_status public.space_status, p_updated_at timestamptz, p_reason text default null) returns jsonb`**
   - Drops the Sprint 2 3-argument signature `public.set_space_status(uuid, public.space_status, timestamptz)` so PostgREST sees one unambiguous function.
   - Refuses non-Administrators with `42501` (`not (select private.has_role('admin'))`, N3).
   - Locks `public.spaces` row `for update`. Missing Space raises `P0001` hint `not_found`.
   - Compares `p_updated_at` against `spaces.updated_at`; mismatch or null raises `P0001`
     hint `stale_version` (N9).
   - Validates the `(v_old_status, p_status)` transition against V2/V3/V7/V9/V10; otherwise
     raises `P0001` hint `invalid_transition` (N5).
   - For V3 and V7, trims `p_reason` (`regexp_replace(..., '^[[:space:]]+|[[:space:]]+$', '', 'g')`);
     if null or length not in `1..500`, raises `P0001` hint `invalid_reason` (N10).
   - For V3 and V7, locks the Space's units in `id` order, then records their lapses under
     that lock (`private.record_lapses`, D-047), as `confirm_payment` and
     `check_space_hours_on_update` do, then locks its `pending_payment` and `reserved`
     reservations and their payments (keeping the reservation lifecycle's lock order:
     units → reservations → payments). TSK-20.1 put the lock before the lapses:
     `record_lapses` locks only the units that lapsed, so recording first and then locking
     every unit would take them out of `id` order and could deadlock with another call
     that locks the same units. Cancels those holds (`status = 'cancelled'`,
     `ended_at = v_now`, `cancelled_by_take_down = true`) and leaves `occupied` holds
     untouched (D-085). Collects each cancelled hold's `reservation_id`, `previous_status`,
     `payment_id`, `payment_status`, `checkout_session_id`, and `payment_intent_id` (from
     `payments.external_payment_id`, D-070) into `cancelled_holds`.
   - Updates `spaces`: `status = p_status`, `status_reason = (v_reason for V3/V7, else null)`,
     `status_changed_at = v_now`, `status_changed_by = v_caller_id`. (`set_updated_at`
     advances `spaces.updated_at`.)
   - Inserts one row into `public.space_events` (`from_status`, `to_status`, `reason`,
     `actor_id`, `created_at = v_now`).
   - Returns `{ space_id, status, updated_at, cancelled_holds }`.

2. **`public.resubmit_space(p_space_id uuid) returns jsonb`** (V8, N4, N11)
   - Refuses signed-out callers (`auth.uid() is null`) with `42501`.
   - Locks `public.spaces` row `for update`. Refuses with `42501` unless caller is the
     Space's Host (`v_host_id = auth.uid()` and `private.has_role('host')`, D-095).
   - Refuses with `P0001` hint `not_resubmittable` if `v_old_status not in ('rejected', 'taken_down')` (N11).
   - Updates `spaces`: `status = 'pending'`, `status_changed_at = v_now`,
     `status_changed_by = v_caller_id`, keeping `status_reason` intact so `/admin` shows
     the last reason next to `"Resubmitted"` (D-084).
   - Inserts one row into `public.space_events` (`from_status = v_old_status`,
     `to_status = 'pending'`, `reason = null`, `actor_id = v_caller_id`, `created_at = v_now`).
   - Returns `{ space_id, status: 'pending', updated_at }`.

3. **Triggers on `public.spaces` (V6 and `space_events`, D-079, D-086):**
   - `private.reverify_on_identity_edit()` (`BEFORE UPDATE ON public.spaces`, alphabetically
     before `set_updated_at`): when `old.status = 'verified'` and any of `name`, `address`,
     `latitude`, or `longitude` is `distinct from` its old value, sets `new.status := 'pending'`,
     `new.status_changed_at := clock_timestamp()`, and `new.status_changed_by := (select auth.uid())`.
     Adding a pin where `latitude`/`longitude` were null counts as distinct (D-084). Saving
     unchanged values or editing only `description`, hours, `max_wait_window`, or
     `price_tier` leaves `status` unchanged (V4).
   - `private.record_space_identity_edit()` (`AFTER UPDATE ON public.spaces`, `security definer`):
     when any of `name`, `address`, `latitude`, or `longitude` changed (in any status),
     inserts a row into `public.space_events` with the `old_*`/`new_*` values for each
     changed field, `actor_id = (select auth.uid())`, and, if `old.status = 'verified'`
     and `new.status = 'pending'` (V6), also records `from_status = 'verified'`,
     `to_status = 'pending'`.

4. **`public.unit_states(p_space_id uuid)` and `public.hold_terms(p_space_id uuid)` (N15, D-084):**
   - Starting from their latest definitions on `main` (D-066), replace
     `if v_space_status in ('pending', 'rejected')` with
     `if v_space_status is distinct from 'verified'` so `taken_down` Spaces return 0 rows
     to everyone except their Host and Administrators.

5. **Supabase Realtime publication (D-086):**
   - Adds `public.spaces` to `supabase_realtime` inside a guarded `do $$` block checking
     `pg_publication` and `pg_publication_tables` (so both hosted Supabase with Realtime
     and CI's `db` job starting Postgres without the Realtime container apply cleanly).

### Take-down Stripe cleanup helper (`lib/payments/take-down.ts`, Adrian)

Server-only helper `cleanupTakeDownHolds(supabase, cancelledHolds, reason, action)` where
`action` is `'taken_down'` (V7) or `'rejected'` (V3 after V6):

- Closes each `pending_payment` hold's open Stripe checkout via `expireCheckoutSession`
  (best-effort; failures are logged because Stripe expires or P2 catches late payments).
- For each `reserved` hold whose `payment_status === 'paid'` and `payment_intent_id`
  (`payments.external_payment_id`, D-070) is present, calls
  `createRefund({ paymentIntentId, paymentId })` with `findRefund` recovery (matching
  STORY-14 §1, D-088), then calls
  `supabase.rpc('record_refund', { p_payment_id, p_refund_id, p_reason })` with a bounded
  reason derived from the move and Administrator's reason (`"Space taken down: …"` for V7
  or `"Space rejected after an edit: …"` for V3, truncated to 300 chars).
- Returns `{ expiredCheckouts, refundedCount, failedRefundPaymentIds }`. Any payment in
  `failedRefundPaymentIds` stays `paid` on `/admin/payments` for manual retry (D-085).

### Form rules (`lib/validation/verification.ts`, Luke)

- Extends `spaceVerificationDecisionSchema` to accept `'verified' | 'rejected' | 'taken_down'`.
- Adds `spaceStatusReasonSchema`: trimmed, 1 to 500 characters (required for `'rejected'`
  and `'taken_down'`, optional/omitted for `'verified'`).
- Updates `verifySpaceSchema` with `.superRefine()` requiring `reason` when `status` is
  `'rejected'` or `'taken_down'`.
- Adds `resubmitSpaceSchema`: `{ spaceId: spaceIdSchema }`.
- Adds `verificationQueueTabSchema`: `?tab=pending|verified|rejected|taken_down`, fallback `'pending'`.

## 3. UI and files

### Screens

1. **Admin Space Verification (`/admin`):**
   - **Header & status tabs (`?tab=pending|verified|rejected|taken_down`, default `pending`):**
     - `h1` `"Space Verification"` and subtitle `"Review Pending Spaces, inspect changes, take Verified Spaces down, or undo past decisions."`
     - Four 48 × 48 px navigation links inside `<nav aria-label="Verification status lists">` (`aria-current="page"` on the active tab): `"Pending"` (`/admin?tab=pending`), `"Verified"` (`/admin?tab=verified`), `"Rejected"` (`/admin?tab=rejected`), and `"Taken down"` (`/admin?tab=taken_down`). Invalid or missing `tab` params fall back to `'pending'` (`verificationQueueTabSchema`).
     - An active-list count badge sits beside the heading (`"{N} pending"`, `"{N} verified"`, `"{N} rejected"`, or `"{N} taken down"`).
   - **Loading, empty, and error states:**
     - `app/(dashboard)/admin/loading.tsx` renders three pulsing card skeletons (`animate-pulse bg-muted/50`, `aria-busy="true"`, `aria-live="polite"`) beneath the heading.
     - Empty states (Inbox icon + heading + subtitle):
       - Pending: `"No pending spaces"` / `"All spaces have been reviewed."`
       - Verified: `"No verified spaces"` / `"Approved spaces appear here."`
       - Rejected: `"No rejected spaces"` / `"Rejected spaces appear here with their reasons."`
       - Taken down: `"No taken down spaces"` / `"Spaces taken down from public view appear here."`
     - Load error: destructive `Alert` titled `"Error loading queue"` with body `"We could not load the verification queue. Refresh the page to try again."`
   - **Queue cards and ordering (`VerificationQueue` + `VerificationCard`):**
     - Every card displays Space name (`h2`), address with map-pin icon, optional plain-text description (`wrap-anywhere whitespace-pre-line`), daily hours (`formatOpeningHours`), Host full name (`profiles!spaces_host_id_fkey(full_name)`, falling back to `"Unnamed"`), status timestamp (`status_changed_at` in `Asia/Manila` via `formatDateTime`), the status badge in words, the list of changes (`SpaceEventsList`), and 48 × 48 px action buttons whose accessible names include `<span className="sr-only"> {space.name}</span>`.
     - **Pending (`?tab=pending`):** ordered by `status_changed_at asc` (oldest waiting first, D-084). Shows `"Pending verification"` badge and `"Waiting since:"` timestamp, plus an origin badge derived from the latest `space_events` row with `to_status = 'pending'`:
       - no origin badge after V1 (newly created);
       - `"Edited"` badge after V6 (Verified name, address, or map pin changed);
       - `"Resubmitted"` badge after V8, accompanied by a `"Previous reason:"` callout showing `spaces.status_reason` (plain text) when `status_reason` is non-null.
       - Actions: destructive outline `"Reject"` (opens `VerificationReasonDialog` in `'rejected'` mode) and primary `"Approve"` (calls `setSpaceStatusAction` directly for V2, disabling with `"Approving..."` and `aria-busy="true"`).
     - **Verified (`?tab=verified`):** ordered by `status_changed_at desc`. Shows `"Verified"` badge and `"Verified:"` timestamp. Action: destructive outline `"Take down"` (opens `VerificationReasonDialog` in `'taken_down'` mode).
     - **Rejected (`?tab=rejected`):** ordered by `status_changed_at desc`. Shows `"Rejected"` badge, `"Reason:"` callout displaying `spaces.status_reason` when `status_reason` is non-null, and `"Rejected:"` timestamp. Action: `"Undo"` (opens `VerificationConfirmDialog` for V9).
     - **Taken down (`?tab=taken_down`):** ordered by `status_changed_at desc`. Shows `"Taken down"` badge, `"Reason:"` callout displaying `spaces.status_reason` when `status_reason` is non-null, and `"Taken down:"` timestamp. Action: `"Put back"` (opens `VerificationConfirmDialog` for V10).
   - **Reject & Take down reason dialog (`VerificationReasonDialog`, on `Dialog` from `components/ui/dialog.tsx`):**
     - Focus-trapped modal; Escape or `"Cancel"` closes it and returns focus to the triggering card button.
     - **Reject mode (V3):**
       - Title: `"Reject Space — {space.name}"`.
       - When the Space's Pending origin is `"Edited"` (V6), renders a warning callout: `"Unstarted holds (Pending Payment and Reserved) will be cancelled and paid sandbox fees refunded. Visits under way keep running."`
       - Required `"Reason"` textarea (`id="verification-reason"`, `maxLength={500}`, trimmed, `1–500` characters) with live counter `"{remaining} / 500 characters remaining"` and inline error when blank (`"Enter a reason before continuing."`) or over 500 characters (`"Reason must be 500 characters or fewer."`).
       - Actions (48 × 48 px): `"Cancel"` and destructive `"Confirm rejection"` (disabled `"Rejecting..."`, `aria-busy="true"` while pending).
     - **Take down mode (V7):**
       - Title: `"Take down Space — {space.name}"`.
       - Warning callout: `"Taking this Space down hides it from Seekers at once. Unstarted holds (Pending Payment and Reserved) are cancelled and paid sandbox fees are refunded automatically; visits under way keep running."`
       - Same required `"Reason"` textarea (`1–500` characters, live counter, inline validation).
       - Actions (48 × 48 px): `"Cancel"` and destructive `"Take down Space"` (disabled `"Taking down..."`, `aria-busy="true"` while pending).
   - **Undo & Put back confirmation (`VerificationConfirmDialog`, on `AlertDialog` from `components/ui/alert-dialog.tsx`):**
     - Focus-trapped confirmation dialog; Escape or `"Cancel"` closes and returns focus to trigger.
     - **Undo (V9, Rejected → Verified):** Title `"Undo rejection?"`, body `"{space.name} will become Verified and visible in public search immediately, and its rejection reason will be cleared. Holds cancelled by the rejection stay cancelled."`, actions `"Cancel"` / `"Undo rejection"` (`"Undoing..."`, `aria-busy="true"`).
     - **Put back (V10, Taken down → Verified):** Title `"Put Space back?"`, body `"{space.name} will become Verified and visible in public search again, and its take-down reason will be cleared. Holds cancelled by the take-down stay cancelled."`, actions `"Cancel"` / `"Put back"` (`"Putting back..."`, `aria-busy="true"`).
   - **Feedback and error announcements (`role="status"` / `aria-live="polite"` dismissible `Alert`):**
     - On success, removes the decided Space card from the active tab list, closes any open dialog, and announces:
       - V2: `"{name} has been approved."`
       - V3: `"{name} has been rejected."` (appends the hold/refund summary below if an Edited Space had cancelled holds)
       - V7: `"{name} has been taken down."` When holds were cancelled, appends `" {N} unstarted hold(s) cancelled; {M} sandbox fee(s) refunded."` When `failedRefundPaymentIds.length > 0`, also appends `" {K} sandbox refund(s) could not finish automatically — retry on Payments."` with a 48 × 48 px link to `/admin/payments?status=refundable` (D-085, D-088).
       - V9: `"Rejection undone. {name} is now Verified."`
       - V10: `"{name} has been put back and is now Verified."`
     - On refusal or error (shown inline inside the open dialog when submitted from a dialog, or in the queue alert otherwise):
       - `stale_version` (N9): `"Space details were updated while you were reviewing. Reload to inspect the latest version."` accompanied by a 48 × 48 px `"Reload latest version"` button calling `router.refresh()`.
       - `invalid_transition` (N5): `"This Space's status has changed and can no longer take that action. Reload to see its latest state."`
       - `invalid_reason` (N10): `"Enter a reason between 1 and 500 characters."`
       - `not_found`: `"This Space no longer exists."`
       - `42501`: `"You are not authorized to verify spaces."`
       - Any other error: `"We could not update the space status. Please try again."`
   - **List of changes (`SpaceEventsList`, D-086):**
     - Rendered inside each `VerificationCard` inside `<section aria-label="List of changes">` with heading `"List of changes"`.
     - Empty state (brand-new V1 Pending Space): `"No changes recorded yet."`
     - Ordered newest first (`created_at desc, id desc`). Each entry renders:
       - Status move in words when present (`"{From} → {To}"`, using `"Pending verification"`, `"Verified"`, `"Rejected"`, `"Taken down"`), plus `"Reason: {reason}"` when set;
       - Changed identity fields as `old → new` (`"Name: {old} → {new}"`, `"Address: {old} → {new}"`, `"Map pin: {oldLat}, {oldLng} → {newLat}, {newLng}"`, using `"None"` when a pin was added or removed);
       - Actor full name (`actor_name`, falling back to `"Deleted account"` when `actor_id` is null) and timestamp in `Asia/Manila` (`formatDateTime`).
     - Highlighting (D-086, always words + visual style, never colour alone): every entry newer than the Space's most recent `to_status = 'verified'` event (or all entries if never Verified) carries a `"Since last verified"` badge and highlighted left border; the newest entry (`index === 0`) carries a `"Latest"` badge and the strongest visual emphasis.
   - **Live notice (`RealtimeSpaceNotice`, D-086):**
     - Client Component mounted by `VerificationQueue` using `createClient()` (`lib/supabase/client.ts`).
     - Subscribes to `postgres_changes` (`event: 'UPDATE'`, `schema: 'public'`, `table: 'spaces'`) without an `in` filter (because Supabase Realtime caps `in` filters at 100 IDs), filters incoming events client-side to the Space IDs currently displayed (RLS enforced by Supabase Realtime), and removes the channel on unmount.
     - When an `UPDATE` arrives for a displayed Space (ignoring updates triggered by the Administrator's own in-flight action) and either `Date.parse(newUpdatedAt) !== Date.parse(renderedSpace.updated_at)` or `updated_at` cannot be parsed as an identical instant, marks that Space as stale:
       - Displays an `Alert` (`role="status"`, `aria-live="polite"`) inside that Space's `VerificationCard`: title `"Updated by Host"`, body `"{space.name} was just changed. Reload to inspect the latest details and list of changes before deciding."`, and a 48 × 48 px `"Reload latest version"` button calling `router.refresh()` (which loads fresh server data and clears the stale mark once `initialSpaces` updates).
       - Disables all decision buttons on that card (and closes any open dialog for that Space) until reloaded.
       - If Realtime disconnects or misses an event, N9 (`stale_version`) still blocks the decision and presents the same reload prompt.
2. **Host portal (`/host`, `/host/spaces/[spaceId]/edit`, and `statusBadges` consumers):**
   - **Shared `statusBadges` (`app/(dashboard)/host/_components/space-list.tsx`):**
     - Adds `taken_down: { label: 'Taken down', variant: 'destructive' }` alongside `pending` (`"Pending verification"`), `verified` (`"Verified"`), and `rejected` (`"Rejected"`). Because `/host/spaces/[spaceId]/seat-map`, `/photos`, and `/tags` import `statusBadges`, all four Host pages show `"Taken down"` in words.
   - **Host Space list (`/host`, `app/(dashboard)/host/page.tsx` + `space-list.tsx` + `resubmit-space-button.tsx`):**
     - Selects `status_reason` alongside existing columns.
     - `noticeText` adds:
       - `case 'reverify': return 'Space changes saved. It is back to Pending verification until an Administrator reviews it.'`
       - `case 'resubmitted': return 'Space resubmitted for verification.'`
     - Inside each `SpaceCard`:
       - When `status === 'rejected'` and `status_reason` is non-null: renders a callout labelled `"Rejection reason:"` with the plain-text reason (`wrap-anywhere whitespace-pre-line`).
       - When `status === 'taken_down'` and `status_reason` is non-null: renders `"Take-down reason:"` with the plain-text reason.
       - When `status === 'pending'` and `status_reason` is non-null (resubmitted via V8): renders `"Previous reason:"` with the plain-text reason.
       - When `status === 'rejected'` or `status === 'taken_down'`: renders a 48 × 48 px **`ResubmitSpaceButton`** (`Resubmit<span className="sr-only"> {space.name}</span>`, primary variant) in `CardFooter` calling `resubmitSpaceAction`. While pending, disables with `"Resubmitting..."` (`aria-busy="true"`). On success, revalidates `/host` and `/admin` and redirects to `/host?notice=resubmitted` (or updates with an `aria-live="polite"` announcement). On error (`not_resubmittable`, `42501`, or generic), renders an inline destructive `Alert`: `"We could not resubmit this Space. Refresh the page and try again."`
   - **Edit Space page (`/host/spaces/[spaceId]/edit`, `edit/page.tsx` + `space-form.tsx` + `verified-edit-warning-dialog.tsx`):**
     - `EditSpacePage` selects `status` and passes `spaceStatus={space.status}` to `SpaceForm`.
     - Subtitle:
       - When `space.status === 'verified'`: `"Changing this Space's name, address, or map pin sends it back to Pending verification. Other edits keep it Verified."`
       - Otherwise: keeps `"Saving changes to {space.name} doesn't change its Verification status."`
     - **Pre-save warning (`VerifiedEditWarningDialog`, on `AlertDialog` from `components/ui/alert-dialog.tsx`):**
       - When `mode === 'edit'` and `spaceStatus === 'verified'`, `SpaceForm` checks on submit (after client-side `spaceSchema` passes) whether trimmed `name`, trimmed `address`, or parsed `latitude`/`longitude` (including adding or removing a pin) differs from `initialValues`.
       - If none of those four identity fields changed, the form submits directly with no modal (V4).
       - If any identity field changed, submit pauses and opens `VerifiedEditWarningDialog`:
         - Title: `"Send Space back to Pending verification?"`
         - Body: `"Changing a Verified Space's name, address, or map pin hides it from Seekers until an Administrator approves it again. Holds already made here will keep running."`
         - Actions (48 × 48 px): `"Cancel"` (closes dialog and returns focus to `"Save changes"`) and `"Save and send for review"` (submits the form via `requestSubmit()` once confirmed).
     - `updateSpace` in `app/(dashboard)/host/actions.ts` reads the Space's `status` before the update, selects `id, status` back from the update, revalidates `/admin` alongside `/host`, `/spaces`, and `/spaces/[spaceId]`, and redirects to `/host?notice=reverify` when status moved from `verified` to `pending`, or `/host?notice=updated` otherwise.
3. **Seeker hold & return pages (`EndedView` in `app/(dashboard)/seeker/reservations/[id]/_components/reservation-status-view.tsx`):**
   - `MyReservation` in `lib/data/reservations.ts` maps `cancelled_by_take_down` to `cancelledByTakeDown: boolean`.
   - When `reservation.status === 'cancelled' && reservation.cancelledByTakeDown` (checked before the generic `cancelled` branch), `EndedView` renders:
     - Title: `"This Space was taken down"`.
     - Body: `"An Administrator took ${reservation.spaceName} down, so your hold on ${unit} was cancelled."` followed by the fee status line:
       - `paymentStatus === 'refunded'`: `"Your ${fee} payment was refunded."`
       - `paymentStatus === 'paid'`: `"Your ${fee} payment was recorded, and an Administrator will finish refunding it."` (failed automatic refund waiting on `/admin/payments`, D-085)
       - `paymentStatus === 'pending'` (R13 unpaid hold): `"Nothing was charged."`
     - Action link (48 × 48 px, `buttonLinkClass()`): `"Find another Space"` linking to `/spaces` (not `/spaces/${reservation.spaceId}`, because a hidden Space reads as not found, D-055).
     - Covers `/seeker/reservations/[id]`, `/seeker/reservations/[id]/confirmation`, and `/seeker`'s `CurrentHoldCard`, all of which render `EndedView`.

Already-decided rules followed above: D-031, D-055, D-073, D-074, D-079, D-084 to D-086, D-088, and D-093.

### Routes and components

| File                                                                               | Type                    | Purpose                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/<ts1>_space_status_taken_down.sql`                            | Migration (Adrian)      | Adds `'taken_down'` to `public.space_status`                                                                                             |
| `supabase/migrations/<ts2>_space_verification_follow_ups.sql`                      | Migration (Adrian)      | Columns on `spaces`/`reservations`, `space_events`, triggers, `set_space_status`, `resubmit_space`, `my_reservation`, N15, Realtime      |
| `supabase/tests/05-space-verification.sql` & `02-spaces.sql`                       | pgTAP (Adrian)          | Every V2–V10, R13–R14, and N1–N15 assertion named in `docs/flows/space-verification.md`                                                  |
| `lib/supabase/database.types.ts`                                                   | Generated (Adrian)      | Regenerated Supabase TypeScript types after TSK-20.1 migrations                                                                          |
| `lib/payments/take-down.ts`                                                        | Server-only (Adrian)    | `cleanupTakeDownHolds`: expires unpaid checkouts and refunds paid holds via STORY-14's refund helpers, with Vitest tests                 |
| `lib/data/reservations.ts`                                                         | Changed (Luke)          | Adds `cancelledByTakeDown` to `MyReservation` mapped from `public.my_reservation`                                                        |
| `lib/validation/verification.ts`                                                   | Changed (Luke)          | Reason rules (1–500 chars), extended decisions, `resubmitSpaceSchema`, `verificationQueueTabSchema`, with Vitest tests                   |
| `lib/data/verification.ts`                                                         | Server-only (Luke)      | `getVerificationSpaces`: reads Spaces per status tab with `profiles!spaces_host_id_fkey`, `space_events`, and `"Edited"`/`"Resubmitted"` |
| `app/(dashboard)/admin/page.tsx`                                                   | Changed (Luke)          | Reads `?tab`, fetches Spaces via `getVerificationSpaces`, renders status tabs and `VerificationQueue`                                    |
| `app/(dashboard)/admin/loading.tsx`                                                | Changed (Luke)          | Updates header copy alongside card skeletons while verification lists load                                                               |
| `app/(dashboard)/admin/actions.ts`                                                 | Changed (Luke)          | `setSpaceStatusAction`: validates reason/decision, calls 4-arg `set_space_status`, runs `cleanupTakeDownHolds`, maps hints               |
| `app/(dashboard)/admin/_components/verification-queue.tsx`                         | Changed (Luke)          | Status tab nav, list count, stale-Space state, dialog orchestration, and `aria-live` feedback banner                                     |
| `app/(dashboard)/admin/_components/verification-card.tsx`                          | Changed (Luke)          | Renders all four statuses, `"Edited"`/`"Resubmitted"` badges, reasons, `SpaceEventsList`, stale alert, and per-status actions            |
| `app/(dashboard)/admin/_components/verification-reason-dialog.tsx`                 | Client Component (Luke) | Modal on `components/ui/dialog.tsx` for Reject (V3) and Take down (V7) with required 1–500 char reason and hold-cancellation warning     |
| `app/(dashboard)/admin/_components/verification-confirm-dialog.tsx`                | Client Component (Luke) | Modal on `components/ui/alert-dialog.tsx` confirming Undo (V9) and Put back (V10)                                                        |
| `app/(dashboard)/admin/_components/space-events-list.tsx`                          | Client Component (Luke) | Renders `space_events` newest first with `old → new` identity diffs, `"Since last verified"`, and `"Latest"` markers                     |
| `app/(dashboard)/admin/_components/realtime-space-notice.tsx`                      | Client Component (Luke) | Subscribes to Supabase Realtime `UPDATE` events on `public.spaces` and marks edited Spaces stale until reloaded                          |
| `app/(dashboard)/host/page.tsx`                                                    | Changed (Luke)          | Selects `status_reason` and adds `reverify` and `resubmitted` notice strings                                                             |
| `app/(dashboard)/host/actions.ts`                                                  | Changed (Luke)          | Adds `resubmitSpaceAction` (`public.resubmit_space`) and updates `updateSpace` to detect V6 re-verification and revalidate `/admin`      |
| `app/(dashboard)/host/_components/space-list.tsx`                                  | Changed (Luke)          | Adds `taken_down` to `statusBadges`, renders rejection/take-down/previous reasons, and mounts `ResubmitSpaceButton`                      |
| `app/(dashboard)/host/_components/resubmit-space-button.tsx`                       | Client Component (Luke) | 48 × 48 px `"Resubmit"` control calling `resubmitSpaceAction` with `aria-busy` and inline error alert                                    |
| `app/(dashboard)/host/_components/space-form.tsx`                                  | Changed (Luke)          | Detects Verified identity-field edits and opens `VerifiedEditWarningDialog` before submitting                                            |
| `app/(dashboard)/host/_components/verified-edit-warning-dialog.tsx`                | Client Component (Luke) | Modal on `components/ui/alert-dialog.tsx` warning that editing a Verified Space's name, address, or pin sends it back to Pending         |
| `app/(dashboard)/host/spaces/[spaceId]/edit/page.tsx`                              | Changed (Luke)          | Selects `status`, updates subtitle for Verified Spaces, and passes `spaceStatus` to `SpaceForm`                                          |
| `app/(dashboard)/seeker/reservations/[id]/_components/reservation-status-view.tsx` | Changed (Luke)          | Renders take-down cancellation heading, fee copy, and `/spaces` link in `EndedView` when `cancelledByTakeDown` is true                   |
| `e2e/space-verification.spec.ts` & `e2e/host-setup.spec.ts`                        | Playwright (Luke)       | Realtime live-notice spec plus all Sprint 3 Host setup journey paths                                                                     |

### Where the files go

```
supabase/migrations/<ts1>_space_status_taken_down.sql
supabase/migrations/<ts2>_space_verification_follow_ups.sql
supabase/tests/05-space-verification.sql, 02-spaces.sql
lib/supabase/database.types.ts
lib/payments/take-down.ts, take-down.test.ts
lib/data/reservations.ts
lib/data/verification.ts, verification.test.ts
lib/validation/verification.ts, verification.test.ts
app/(dashboard)/admin/page.tsx, loading.tsx, actions.ts, actions.test.ts
app/(dashboard)/admin/_components/verification-queue.tsx, verification-card.tsx, verification-card.test.tsx
app/(dashboard)/admin/_components/verification-reason-dialog.tsx, verification-confirm-dialog.tsx
app/(dashboard)/admin/_components/space-events-list.tsx, realtime-space-notice.tsx
app/(dashboard)/host/page.tsx, actions.ts, actions.test.ts
app/(dashboard)/host/_components/space-list.tsx, space-list.test.tsx, resubmit-space-button.tsx
app/(dashboard)/host/_components/space-form.tsx, verified-edit-warning-dialog.tsx
app/(dashboard)/host/spaces/[spaceId]/edit/page.tsx
app/(dashboard)/seeker/reservations/[id]/_components/reservation-status-view.tsx, reservation-status-view.test.tsx
e2e/space-verification.spec.ts, host-setup.spec.ts
```

### Accessibility (SRS §3.2.2, D-031, D-093)

- Every control (status tabs, Approve, Reject, Take down, Undo, Put back, Resubmit, Reload latest version, and dialog buttons) is at least 48 × 48 px, keyboard reachable with visible focus, and wraps cleanly at 360, 768 and 1024 px and 200% text with no horizontal scrolling.
- Every modal (`VerificationReasonDialog`, `VerificationConfirmDialog`, and `VerifiedEditWarningDialog`) traps focus while open and returns focus to its trigger when closed with Escape or `"Cancel"`.
- Every per-card action button includes `<span className="sr-only"> {space.name}</span>` so screen readers distinguish identical labels across cards.
- Every status (`Pending verification`, `Verified`, `Rejected`, `Taken down`), Pending origin (`Edited`, `Resubmitted`), and list-of-changes marker (`Since last verified`, `Latest`) is shown in words, never colour alone.
- Live notices, decision results, and resubmissions announce in `aria-live="polite"` (`role="status"`).
- Zero new entries in `e2e/support/known-violations.ts`.

## 4. Security and test matrix

Every pgTAP case named in [`docs/flows/space-verification.md`](../flows/space-verification.md#every-move-and-its-test)
lives in `supabase/tests/05-space-verification.sql` (plus the updated V4 case in
`supabase/tests/02-spaces.sql`):

| Layer      | Case                                                                                                                                                                                 | Expected                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| pgTAP      | V2/V3/V7/V9/V10: approve (clears reason), reject with reason, take down with reason, undo rejection, put back                                                                        | Status, reason, `status_changed_*`, `space_events` updated |
| pgTAP      | V3 (after V6) & V7: cancels `pending_payment` (R13) & `reserved` (R14) holds with `cancelled_by_take_down = true`, keeps `occupied` holds running                                    | Cancelled holds returned; occupied untouched               |
| pgTAP      | V4 & V6: description/hours edit preserves status; Verified name/address/pin edit returns to Pending + logs `space_events` + keeps holds running                                      | As described; saving unchanged values keeps Verified       |
| pgTAP      | V8: Host resubmits Rejected or Taken down Space → Pending, keeps `status_reason`, logs `space_events`                                                                                | As described                                               |
| pgTAP      | N2–N6, N9–N11: direct status write, non-admin `set_space_status`, `anon`, invalid transitions, stale `updated_at`, missing/>500 reason, wrong Host                                   | `42501` or `P0001` with matching hint                      |
| pgTAP      | N7, N12–N15: non-Verified Spaces hidden, Verified has null reason, non-admin reads 0 `space_events`, no direct writes, `unit_states`/`hold_terms`                                    | 0 rows or `42501`                                          |
| Vitest     | `cleanupTakeDownHolds`: expires unpaid checkouts, refunds paid holds (with `findRefund` recovery), returns failed payment ids without crashing                                       | Against stubbed Stripe + Supabase RPC                      |
| Vitest     | `lib/validation/verification.ts`: reason trim/1–500 required only on reject/take_down, tab fallback, `resubmitSpaceSchema`                                                           | Pass/fail as specified                                     |
| Vitest     | `setSpaceStatusAction`, `resubmitSpaceAction`, and `EndedView` take-down copy                                                                                                        | Maps every hint and status cleanly                         |
| Playwright | `e2e/space-verification.spec.ts`: "an Administrator looking at a Space sees the Host's edit at once, and decides the latest version" (D-086), plus updated header/Reject-dialog flow | Live notice appears via Realtime; decision uses new state  |
| Playwright | `e2e/host-setup.spec.ts`: `host-edit-returns-pending`, `host-admin-rejects-space` (with reason), `host-resubmits-space`, `host-admin-takes-down-space`, `host-admin-restores-space`  | All Sprint 3 paths pass                                    |
| Manual     | `/admin` and `/host` at 360, 768 and 1024 px, 200% text, keyboard only; real Realtime notice across two browser sessions                                                             | No clipping, every control reachable                       |

## 5. Tasks and estimates

These rows become STORY-20's TSK sub-issues once this design merges. They total **5 points
and 2.5 days** (matching #338 and the Sprint 3 plan):

| Task     | What                                                                                                                                                                                                                                                                                                                   | Owner        | Points (1–10) | Days | Depends on                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------- | ---- | ---------------------------- |
| TSK-20.1 | Database migrations (`taken_down` enum, `spaces`/`reservations` columns, `space_events`, triggers, `set_space_status`, `resubmit_space`, `unit_states`/`hold_terms`, Realtime publication), pgTAP suite (`05-space-verification.sql` & `02-spaces.sql`), `db:types`, and `lib/payments/take-down.ts` with Vitest tests | @dreeyanzz   | 2             | 1    | This design merged, TSK-14.2 |
| TSK-20.2 | Host side: `"Taken down"` badge, reason display on `/host`, `resubmitSpaceAction`, pre-save warning on Verified identity edits, `lib/data/reservations.ts` `cancelledByTakeDown` mapping, and `EndedView` take-down wording, with Vitest tests                                                                         | @lukedongque | 1             | 0.5  | TSK-20.1                     |
| TSK-20.3 | Admin side: `/admin` Pending/Verified/Rejected/Taken down lists, Reject & Take down reason dialogs, Undo & Put back confirmations, `space_events` list of changes, Realtime live notice, and `setSpaceStatusAction` take-down cleanup wiring, with Vitest tests                                                        | @lukedongque | 1             | 0.5  | TSK-20.1, TSK-14.4           |
| TSK-20.4 | Playwright tests: Realtime live notice in `e2e/space-verification.spec.ts` and all Sprint 3 paths in `e2e/host-setup.spec.ts`, plus WCAG sweep verification                                                                                                                                                            | @lukedongque | 1             | 0.5  | TSK-20.2, TSK-20.3           |

## 6. Build order

One PR per row, and every PR targets `main`:

| #   | Branch                              | PR title                                                                   | Contains                             |
| --- | ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| 1   | `feature/STORY-20-design`           | `docs(STORY-20): design space verification follow-ups`                     | This doc and `docs/design/README.md` |
| 2   | `feature/STORY-20-verification-db`  | `feat(STORY-20): add verification status rules, events and take-down`      | TSK-20.1 (Adrian)                    |
| 3   | `feature/STORY-20-host-resubmit`    | `feat(STORY-20): show rejection reasons, resubmit and edit warning`        | TSK-20.2 (Luke)                      |
| 4   | `feature/STORY-20-admin-follow-ups` | `feat(STORY-20): add take-down, list of changes and live notice on /admin` | TSK-20.3 (Luke)                      |
| 5   | `feature/STORY-20-verification-e2e` | `test(STORY-20): cover verification follow-ups and live notice`            | TSK-20.4 (Luke)                      |

Because `checks` and `e2e` run on every PR (D-093), TSK-20.1 includes the minimal
compile/query compatibility updates forced by the schema change (`taken_down` in
`statusBadges`, widening `VerificationCardItem['status']`, disambiguating
`profiles!spaces_host_id_fkey(full_name)` in `app/(dashboard)/admin/page.tsx`, and
collecting a reason on `/admin`'s existing Reject path so Sprint 2's rejection E2E tests
pass honestly under N10 before TSK-20.3 ships the full console).

## 7. Rejected alternatives

Already recorded in `docs/DECISIONS.md` (D-079, D-084 to D-086):

- **Filing taken-down Spaces under `rejected`:** conflates never-approved Spaces with
  pulled public Spaces (D-084).
- **Refusing take-down while holds exist, or ending Occupied visits:** leaves a broken
  Space public or kicks out Seekers already seated (D-085).
- **Polling `/admin` every 15–30 seconds instead of Realtime:** adds delay before the
  Administrator sees a Host's concurrent edit (D-086).
- **Adding a separate `pending_origin` column on `spaces`:** redundant with `space_events`,
  which already records every status move atomically.
- **Putting `alter type space_status add value 'taken_down'` in the same migration as
  functions referencing `'taken_down'`:** Postgres rejects using a new enum value within
  the transaction that added it, so two migration files are required.

## 8. Open questions

None. Maria and James review the built screens in STORY-17 once implemented (D-073, D-074).

## 9. After the build

Built in four PRs after this design (#411), in the order they merged, following §6:

1. **#427 (`TSK-20.1`, #423, Adrian):** `20261126002801_space_status_taken_down.sql` (the
   `taken_down` value, alone) and `20261126002802_space_verification_follow_ups.sql` (the
   `spaces` and `reservations` columns, `space_events`, the 4-argument `set_space_status`,
   `resubmit_space`, the V6 triggers, `unit_states` and `hold_terms`, and the Realtime
   publication); `supabase/tests/05-space-verification.sql` rewritten (107 checks) and
   `02-spaces.sql`'s V4 case; `db:types`; `lib/payments/take-down.ts`
   (`cleanupTakeDownHolds`, `parseCancelledHolds`) with its Vitest tests; and §6's
   compatibility updates, including the Reject mode of `verification-reason-dialog.tsx`.
2. **#436 (`TSK-20.2`, #424):** `resubmitSpaceAction` and `resubmitSpaceSchema`, the
   reason and Resubmit on `/host` (`space-list.tsx`, `resubmit-space-button.tsx`), the V6
   warning (`verified-edit-warning-dialog.tsx`, `identityFieldsChanged` in
   `space-form.tsx`), `cancelledByTakeDown` in `lib/data/reservations.ts`, `EndedView`'s
   take-down wording, and the Host-side assertions of `host-admin-rejects-space`.
3. **#440 (`TSK-20.3`, #425):** `lib/data/verification.ts` (`getVerificationSpaces`), the
   four lists on `/admin` (`?tab`), the Take down mode of the reason dialog,
   `verification-confirm-dialog.tsx` for Undo and Put back, `space-events-list.tsx`,
   `realtime-space-notice.tsx`, and `setSpaceStatusAction` running
   `cleanupTakeDownHolds`.
4. **#444 (`TSK-20.4`, #426):** the live-notice test in `e2e/space-verification.spec.ts`,
   `host-edit-returns-pending`, `host-resubmits-space`, `host-admin-takes-down-space` and
   `host-admin-restores-space` in `e2e/host-setup.spec.ts`, the three new `/admin` tabs in
   the accessibility sweep (`e2e/support/routes.ts`), and Realtime turned on in CI's `e2e`
   job.

### What differed from the original plan, and why

- **Who opened TSK-20.2's PR:** §5 gives TSK-20.2 to Luke. #436 was opened from
  @dreeyanzz's account; its body records Luke checking the Host side by hand on the local
  stack.
- **The schema half's additions (#427):** an index on `status_changed_by`, a check that a
  status move has both ends, and the lock order in `set_space_status` (units locked before
  their lapses are recorded, as in `confirm_payment`, so two calls can't deadlock). #427
  recorded all three in §2.
- **Realtime in CI:** the `e2e` job started Supabase with `-x realtime`, so the live notice
  couldn't be tested there. #444 dropped `realtime` from the exclusions.
- **Realtime's sign-in:** §3 didn't say how the listener authenticates. Subscribing at once
  joined the channel before the Administrator's token arrived, so Realtime kept the
  listener as `anon`, and RLS silently dropped updates to Spaces that aren't Verified.
  #444's `startSpaceUpdateListener` calls `realtime.setAuth()` before joining, and if that
  fails, N9 still refuses a stale decision.
- **The Administrator's own update:** #444 keeps a decided Space marked as deciding through
  its 250 ms removal fade, so the Administrator's own Realtime `UPDATE` never shows
  "Updated by Host".
- **Small layout fix:** at 360 px and 200% text, "No rejected spaces" overflowed its empty
  card. #444 uses `p-6` below `sm` and lets the words wrap (D-031).
- **Left as they were (#440):** the guide banner and metric cards on `/admin` wait for
  STORY-17's restyle (D-073, D-074), and "Inspect" shows on Pending cards only, because
  its dialog offers only Approve and Reject.
- **Where take-down's holds are tested:** cancelling holds and refunding fees on take-down
  are proven by pgTAP and Vitest, as §4 assigns them, not by Playwright.

### Acceptance criteria coverage (#338)

| Criterion                                                                                                                                                                      | Proven by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rejecting a Space needs a reason, and its Host sees it                                                                                                                         | `05-space-verification.sql` ("an Administrator cannot reject or take down a Space without a reason", "a reason longer than 500 characters is refused", "an Administrator rejects a Pending Space with a reason, and its Host reads it"); `verification.test.ts`; `verification-reason-dialog.test.tsx`; `space-list.test.tsx`; `e2e/host-setup.spec.ts` (`host-admin-rejects-space, host-sees-rejected`)                                                                                                                                                                                                                       |
| A Host can resubmit a Rejected Space, which returns it to Pending for a second review                                                                                          | `05-space-verification.sql` ("a Host resubmits their Rejected Space, and it returns to Pending, marked Resubmitted, with its reason", "a Host cannot resubmit a Pending or a Verified Space", "an Administrator approves a resubmitted Space"); `host/actions.test.ts` ("calls resubmit_space, revalidates /host and /admin, and says so on /host"); `e2e/host-setup.spec.ts` (`host-resubmits-space`)                                                                                                                                                                                                                         |
| A Host's edit to a Verified Space's name or location sends it back to Pending, after a warning. The queue marks it "Edited", and holds already made there keep running (D-079) | `05-space-verification.sql` ("a Host adding a map pin to a Verified Space sends it back to Pending", "a new address is in the list of changes, old and new", "saving a Verified Space with the same name, address and pin keeps it Verified", "a Verified Space sent back to Pending by an edit keeps its holds running"); `space-form.test.tsx` (`identityFieldsChanged`); `verified-edit-warning-dialog.test.tsx`; `host/actions.test.ts` ("says the Space is back to Pending when a Verified Space moved (V6)"); `e2e/host-setup.spec.ts` (`host-edit-returns-pending`); `e2e/space-verification.spec.ts` (the live notice) |
| Only an Administrator moves a Space to Verified or Rejected, and a Host can never verify their own (pgTAP)                                                                     | `05-space-verification.sql` ("a Host cannot approve or reject a Space, their own included", "a Seeker cannot approve or reject a Space", "a signed-out visitor cannot run set_space_status", "an Administrator cannot write status directly", "a Host cannot take their own Verified Space down")                                                                                                                                                                                                                                                                                                                              |
| An Administrator can take a Verified Space down (the last thing cut before email, D-075)                                                                                       | `05-space-verification.sql` ("an Administrator takes a Verified Space down with a reason", "a visit under way keeps running after a take-down", "hold_terms returns nothing for a Taken down Space", "an Administrator puts a Taken down Space back"); `take-down.test.ts`; `admin/actions.test.ts` ("sends a take-down with its reason and cleans up the cancelled holds (V7, D-085)"); `e2e/host-setup.spec.ts` (`host-admin-takes-down-space`, `host-admin-restores-space`)                                                                                                                                                 |

### Still open / follow-up

- **§4's manual row:** #427 measured the Reject dialog at 360, 768 and 1024 px, with 200%
  text and by keyboard, and #436 recorded Luke's hand check of the Host side. No PR
  records the same widths, text size and keyboard check for `/host` or for `/admin`'s four
  lists and their dialogs. #436 handed the Host-side layout check to Faye and James
  (D-073, D-074). STORY-17's #438 measured `/admin` before #440 added the four lists.
- **A take-down with a paid Reserved hold, checked on `/admin/payments`:** #440 left this
  for the local stack, and no PR records it since. The pgTAP and Vitest tests above cover
  the cancellation and the refund call.
- **The live notice across two real browser sessions:** #444's Playwright test now runs it
  in CI with two browser contexts; no PR records a check by hand.
- **STORY-17:** Maria and James review how the Host and `/admin` verification screens look
  (D-073, D-074). #441 restyled `space-list.tsx` and kept its reason and Resubmit.
- The acceptance-criteria checkboxes on #338 are left for its owners to tick when closing
  it.
