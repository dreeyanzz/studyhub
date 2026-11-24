# STORY-20: Space verification follow-ups

**Status:** draft · **Owner:** @dreeyanzz (status rules, migrations, triggers, functions and pgTAP tests), @lukedongque (pages, actions, Realtime notice, §3 screens and tests) (D-073, D-075) · **Story:** #338 · **FR:** FR-5.1, FR-5.3 · **Depends on:** STORY-05, STORY-09, STORY-14, STORY-15 · **Flows:** [Space verification](../flows/space-verification.md), [Reservation lifecycle](../flows/reservation-lifecycle.md), [Host setup journey](../flows/host-setup-journey.md), [Sandbox payment confirmation](../flows/sandbox-payment-confirmation.md) · **Decisions:** D-027, D-037, D-052, D-053 to D-055, D-073 to D-075, D-079, D-083 to D-086, D-088, D-093, D-095, D-096

Sprint 2's STORY-15 added the first verification queue: Pending Spaces could be approved or
rejected once, with no reason and no way back (D-054). This story finishes verification
(D-079, D-084 to D-086): rejecting or taking down a Space requires a reason its Host can
read, a Host can resubmit a Rejected or Taken down Space, editing a Verified Space's name,
address or map pin sends it back to Pending after a warning, an Administrator can take a
Verified Space down (cancelling unstarted holds and refunding their fees) or undo either
decision, and `/admin` gains each Space's list of changes and a live notice when a Host
edits a Space an Administrator has open.

Adrian writes the database half, this design, and the take-down hold-cleanup helper; Luke
writes §3's screens section on this branch and approves the design, then builds the pages,
Server Actions, Realtime notice, and Playwright tests (D-073, D-075).

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
    Taken down tabs or lists, Reject reason dialog, Take down reason dialog, Undo (V9) and
    Put back (V10), the list of changes (`space_events`) highlighting entries since last
    Verified and the newest entry, and the Supabase Realtime live notice pausing decisions
    until the latest version loads.
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

| Column              | Type          | Rule                                                                                                       |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `status_reason`     | `text`        | Null, or 1 to 500 characters after trimming. Set on V3/V7, preserved on V8, cleared on V2/V9/V10 (N10/N12) |
| `status_changed_at` | `timestamptz` | Not null, default `now()`. Backfilled from `created_at` for existing rows; drives queue wait order         |
| `status_changed_by` | `uuid`        | Null, references `public.profiles(id)` `on delete set null`                                                |

Check constraints on `public.spaces`:

- `spaces_status_reason_length`: `status_reason is null or char_length(regexp_replace(status_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 500`
- `spaces_verified_has_no_reason`: `status <> 'verified' or status_reason is null` (guarantees N12 even at the schema level: a Verified Space never carries a stale reason).
- `spaces_rejected_or_taken_down_has_reason` is **not** forced retroactively on pre-existing Sprint 2 rejected rows (if any exist without a reason); `set_space_status` enforces a mandatory reason for every new V3 and V7 move (N10).

No `grant insert` or `grant update` is given on `status_reason`, `status_changed_at`, or
`status_changed_by` (matching `status`, N2). `select` remains granted via table-level
`grant select on table public.spaces`, governed by STORY-01's select policy (only the
Space's Host and Administrators read non-Verified Spaces, and Verified Spaces have
`status_reason is null`, enforcing N12).

Index:

- `spaces_status_changed_at_idx on public.spaces (status, status_changed_at asc)` — serves
  the Pending queue (oldest waiting first) and the Rejected / Taken down lists.

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

Check constraint:

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
   - For V3 and V7, records lapses first (`private.record_lapses` for the Space's units,
     D-047), then locks the Space's units in `id` order, then locks its `pending_payment`
     and `reserved` reservations and their payments (keeping the reservation lifecycle's
     lock order: units → reservations → payments). Cancels those holds (`status = 'cancelled'`,
     `ended_at = v_now`, `cancelled_by_take_down = true`) and leaves `occupied` holds
     untouched (D-085). Collects each cancelled hold's `reservation_id`, `previous_status`,
     `payment_id`, `payment_status`, `checkout_session_id`, and `payment_intent_id` into
     `cancelled_holds`.
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

