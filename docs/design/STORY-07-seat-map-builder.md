# STORY-07: Snap-grid seat map builder

**Status:** draft · **Owner:** @dreeyanzz · **Story:** #56 · **FR:** FR-3.1, SRS §3.2.2 ·
**Depends on:** STORY-01, STORY-05 · **Flows:** [Reservation lifecycle](../flows/reservation-lifecycle.md), [Host setup journey](../flows/host-setup-journey.md) ·
**Decisions:** D-002, D-003, D-004, D-006, D-007, D-010, D-011, D-013, D-027, D-032, D-039, D-040, D-042, D-044, D-046, D-047, D-051, D-052, D-055

## 0. Scope

**In:**

- **The `zones` and `units` tables**, with their Row-Level Security, column grants, check constraints, and pgTAP tests (FR-3.1, D-003).
- **The snap-grid layout model (D-039):** each zone is a band 6 cells wide, with as many rows as needed. A seat or a standing desk occupies 1 cell, and a whole room occupies 2 or 3 cells in a single row. An exclusion constraint prevents overlapping units on the grid.
- **The Host seat map builder** at `/host/spaces/[spaceId]/seat-map`: adds, renames, reorders, and deletes zones; adds, edits, moves, and removes units. Each builder change saves immediately through its own Server Action (D-010, D-039).
- **Accessible list view (SRS §3.2.2):** provides an alternative view offering every builder action, operable by keyboard alone and functioning before JavaScript loads.
- **Shared seat map renderer** in `components/seat-map/`: a unified renderer that displays the snap-grid layout and legend consistently for Hosts and Seekers (FR-3.1), with an early task (TSK-07.4) so Maria (STORY-11) and James (STORY-12) can build upon it.
- **`public.unit_states(space_id)` database function:** created by this story to provide the canonical read interface for unit seat states and Host freshness timestamps (D-044, D-046, D-047). In STORY-07, it evaluates Space visibility and returns each unit's `host_state` as its seat state, `host_updated_at`, and `null` for hold-specific columns (which STORY-09 and STORY-10 populate later).
- **Venue photos Storage bucket (`space-photos`, D-040):** creates the public bucket and storage RLS policies for host uploads, and updates `deleteSpace` to clean up photos before deleting the Space.
- **Local and CI seed data (`supabase/seed.sql`):** seeded seat maps for the test Spaces, including the reference layout from SRS Figure 3.

**Out:**