Server-only helper `cleanupTakeDownHolds(supabase, cancelledHolds, reason)`:

- Closes each `pending_payment` hold's open Stripe checkout via `expireCheckoutSession`
  (best-effort; failures are logged because Stripe expires or P2 catches late payments).
- For each `reserved` hold whose `payment_status === 'paid'` and `payment_intent_id` is
  present, calls `createRefund({ paymentIntentId, paymentId })` with `findRefund` recovery
  (matching STORY-14 §1, D-088), then calls `supabase.rpc('record_refund', { p_payment_id, p_refund_id, p_reason })`
  with a bounded reason derived from the take-down reason (`"Space taken down: …"`,
  truncated to 300 chars).
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

> **For @lukedongque to complete on this branch (D-073, D-075):** Luke adds the full
> screens specification (exact copy, tabs, dialogs, Realtime banner, Host warning, and
> `EndedView` take-down copy) as his own commits on `feature/STORY-20-design` before
> approving this PR. Maria and James review the built screens in STORY-17 (D-073, D-074).

Outline of screens this story updates or adds (per the merged
[Space verification](../flows/space-verification.md) and
[Host setup journey](../flows/host-setup-journey.md) flows):

1. **Admin Space Verification (`/admin`, updated):**
   - Tabs or list links (`aria-current="page"`): **Pending** (oldest `status_changed_at`
     first, with `"Edited"` or `"Resubmitted"` badges and last reason), **Verified** (with
     **Take down**), **Rejected** (with reason and **Undo**), and **Taken down** (with
     reason and **Put back**).
   - **Reject** and **Take down** dialogs (`components/ui/dialog.tsx`): required reason
     textarea (`1–500` characters with live counter), plus confirmation of hold
     cancellation/refund impact on Take down (and on Rejecting an Edited Space).
   - **List of changes (`space_events`):** newest first inside each Space's verification
     card/drawer; entries since the Space was last Verified stand out, with the newest
     entry highlighted most (D-086).
   - **Live notice (`Supabase Realtime`):** subscribes to `UPDATE` events on `public.spaces`
     for open Spaces on `/admin`, announces the Host's edit in `aria-live="polite"`,
     pauses decision buttons until refreshed, and backs up with N9's `stale_version` alert.
2. **Host portal (`/host` & `/host/spaces/[spaceId]/edit`, updated):**
   - `statusBadges` gains `taken_down: { label: 'Taken down', variant: 'destructive' }`.
   - Rejected, Taken down, and resubmitted Pending cards display `status_reason`.
   - Rejected and Taken down cards offer a 48 × 48 px **Resubmit** button
     (`resubmitSpaceAction`) returning the Space to Pending with confirmation announcement.
   - Editing a **Verified** Space warns the Host before saving when `name`, `address`, or
     map pin (`latitude`/`longitude`) changed that saving will return the Space to Pending
     and hide it from search until re-approved (keeping active holds running, D-079).
3. **Seeker hold page (`EndedView` in `reservation-status-view.tsx`, updated):**
   - When `reservation.status === 'cancelled' && reservation.cancelledByTakeDown`, renders
     take-down wording explaining the Space was taken down and what happened to the fee
     (`refunded` vs `paid` awaiting retry vs `pending` nothing charged, D-085).

### Routes and components (planned)