- **Host occupancy control and walk-ins:** setting unit states by hand belongs to James in STORY-12 (#77). Units are initialized with `host_state = 'available'`.
- **Online holds and payments:** online reservations and payment transactions belong to Adrian in STORY-09 (#58). STORY-09 also introduces the `before delete` and `before update` triggers that check for active holds (D-052).
- **Seeker public profile and photo gallery:** displaying the verified public seat map and photo carousel belongs to Maria in STORY-11 (#76).
- **Tag assignments on units:** curated and custom tag associations belong to Luke in STORY-08 (#57).
- **QR check-in and wait windows:** remaining wait window countdowns and check-ins belong to Luke in STORY-10 (#59).
- **Cloud dev seat map seeding:** seed data remains local and in CI only (D-013, D-028); cloud dev seat maps are created by Hosts through the app UI.

## 1. Flow

### Shared flows (D-044)

- **[Host setup journey](../flows/host-setup-journey.md):** implements step H7 (`host-setup-seat-map`). After creating a Space (STORY-05), the Host can build Zones and Units on the snap grid while the Space is Pending verification, with all changes saved without altering verification status (W4, D-027). The accessible list view offers all map actions.
- **[Reservation lifecycle](../flows/reservation-lifecycle.md):**
  - **Move H1:** When a Host adds a unit, it enters with `host_state = 'available'` and `host_updated_at = now()` (D-046, D-051).
  - **Reading a state:** establishes `public.unit_states(space_id)`. It checks Space visibility: returns 0 rows for Pending or Rejected Spaces unless called by the Space's Host or an Administrator (D-055, N19). Returns `host_state` as `seat_state` and `host_updated_at`.
  - **Moves nobody may make:** enforces N15 (no direct grants on `units.host_state` or `units.host_updated_at`) and respects D-052 (held units cannot be deleted or relocated once holds arrive in STORY-09).

### This story's own part

A Host places a unit on the grid:

```mermaid
sequenceDiagram
    autonumber
    actor H as Host
    participant B as Browser (Builder UI)
    participant A as Server Action (addUnit)
    participant DB as Postgres (RLS & Exclusion)

    H->>B: Selects zone, unit type, enters label, taps empty cell (row, col)
    B->>A: Calls addUnit(spaceId, zoneId, unitType, label, capacity, row, col, colSpan)
    A->>A: Validates caller session and inputs with Zod (lib/validation/seat-map.ts)
    A->>DB: INSERT INTO units (space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span)
    alt Overlapping cell (concurrent save or conflict)
        DB-->>A: 23P01 (exclusion violation: cells overlap)
        A-->>B: Error alert: "That grid cell is already occupied"
    else Duplicate label in Space
        DB-->>A: 23505 (unique constraint violation: label already used)
        A-->>B: Error alert: "A unit with this label already exists in this Space"
    else Caller does not own Space
        DB-->>A: 42501 refusal (RLS / grant check)
        A-->>B: Error alert: "Space may not exist or you do not have permission"
    else Success
        DB-->>A: Returns created unit row
        A-->>B: revalidatePath() + returns unit
        B-->>H: Unit tile renders on the grid; focus moves to placed unit
    end
```

Moving a unit, editing details, or managing zones (create, rename, reorder, delete) follow the same round-trip pattern. Every mutation writes immediately through its dedicated Server Action (D-039). Deleting a zone or unit displays an inline confirmation step (§3) before calling the deletion action.

## 2. Data and state

### Enums

```sql
create type public.unit_type as enum ('seat', 'standing_desk', 'room');
```

Note: No `seat_state` column or enum is stored on `units` (D-046). Seat state is computed dynamically on read from active reservations or `units.host_state`.

### Tables and columns

**`zones`**: bands grouping units within a Space's seat map (D-003).

| Column       | Type          | Constraints & Rules                                                                     |
| ------------ | ------------- | --------------------------------------------------------------------------------------- |
| `id`         | `uuid` PK     | Default `gen_random_uuid()`                                                             |
| `space_id`   | `uuid`        | Not null; references `spaces(id)` on delete cascade                                     |
| `name`       | `text`        | Not null, 1–60 chars, trimmed; case-insensitive unique per Space (`lower(name)`)        |
| `position`   | `smallint`    | Not null, >= 0. Zones display top-to-bottom in this order; ties resolve by `created_at` |
| `created_at` | `timestamptz` | Not null, default `now()`                                                               |
| `updated_at` | `timestamptz` | Not null, default `now()`; maintained by `private.set_updated_at()` trigger             |

Unique constraint on `(id, space_id)` allows composite foreign key enforcement from `units`.

**`units`**: individual reservable entities within a Space (D-003, D-046, D-051).

| Column            | Type               | Constraints & Rules                                                                                  |
| ----------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `id`              | `uuid` PK          | Default `gen_random_uuid()`                                                                          |
| `space_id`        | `uuid`             | Not null; references `spaces(id)` on delete cascade                                                  |
| `zone_id`         | `uuid`             | Not null; `(zone_id, space_id)` references `zones(id, space_id)` on delete cascade                   |
| `unit_type`       | `public.unit_type` | Not null: `seat`, `standing_desk`, or `room`                                                         |
| `label`           | `text`             | Not null, 1–12 chars, trimmed; unique per Space ignoring case (`lower(label)`)                       |
| `capacity`        | `smallint`         | Null for `seat` and `standing_desk`; 1–50 for `room` (FR-3.1, D-049)                                 |
| `grid_row`        | `smallint`         | Not null, check `(grid_row >= 0 and grid_row < 50)`                                                  |
| `grid_col`        | `smallint`         | Not null, check `(grid_col >= 0 and grid_col <= 5)`                                                  |
| `col_span`        | `smallint`         | Not null, default 1; 1 for `seat`/`standing_desk`, 2 or 3 for `room`; `grid_col + col_span <= 6`     |
| `host_state`      | `text`             | Not null, default `'available'`; check `host_state in ('available', 'reserved', 'occupied')` (D-046) |
| `host_updated_at` | `timestamptz`      | Not null, default `now()`; records when Host last touched state (D-051). Initial insert sets now().  |
| `created_at`      | `timestamptz`      | Not null, default `now()`                                                                            |
| `updated_at`      | `timestamptz`      | Not null, default `now()`; maintained by `private.set_updated_at()` trigger                          |

### Constraints and grid overlap protection

- **Exclusion constraint (D-039):** prevents overlapping cells within the same zone and row:
  ```sql
  create extension if not exists btree_gist schema extensions;
  alter table public.units add constraint units_no_cell_overlap
    exclude using gist (
      zone_id with =,
      grid_row with =,
      int4range(grid_col, grid_col + col_span) with &&
    );
  ```
- **Check constraints:**
  - `capacity_matches_type`: `((unit_type = 'room' and capacity between 1 and 50) or (unit_type in ('seat', 'standing_desk') and capacity is null))`
  - `col_span_matches_type`: `((unit_type in ('seat', 'standing_desk') and col_span = 1) or (unit_type = 'room' and col_span in (2, 3)))`
  - `col_bounds`: `(grid_col + col_span <= 6)`
- **Composite foreign key:** `foreign key (zone_id, space_id) references public.zones(id, space_id) on delete cascade` guarantees that a unit and its zone cannot point to different Spaces.

### Database function: `public.unit_states`

Defined in schema `public` as `security definer` with `set search_path = ''` (D-044, D-047):

```sql
create or replace function public.unit_states(p_space_id uuid)
returns table (
  unit_id uuid,
  seat_state text,
  host_updated_at timestamptz,
  wait_window_ends_at timestamptz,
  reservation_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_space_status public.space_status;
  v_host_id uuid;
begin
  select status, host_id into v_space_status, v_host_id
  from public.spaces
  where id = p_space_id;

  if not found then
    return;
  end if;

  -- Pending or Rejected Spaces are visible only to their Host and Administrators (D-055, N19)
  if v_space_status in ('pending', 'rejected') then
    if (select auth.uid()) is distinct from v_host_id and not (select private.has_role('admin')) then
      return;
    end if;
  end if;

  -- In STORY-07, no holds exist yet; seat_state is host_state
  return query
  select
    u.id as unit_id,
    u.host_state as seat_state,
    u.host_updated_at,
    null::timestamptz as wait_window_ends_at,
    null::uuid as reservation_id
  from public.units u
  where u.space_id = p_space_id;
end;
$$;
```

Grants on `public.unit_states`:

- `revoke all on function public.unit_states(uuid) from public;`
- `grant execute on function public.unit_states(uuid) to anon, authenticated;`

### Storage bucket: `space-photos` (D-040)

- Public bucket: `space-photos`, 5 MB file size limit, allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- Path convention: `<space_id>/<filename>`.
- Policies on `storage.objects`:
  - `insert`, `update`, `delete`: authenticated users where `(storage.foldername(name))[1] = spaces.id::text` and `spaces.host_id = auth.uid()`.
  - `select`: authenticated or anonymous users where the Space is visible under STORY-01 policies.
- Deletion cleanup: `deleteSpace` action in `app/(dashboard)/host/actions.ts` empties `space-photos/<space_id>` via Supabase Storage API before executing the Space row delete.

### Grants and Row-Level Security

All direct privileges revoked from `anon` and `authenticated` first, then granted selectively:

| Table   | Verb   | Role                | Granted columns                                                                                           | Policy Check                                         |
| ------- | ------ | ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `zones` | select | anon, authenticated | all                                                                                                       | Space is visible (Verified, or caller is Host/Admin) |
| `zones` | insert | authenticated       | `space_id, name, position`                                                                                | Caller owns Space (`host_id = auth.uid()`)           |
| `zones` | update | authenticated       | `name, position`                                                                                          | Caller owns Space (`host_id = auth.uid()`)           |
| `zones` | delete | authenticated       | —                                                                                                         | Caller owns Space (`host_id = auth.uid()`)           |
| `units` | select | anon, authenticated | `id, space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span, created_at, updated_at` | Space is visible (Verified, or caller is Host/Admin) |
| `units` | insert | authenticated       | `space_id, zone_id, unit_type, label, capacity, grid_row, grid_col, col_span`                             | Caller owns Space (`host_id = auth.uid()`)           |
| `units` | update | authenticated       | `zone_id, unit_type, label, capacity, grid_row, grid_col, col_span`                                       | Caller owns Space (`host_id = auth.uid()`)           |
| `units` | delete | authenticated       | —                                                                                                         | Caller owns Space (`host_id = auth.uid()`)           |

Crucial security invariant (N15): No `select` or `update` grant is given on `units.host_state` or `units.host_updated_at`. State and freshness are read exclusively through `public.unit_states(space_id)` (D-047), and mutated only through dedicated functions (`set_unit_state` in STORY-12). Direct writes to those columns fail with Postgres error `42501`.

### Zod validation schemas (`lib/validation/seat-map.ts`)

Shared between client and Server Actions:

- `zoneNameSchema`: string trimmed, min 1, max 60 characters.
- `zonePositionSchema`: integer >= 0.
- `unitTypeSchema`: `z.enum(['seat', 'standing_desk', 'room'])`.
- `unitLabelSchema`: string trimmed, min 1, max 12 characters.
- `unitCapacitySchema`: integer between 1 and 50, required if `unit_type === 'room'`, omitted/null otherwise.
- `cellCoordinateSchema`: `grid_row` (0–49), `grid_col` (0–5), `col_span` (1–3), refined so `grid_col + col_span <= 6`.
- `addUnitSchema`, `updateUnitSchema`, `moveUnitSchema`, `deleteUnitSchema`, `reorderZonesSchema`.

## 3. UI and files

Maria owns the user experience (D-042). Maria reviews and approves the builder screens and accessible list view.

### User experience & screens

- **Route:** `/host/spaces/[spaceId]/seat-map`
- **Breadcrumbs:** Spaces > [Space Name] > Seat map builder.
- **Header:** Space title, verification badge (Pending / Verified / Rejected), link back to space dashboard, and a segmented control switching between **Grid view** and **List view**.
- **Zones overview:**
  - Displays each zone in `position` order.
  - In-place zone header with zone name, unit count, and actions: "Move up", "Move down", "Rename", "Delete zone".
  - Adding a zone: "Add zone" button opens an inline text input with "Save" and "Cancel".
- **Snap-grid builder view (D-039):**
  - Renders a 6-column grid per zone. Each cell is minimum 48×48 px to meet touch target accessibility (SRS §3.2.2).
  - Empty cells show subtle dashed borders and a plus icon on hover/focus. Clicking an empty cell opens the "Add unit" panel prefilled with the clicked coordinate.
  - Placed units render as tiles displaying:
    - Unit label (bold, wraps rather than truncating at 200% text zoom).
    - Unit type icon (seat, standing desk, room).
    - State indicator icon with accessible tooltip.
  - Whole rooms spanning 2 or 3 columns render across adjacent cells with capacity indicator (e.g., "Room A (4)").
  - **Tile selection & move:** tapping an existing unit selects it (ring highlight). Clicking an empty cell while a unit is selected moves the unit to that cell. Clicking "Edit" opens the edit form.
  - **Legend:** renders below each grid naming every icon and state indicator in clear text.
- **Accessible list view alternative (SRS §3.2.2):**
  - Designed for keyboard-only navigation and functional without JavaScript.
  - Groups units by zone. Stacks one responsive card per unit (fitting 320–360 px viewports without horizontal scrolling).
  - Each card details: label, unit type, capacity, row and column coordinates, with edit and delete form buttons.
  - Forms use native `<form action={...}>` Server Action bindings so actions complete before script hydration.
- **Inline confirmation step:**
  - Removing a unit or deleting a zone displays an inline warning card within the flow ("Are you sure you want to remove Seat S1? This action cannot be undone.") with "Cancel" and "Confirm remove" buttons. No intrusive JavaScript modal required.
- **Empty & error states:**
  - Space with no zones: friendly prompt to create the first zone.
  - Zone with no units: prompt indicating "This zone has no units. Tap an empty cell on the grid or use the form below."
  - Server action errors (e.g. overlap or duplicate label) display in an accessible error banner with specific field guidance.

### Component hierarchy and file layout

```
app/(dashboard)/host/spaces/[spaceId]/seat-map/
├── page.tsx                     # Server Component: loads space, zones, units, renders shell
├── actions.ts                   # Server Actions: addUnit, updateUnit, moveUnit, deleteUnit, createZone, renameZone, reorderZones, deleteZone
└── _components/
    ├── seat-map-builder.tsx     # Client Component: view switcher (grid / list) & builder state
    ├── zone-builder.tsx         # Client Component: zone management, ordering & unit layout
    ├── unit-form-dialog.tsx     # Client Component: unit create/edit modal form
    ├── unit-delete-confirm.tsx  # Client Component: inline confirmation card
    └── seat-map-list-view.tsx   # Server/Client Component: accessible keyboard/no-JS list view

components/seat-map/             # Shared seat map renderer (TSK-07.4)
├── seat-map-grid.tsx            # Renders 6-column zone grid with tiles
├── seat-map-tile.tsx            # Unit tile with type icon, label, and state
└── seat-map-legend.tsx          # Text legend for all icons and indicators

lib/data/
└── seat-map.ts                  # Server query helper getSeatMap(spaceId)

lib/seat-map/
└── grid.ts                      # Pure logic: grid bounds, overlap calculations, coordinate helpers

lib/validation/
├── seat-map.ts                  # Zod validation schemas
└── seat-map.test.ts             # Vitest tests for schemas and bounds
```

## 4. Security and test matrix

### pgTAP tests (`supabase/tests/03-seat-map.sql`)

| Case                                                               | Expected                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| Host selects zones and units for their own Space                   | Returns all rows                                          |
| Seeker or visitor selects zones and units for a Verified Space     | Returns all rows                                          |
| Seeker or visitor selects zones and units for a Pending Space      | 0 rows (D-055, N19)                                       |
| Another Host selects zones and units for a Pending Space           | 0 rows (D-055, N19)                                       |
| Administrator selects zones and units for a Pending Space          | Returns all rows (STORY-15)                               |
| Host inserts zone or unit in their own Space                       | Succeeds                                                  |
| Host inserts zone or unit targeting another Host's Space           | 42501 refusal or 0 rows                                   |
| Host updates unit label, capacity, or grid coordinates             | Succeeds                                                  |
| Host attempts direct update of `host_state` or `host_updated_at`   | 42501 refusal (no column grant, N15)                      |
| Host attempts direct update of `space_id`                          | 42501 refusal (no update grant)                           |
| Overlapping unit insertion in same zone and row                    | 23P01 exclusion violation                                 |
| Duplicate unit label within the same Space                         | 23505 unique constraint violation                         |
| Whole room with null capacity or seat with non-null capacity       | 23514 check constraint violation                          |
| Unit with `grid_col + col_span > 6`                                | 23514 check constraint violation                          |
| Unit referencing a zone belonging to a different Space             | Foreign key violation                                     |
| `public.unit_states` called by public on Verified Space            | Returns unit rows with `host_state` and `host_updated_at` |
| `public.unit_states` called by non-owner on Pending/Rejected Space | Returns 0 rows (N19)                                      |
| Storage: Host uploads, updates, and deletes photo in own Space     | Succeeds                                                  |
| Storage: Non-owner attempts upload/delete in another Host's Space  | Denied by storage RLS                                     |

### Vitest unit tests

- `lib/validation/seat-map.test.ts`:
  - Validates zone name trimming, length bounds (1–60), and empty rejection.
  - Validates unit label trimming and length (1–12 chars).
  - Validates room capacity bounds (1–50) and rejects non-null capacity on seats/standing desks.
  - Validates grid coordinate limits (`grid_row` 0–49, `grid_col` 0–5) and rejects `col + col_span > 6`.
- `lib/seat-map/grid.test.ts`:
  - Pure collision detection helper matches PostgreSQL exclusion logic.
  - Finds next available cell in zone.
  - Normalizes coordinate transforms.

### Manual verification checklist

- Sign in as `host@example.test`: open an owned Space, navigate to Seat Map, add "Quiet desks" zone. Place seats S1–S8, standing desks D1–D4, and rooms Room A (3 cells) and Room B (2 cells), matching SRS Figure 3.
- Verify exclusion: attempt placing a seat over an existing room tile; verify inline error message displays without losing form state.
- Switch to List view: edit a unit label and delete a unit using keyboard alone (Tab, Enter, Space).
- Responsive check: verify 360 px, 768 px, and 1024 px viewport widths without horizontal scrolling.
- Sign in as `seeker@example.test`: confirm that seat maps of Pending Spaces return 404 / 0 rows while Verified Spaces display correctly.

## 5. Tasks and estimates

All tasks are owned by Adrian (@dreeyanzz) (D-036).

| Task     | What                                                                                                                             | Owner      | Points | Days | Depends on         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---- | ------------------ |
| TSK-07.1 | The `zones` and `units` migration: enums, tables, exclusion constraints, grants, RLS, `public.unit_states`, and seed; `db:types` | @dreeyanzz | 3      | 1.0  | This design merged |
| TSK-07.2 | The `space-photos` bucket and storage RLS policies; `deleteSpace` photo cleanup                                                  | @dreeyanzz | 1      | 0.5  | This design merged |
| TSK-07.3 | `lib/seat-map/grid.ts` and `lib/validation/seat-map.ts`, with Vitest tests                                                       | @dreeyanzz | 1      | 0.5  | This design merged |
| TSK-07.4 | `getSeatMap()` query helper and shared renderer in `components/seat-map/` with legend                                            | @dreeyanzz | 1      | 0.5  | TSK-07.1, TSK-07.3 |
| TSK-07.5 | Seat map Server Actions in `app/(dashboard)/host/spaces/[spaceId]/seat-map/actions.ts`                                           | @dreeyanzz | 1      | 0.5  | TSK-07.1, TSK-07.3 |
| TSK-07.6 | The builder page with snap-grid view, inline confirmation step, and navigation links                                             | @dreeyanzz | 2      | 1.0  | TSK-07.4, TSK-07.5 |
| TSK-07.7 | The accessible list view alternative with keyboard form actions                                                                  | @dreeyanzz | 1      | 0.5  | TSK-07.6           |

Total: 10 points over 4.5 days (with 0.5 day review buffer = 5 days).

## 6. Build order

One PR per row, and every PR targets `main`. Rows 1–4 are delivered first to unblock Maria (STORY-11) and James (STORY-12).

| #   | Branch                               | PR title                                               | Contains |
| --- | ------------------------------------ | ------------------------------------------------------ | -------- |
| 1   | `feature/STORY-07-seat-map-tables`   | `feat(STORY-07): add the zones and units tables`       | TSK-07.1 |
| 2   | `feature/STORY-07-photo-bucket`      | `feat(STORY-07): add the space photos bucket`          | TSK-07.2 |
| 3   | `feature/STORY-07-seat-map-rules`    | `feat(STORY-07): add the seat map grid and form rules` | TSK-07.3 |
| 4   | `feature/STORY-07-seat-map-renderer` | `feat(STORY-07): add the shared seat map renderer`     | TSK-07.4 |
| 5   | `feature/STORY-07-seat-map-actions`  | `feat(STORY-07): add the seat map server actions`      | TSK-07.5 |
| 6   | `feature/STORY-07-seat-map-builder`  | `feat(STORY-07): add the seat map builder`             | TSK-07.6 |
| 7   | `feature/STORY-07-seat-map-list`     | `feat(STORY-07): add the seat map list view`           | TSK-07.7 |

## 7. Rejected alternatives

- **Checking overlaps only in client/application code:** Two concurrent saves could race and place overlapping units. The PostgreSQL `btree_gist` exclusion constraint is the true atomic backstop (D-039).
- **Storing `seat_state` on `units`:** Rejected by D-046. Seat state is worked out on read from active holds or `host_state`. Storing a duplicate column would introduce desynchronization and race conditions with online holds.
- **Trigger-based updating of `host_updated_at`:** Rejected by D-051. An automated trigger would erroneously update freshness on system holds, lapses, or title edits, misrepresenting the time since a Host last verified occupancy.
- **Freeform 2D floorplan canvas:** Rejected by D-003. A continuous coordinate canvas is complex to edit and impossible to make cleanly accessible or render consistently across mobile viewports. A 6-column snap grid fits a 360 px viewport with 48×48 px touch targets.
- **Saving via draft state / "Save all" button:** Rejected by D-039. Immediate per-action saves ensure that grid and list view share the same backend Server Actions, and prevent lost work from closed browser tabs.
- **Drag-and-drop as the primary interaction:** Unreliable on touch screens and inaccessible via keyboard. Tap-to-select and tap-to-move provides equal ease with full keyboard accessibility.

## 8. Open questions

None blocking this story. Integration boundaries are aligned with:

- STORY-09: online reservation creation and hold refusal triggers (D-052).
- STORY-11: photo gallery display and public seat map viewing.
- STORY-12: Host occupancy toggles via `set_unit_state`.

## 9. After the build

Fill this in when the story is done.