| File                                                                               | Type                 | Purpose                                                                                                     |
| ---------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/<ts1>_space_status_taken_down.sql`                            | Migration (Adrian)   | Adds `'taken_down'` to `public.space_status`                                                                |
| `supabase/migrations/<ts2>_space_verification_follow_ups.sql`                      | Migration (Adrian)   | Columns on `spaces`/`reservations`, `space_events`, triggers, `set_space_status`, `resubmit_space`, N15, RT |
| `supabase/tests/05-space-verification.sql` & `02-spaces.sql`                       | pgTAP (Adrian)       | Every V2–V10, R13–R14, and N1–N15 assertion named in `docs/flows/space-verification.md`                     |
| `lib/payments/take-down.ts`                                                        | Server-only (Adrian) | `cleanupTakeDownHolds`: expires unpaid checkouts and refunds paid holds via STORY-14's refund helpers       |
| `lib/validation/verification.ts`                                                   | Pure TS (Luke)       | Reason rules (1–500 chars), extended decisions, `resubmitSpaceSchema`, tab params                           |
| `lib/data/verification.ts`                                                         | Server-only (Luke)   | Reads Spaces per status tab with `space_events` history and `"Edited"` / `"Resubmitted"` origin             |
| `app/(dashboard)/admin/page.tsx`, `actions.ts`, `_components/*`                    | Changed (Luke)       | Tabs, Reject/Take down dialogs, Undo/Put back, list of changes, Realtime live notice                        |
| `app/(dashboard)/host/page.tsx`, `actions.ts`, `_components/*`, `edit/page.tsx`    | Changed (Luke)       | Taken down badge, reason display, `resubmitSpaceAction`, Verified edit warning                              |
| `app/(dashboard)/seeker/reservations/[id]/_components/reservation-status-view.tsx` | Changed (Luke)       | Take-down cancellation wording when `cancelledByTakeDown` is true                                           |
| `e2e/space-verification.spec.ts` & `e2e/host-setup.spec.ts`                        | Playwright (Luke)    | Live-notice spec plus all Sprint 3 Host setup journey paths                                                 |

### Accessibility (SRS §3.2.2, D-031, D-093)

- Every control (tabs, Reject, Take down, Undo, Put back, Resubmit, dialog buttons) is at
  least 48 × 48 px, keyboard reachable with visible focus, and wraps cleanly at 360, 768
  and 1024 px and 200% text.
- Every status (`Pending verification`, `Verified`, `Rejected`, `Taken down`, `Edited`,
  `Resubmitted`) is shown in words, never colour alone.
- Live notices, moderation outcomes, and resubmissions announce in `aria-live="polite"`.
- Zero new entries in `e2e/support/known-violations.ts`.

## 4. Security and test matrix

Every pgTAP case named in [`docs/flows/space-verification.md`](../flows/space-verification.md#every-move-and-its-test)
lives in `supabase/tests/05-space-verification.sql` (plus the updated V4 case in
`supabase/tests/02-spaces.sql`):

| Layer      | Case                                                                                                                                                                                | Expected                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| pgTAP      | V2/V3/V7/V9/V10: approve (clears reason), reject with reason, take down with reason, undo rejection, put back                                                                       | Status, reason, `status_changed_*`, `space_events` updated |
| pgTAP      | V3 (after V6) & V7: cancels `pending_payment` (R13) & `reserved` (R14) holds with `cancelled_by_take_down = true`, keeps `occupied` holds running                                   | Cancelled holds returned; occupied untouched               |
| pgTAP      | V4 & V6: description/hours edit preserves status; Verified name/address/pin edit returns to Pending + logs `space_events` + keeps holds running                                     | As described; saving unchanged values keeps Verified       |
| pgTAP      | V8: Host resubmits Rejected or Taken down Space → Pending, keeps `status_reason`, logs `space_events`                                                                               | As described                                               |
| pgTAP      | N2–N6, N9–N11: direct status write, non-admin `set_space_status`, `anon`, invalid transitions, stale `updated_at`, missing/>500 reason, wrong Host                                  | `42501` or `P0001` with matching hint                      |
| pgTAP      | N7, N12–N15: non-Verified Spaces hidden, Verified has null reason, non-admin reads 0 `space_events`, no direct writes, `unit_states`/`hold_terms`                                   | 0 rows or `42501`                                          |
| Vitest     | `cleanupTakeDownHolds`: expires unpaid checkouts, refunds paid holds (with `findRefund` recovery), returns failed payment ids without crashing                                      | Against stubbed Stripe + Supabase RPC                      |
| Vitest     | `lib/validation/verification.ts`: reason trim/1–500 required only on reject/take_down, tab fallback, `resubmitSpaceSchema`                                                          | Pass/fail as specified                                     |
| Vitest     | `setSpaceStatusAction`, `resubmitSpaceAction`, and `EndedView` take-down copy                                                                                                       | Maps every hint and status cleanly                         |
| Playwright | `e2e/space-verification.spec.ts`: "an Administrator looking at a Space sees the Host's edit at once, and decides the latest version" (D-086)                                        | Live notice appears via Realtime; decision uses new state  |
| Playwright | `e2e/host-setup.spec.ts`: `host-edit-returns-pending`, `host-admin-rejects-space` (with reason), `host-resubmits-space`, `host-admin-takes-down-space`, `host-admin-restores-space` | All Sprint 3 paths pass                                    |
| Manual     | `/admin` and `/host` at 360, 768 and 1024 px, 200% text, keyboard only; real Realtime notice across two browser sessions                                                            | No clipping, every control reachable                       |

## 5. Tasks and estimates

These rows become STORY-20's TSK sub-issues once this design merges. They total **5 points
and 2.5 days** (matching #338 and the Sprint 3 plan):

| Task     | What                                                                                                                                                                                                                                                                                                                   | Owner        | Points (1–10) | Days | Depends on                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------- | ---- | ---------------------------- |
| TSK-20.1 | Database migrations (`taken_down` enum, `spaces`/`reservations` columns, `space_events`, triggers, `set_space_status`, `resubmit_space`, `unit_states`/`hold_terms`, Realtime publication), pgTAP suite (`05-space-verification.sql` & `02-spaces.sql`), `db:types`, and `lib/payments/take-down.ts` with Vitest tests | @dreeyanzz   | 2             | 1    | This design merged, TSK-14.2 |
| TSK-20.2 | Host side: `"Taken down"` badge, reason display on `/host`, `resubmitSpaceAction`, pre-save warning on Verified identity edits, and `EndedView` take-down wording, with Vitest tests                                                                                                                                   | @lukedongque | 1             | 0.5  | TSK-20.1                     |
| TSK-20.3 | Admin side: `/admin` Pending/Verified/Rejected/Taken down lists, Reject & Take down reason dialogs, Undo & Put back, `space_events` list of changes, Realtime live notice, and `setSpaceStatusAction` take-down cleanup wiring, with Vitest tests                                                                      | @lukedongque | 1             | 0.5  | TSK-20.1, TSK-14.4           |
| TSK-20.4 | Playwright tests: Realtime live notice in `e2e/space-verification.spec.ts` and all Sprint 3 paths in `e2e/host-setup.spec.ts`, plus WCAG sweep verification                                                                                                                                                            | @lukedongque | 1             | 0.5  | TSK-20.2, TSK-20.3           |

## 6. Build order

One PR per row, and every PR targets `main`:

| #   | Branch                              | PR title                                                              | Contains                             |
| --- | ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| 1   | `feature/STORY-20-design`           | `docs(STORY-20): design space verification follow-ups`                | This doc and `docs/design/README.md` |
| 2   | `feature/STORY-20-verification-db`  | `feat(STORY-20): add verification status rules, events and take-down` | TSK-20.1 (Adrian)                    |
| 3   | `feature/STORY-20-host-resubmit`    | `feat(STORY-20): show rejection reasons, resubmit and edit warning`   | TSK-20.2 (Luke)                      |
| 4   | `feature/STORY-20-admin-follow-ups` | `feat(STORY-20): add take-down, change log and live notice on /admin` | TSK-20.3 (Luke)                      |
| 5   | `feature/STORY-20-verification-e2e` | `test(STORY-20): cover verification follow-ups and live notice`       | TSK-20.4 (Luke)                      |

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

None blocking. `@lukedongque` writes the detailed §3 Screens subsection on this branch
and approves the PR before it merges (D-073, D-075).

## 9. After the build

Filled in when the story is done.
