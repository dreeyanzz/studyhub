# STORY-05: Host portal and Space CRUD

**Status:** approved 2026-09-28 · **Owners:** @dreeyanzz (design, validation and Server Actions) with
@JamesNino-Mandawe (portal pages and forms) · **Story:** #54 · **FR:** FR-3.1,
FR-5.1, SRS §3.2.2, §3.5 and §3.8 · **Depends on:** STORY-01, STORY-02 and STORY-03 ·
**Decisions:** D-007, D-010, D-013, D-016, D-019, D-027, D-028, D-031 and D-032

## 0. Scope

### Story outcome

An authenticated Host gets a `/host` portal where they can see every Space they own,
create a Space, edit its basic details and permanently delete it after an explicit
confirmation. All reads and writes use the signed-in user's Supabase session, and the
existing `spaces` Row-Level Security (RLS) policies remain the security boundary.

This is the Sprint 1 slice of FR-3.1. It deliberately implements only the basic Space
record that the Midterm CRUD demonstration needs. FR-3.1's photos, tags and seat map are
owned by later stories. FR-5.1 contributes one rule to this story: a Space that is not
Verified must not become publicly readable.

### In scope

- A protected Host portal shell at `/host`, with:
  - the signed-in person's current `profiles.full_name`;
  - their actual role as a badge (an Administrator may open `/host`, D-032);
  - a Spaces navigation item; and
  - a Log out button wired to STORY-03's existing `signOut` Server Action.
- A server-rendered list of Spaces owned by the signed-in person, newest-updated first.
- An empty state that explains how to create the first Space.
- A create form on `/host` for:
  - Space name;
  - address;
  - optional description;
  - opening time; and
  - closing time.
- A dedicated edit page at `/host/spaces/[spaceId]/edit`, pre-filled from the owner's
  saved Space.
- A dedicated confirmation page at `/host/spaces/[spaceId]/delete`. Visiting the page
  never deletes anything; deletion requires submitting its destructive form.
- Shared Zod rules in `lib/validation/space.ts`, run in the browser and again inside the
  create and update Server Actions.
- `createSpace`, `updateSpace` and `deleteSpace` Server Actions in the `/host` route
  segment's single `actions.ts` file (D-010).
- Clear validation, authorization and unexpected-database error states that never show
  raw Supabase messages.
- `revalidatePath('/host')` after every successful mutation, followed by a redirect to
  the refreshed list with an allow-listed success notice.
- Vitest coverage for every validation boundary introduced here.
- Reuse of STORY-01's pgTAP coverage for public visibility, ownership, forbidden
  columns and cross-Host writes.
- Responsive and keyboard-only verification at 360, 768 and 1024 CSS pixels.

### Out of scope

- Any database migration, generated-type change, grant or RLS-policy change. STORY-01
  already created the exact table and policies this story needs.
- Changing a Space's `host_id` or verification `status`. Hosts never receive column
  privileges for either field. Administrator verification belongs to STORY-14.
- Photos, map coordinates, Zones, Units and the seat map (STORY-07).
- Curated tags, custom tags, study preferences, search filters and price tier
  (STORY-08).
- A reservation fee, payment checkout or any other price field (STORY-09).
- Public search or a public Space-detail page. STORY-01's RLS still proves that only
  Verified Spaces can be read publicly, but this story does not create a public reader.
- Different opening hours per weekday. Sprint 1 stores one opening and closing time for
  every day (D-027).
- An Administrator verification queue, rejection reason or moderation controls
  (STORY-14).
- Pagination, sorting controls, bulk edits, soft deletion, undo, autosave, file uploads,
  optimistic UI or live subscriptions.
- A new Dialog, Textarea, navigation or toast primitive. STORY-02 owns the shared design
  system; this story uses its existing primitives plus semantic native HTML.

### Acceptance-criterion interpretation

| Story acceptance criterion                      | Concrete behavior in this design                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Host creates a Space and sees it immediately  | `createSpace` inserts it as the caller with status `pending`, revalidates `/host`, and redirects to the list with a success notice.                     |
| A Host edits their own name, address and hours  | The edit page also permits the in-scope description. `updateSpace` sends only the five Host-editable columns and leaves ownership and status untouched. |
| A Host deletes their own Space after confirming | The Host must visit the named Space's delete page and submit a POST-backed Server Action. A link, page load or Cancel action cannot delete it.          |
| Another Host cannot update or delete it         | The action scopes the mutation to both `id` and the authenticated user's `host_id`; RLS independently returns zero rows for a non-owner.                |
| An unverified Space is not public               | Existing anonymous and Seeker pgTAP cases return Verified rows only. This story does not weaken or replace those policies.                              |

## 1. Flows

### 1.1 Read the Host portal

```mermaid
sequenceDiagram
    autonumber
    actor H as Host
    participant B as Browser
    participant X as proxy.ts
    participant P as /host Server Components
    participant DB as Supabase/Postgres (RLS)
    H->>B: opens /host
    B->>X: GET /host
    X->>DB: refresh session; read caller's profile role
    alt anonymous or wrong non-Administrator role
        X-->>B: redirect to login or that role's dashboard
    else Host or Administrator
        X-->>P: continue with refreshed session cookies
        P->>DB: getUser() as an authentication backstop
        P->>DB: select caller's profile for the header
        P->>DB: select Space display columns where host_id = caller id, order by updated_at desc
        DB-->>P: only rows permitted by RLS
        P-->>B: header, create form, owned-Space list or empty state
    end
```

`proxy.ts` improves routing but is not trusted as authorization. The page authenticates
again and every query uses the session-bound Supabase server client. The list query
includes `host_id = user.id` even though RLS already enforces ownership for Hosts. That
explicit scope documents the page's intent and means an Administrator who is allowed to
open `/host` does not accidentally receive an Administrator listing screen before
STORY-14.

### 1.2 Create a Space

```mermaid
sequenceDiagram
    autonumber
    actor H as Host
    participant F as Create form (Client Component)
    participant A as createSpace (Server Action)
    participant DB as Supabase/Postgres (RLS)
    participant P as /host Server Component
    H->>F: enters details and presses Create Space
    F->>F: spaceSchema validates in the browser
    alt browser validation fails
        F-->>H: show inline errors; focus first invalid field
    else browser validation passes
        F->>A: submit FormData
        A->>A: authenticate with getUser(); parse again with spaceSchema
        alt server validation fails
            A-->>F: field errors plus safe entered values
        else valid
            A->>DB: insert only name, description, address, opens_at, closes_at
            Note over A,DB: host_id and status are omitted; DB defaults them
            alt insert rejected or unavailable
                DB-->>A: error
                A-->>F: safe form-level error; entered values retained
            else one row inserted
                DB-->>A: inserted id
                A->>A: revalidatePath('/host')
                A-->>P: redirect('/host?notice=created')
                P->>DB: read the owned list again
                DB-->>P: list includes the new pending Space
                P-->>H: refreshed list and success status message
            end
        end
    end
```

The action constructs the insert payload field by field. Extra form keys such as a
forged `host_id` or `status` are never copied into the query. PostgreSQL column grants
and the insert RLS policy independently reject those fields if an implementation later
tries to send them.

### 1.3 Edit a Space

```mermaid
sequenceDiagram
    autonumber
    actor H as Host
    participant B as Browser
    participant E as Edit page (Server Component)
    participant F as Space form (Client Component)
    participant A as updateSpace (Server Action)
    participant DB as Supabase/Postgres (RLS)
    H->>B: follows Edit for one owned Space
    B->>E: GET /host/spaces/[spaceId]/edit
    E->>DB: select editable columns where id = spaceId and host_id = caller id
    alt malformed id or row unavailable to caller
        DB-->>E: no row
        E-->>B: not-found response
    else owned row
        DB-->>E: saved values
        E-->>F: render pre-filled form
        H->>F: changes details and presses Save changes
        F->>F: validate spaceId and fields in browser
        F->>A: submit FormData
        A->>A: authenticate and validate again
        A->>DB: update five editable columns where id and host_id match caller
        alt zero rows or database error
            DB-->>A: no updated id or error
            A-->>F: one non-enumerating error; entered values retained
        else one row updated
            DB-->>A: updated id
            A->>A: revalidatePath('/host')
            A-->>B: redirect('/host?notice=updated')
        end
    end
```

An edit never sends `status`, so a Verified Space stays Verified, a Pending Space stays
Pending and a Rejected Space stays Rejected (D-027). A zero-row result deliberately
does not tell the caller whether the UUID exists for another Host.

### 1.4 Delete a Space

```mermaid
sequenceDiagram
    autonumber
    actor H as Host
    participant B as Browser
    participant C as Delete confirmation page
    participant A as deleteSpace (Server Action)
    participant DB as Supabase/Postgres (RLS)
    H->>B: follows Delete for one owned Space
    B->>C: GET /host/spaces/[spaceId]/delete
    C->>DB: select id and name where id and host_id match caller
    alt malformed id or row unavailable to caller
        DB-->>C: no row
        C-->>B: not-found response
    else owned row
        DB-->>C: id and name
        C-->>B: warning, named Space, Cancel link, Delete Space button
        alt Host chooses Cancel
            B-->>B: navigate to /host; no mutation
        else Host submits Delete Space
            B->>A: POST-backed Server Action with spaceId
            A->>A: authenticate and validate id
            A->>DB: delete where id and host_id match caller; return id
            alt zero rows or database error
                DB-->>A: no deleted id or error
                A-->>B: safe error; confirmation remains available
            else one row deleted
                DB-->>A: deleted id
                A->>A: revalidatePath('/host')
                A-->>B: redirect('/host?notice=deleted')
            end
        end
    end
```

The GET confirmation route is read-only. This prevents destructive navigation,
preloading or a crawler from deleting a Space. The destructive submit button names the
action and Space clearly; keyboard focus is not moved into a custom modal.

## 2. Data, validation and action contracts

### 2.1 Existing database contract

This story adds no table or column. It consumes `public.spaces` exactly as implemented
by STORY-01:

| Column        | Type                    | Host portal behavior                                                                                         |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`          | `uuid` primary key      | Generated by PostgreSQL; used only as an opaque route and action identifier. Never editable.                 |
| `host_id`     | `uuid not null`         | Defaults to `auth.uid()` on insert. The UI/action never accepts it from the Host. Never editable.            |
| `name`        | `text not null`         | Trimmed by Zod; 1–100 characters. PostgreSQL independently rejects empty/whitespace-only or overlong values. |
| `description` | nullable `text`         | Optional; at most 2,000 characters. An empty form value is stored as `null`.                                 |
| `address`     | `text not null`         | Trimmed by Zod; 1–200 characters. PostgreSQL independently rejects empty/whitespace-only or overlong values. |
| `opens_at`    | `time not null`         | Entered as a 24-hour `HH:mm` HTML time value. One value applies every day.                                   |
| `closes_at`   | `time not null`         | Entered as `HH:mm`. Earlier than opening means next-day closing; equal times mean open 24 hours (D-027).     |
| `status`      | `space_status not null` | Defaults to `pending`. Displayed as Verification status; never accepted by Host mutations.                   |
| `created_at`  | `timestamptz not null`  | Database generated; not editable.                                                                            |
| `updated_at`  | `timestamptz not null`  | Database trigger updates it after an edit; used for stable newest-updated-first ordering.                    |

The generated row type is
`Database['public']['Tables']['spaces']['Row']`. Because the schema is unchanged,
`npm run db:types` must not produce a diff in this story.

### 2.2 Verification-status behavior

| From       | Event in STORY-05      | To         | Why                                                                   |
| ---------- | ---------------------- | ---------- | --------------------------------------------------------------------- |
| no row     | Host creates a Space   | `pending`  | Database default; Hosts cannot insert `status`.                       |
| `pending`  | Host edits details     | `pending`  | The action does not send `status`.                                    |
| `verified` | Host edits details     | `verified` | D-027 explicitly keeps an edited Verified Space verified in Sprint 1. |
| `rejected` | Host edits details     | `rejected` | The action does not send `status`; re-review belongs to STORY-14.     |
| any status | Host confirms deletion | no row     | STORY-05 requires permanent deletion; no soft-delete field exists.    |

`pending → verified`, `pending → rejected` and any later re-verification transition are
Administrator work in STORY-14, not hidden side effects of a Host edit.

### 2.3 `spaceSchema`

`lib/validation/space.ts` exports one schema used by both create and update:

| Form key      | Rule                                                                              | Normalized output              | Exact user-facing messages                                             |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `name`        | string; trim; minimum 1; maximum 100 characters                                   | trimmed string                 | `Space name is required`; `Space name must be 100 characters or fewer` |
| `description` | optional string defaulting to `''`; trim; maximum 2,000 characters; empty allowed | trimmed string, including `''` | `Description must be 2,000 characters or fewer`                        |
| `address`     | string; trim; minimum 1; maximum 200 characters                                   | trimmed string                 | `Address is required`; `Address must be 200 characters or fewer`       |
| `opensAt`     | required string matching 24-hour `HH:mm`                                          | unchanged `HH:mm`              | `Opening time is required`; `Enter a valid opening time`               |
| `closesAt`    | required string matching 24-hour `HH:mm`                                          | unchanged `HH:mm`              | `Closing time is required`; `Enter a valid closing time`               |

The time pattern accepts `00:00` through `23:59` and rejects missing values, seconds,
single-digit hours and impossible times. There is intentionally no comparison refinement:

- `07:00` to `22:00` means same-day hours;
- `18:00` to `02:00` means closing after midnight; and
- `00:00` to `00:00` (or any other equal pair) means open 24 hours.

The schema leaves an empty description as `''` so the input and output types remain
friendly to controlled or default-valued form fields. The Server Actions convert `''`
to `null` immediately before the Supabase mutation, matching the database contract.

### 2.4 Identifier schema

The module also exports a UUID validator for the hidden `spaceId`. Create does not use
it. Update and delete must validate it before querying. A malformed value returns a
generic form error (`We could not find that Space.`) or a not-found response; it is not
sent to Postgres and never appears in a raw database error.

The identifier is kept separate from `spaceSchema` so create cannot accidentally grow
an editable id and so the visible form-field error type contains only visible fields.

### 2.5 Form state

The actions return serializable state on recoverable failures:

```ts
type SpaceFormValues = Partial<
  Record<'name' | 'description' | 'address' | 'opensAt' | 'closesAt', string>
>

type SpaceFormState = {
  fieldErrors?: Partial<Record<keyof SpaceFormValues, string[]>>
  formError?: string
  values?: SpaceFormValues
}

type DeleteSpaceState = {
  formError?: string
}
```

These are contracts for the later implementation, not code added by this design PR.
Values returned to the browser never include `host_id`, `status`, timestamps, session
data or a raw Supabase error. Invalid create/update attempts preserve the five safe form
values so the Host can correct one field without retyping everything.

### 2.6 Server Action contracts

| Action        | Accepted input                               | Authentication and ownership                                                                   | Mutation                                                                                                                  | Success                                                | Recoverable failure                                                                                                             |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `createSpace` | five visible fields                          | `getUser()` must return a user; insert RLS also requires role `host`                           | Insert an explicit five-column object; convert empty description to `null`; omit `id`, `host_id`, `status` and timestamps | Revalidate `/host`; redirect to `/host?notice=created` | Return field errors or `We could not create this Space. Please try again.`                                                      |
| `updateSpace` | validated `spaceId` plus five visible fields | `getUser()`; query filters by both `id` and `host_id = user.id`; update RLS repeats ownership  | Update only five editable columns; request returned `id` to distinguish one row from zero                                 | Revalidate `/host`; redirect to `/host?notice=updated` | Zero rows and authorization failures share `We could not save this Space. It may no longer exist or you may not have access.`   |
| `deleteSpace` | validated `spaceId`                          | `getUser()`; delete filters by both `id` and `host_id = user.id`; delete RLS repeats ownership | Delete and request returned `id`                                                                                          | Revalidate `/host`; redirect to `/host?notice=deleted` | Zero rows and authorization failures share `We could not delete this Space. It may no longer exist or you may not have access.` |

If authentication has expired, all three actions redirect to
`/login?returnUrl=%2Fhost`. `redirect()` is called after Supabase error handling, not
inside a `try` block, because Next.js 16 implements it by throwing a framework-handled
control-flow error. `revalidatePath()` runs before each success redirect.

The fixed notice values are allow-listed by `/host`:

| Query value | Rendered status text                         |
| ----------- | -------------------------------------------- |
| `created`   | `Space created. It is pending verification.` |
| `updated`   | `Space changes saved.`                       |
| `deleted`   | `Space deleted.`                             |

Any other `notice` value is ignored rather than rendered. This avoids reflecting
arbitrary query-string text into the page.

### 2.7 Query shapes

The portal reads only the columns it displays:

- Header: own `profiles.full_name` and `profiles.role`.
- List: `id`, `name`, `description`, `address`, `opens_at`, `closes_at`, `status` and
  `updated_at`, filtered by `host_id = user.id`, ordered by `updated_at` descending and
  then `name` ascending for deterministic ties.
- Edit page: the five editable values plus `id`, filtered by `id` and `host_id`.
- Delete page: `id` and `name`, filtered by `id` and `host_id`.

There is no client-side Supabase query, no N+1 query and no secret-key/admin client.

## 3. UI, routes and files

### 3.1 Route map

| Route                           | Rendering                                      | Purpose                                                                                                       |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/host`                         | Server page with one create-form Client island | Read the current user, render the create form, owned-Space list, empty state and allow-listed success notice. |
| `/host/spaces/[spaceId]/edit`   | Server page with shared form Client island     | Read one owned Space, normalize database `time` strings to `HH:mm`, and render the pre-filled update form.    |
| `/host/spaces/[spaceId]/delete` | Server page with delete-form Client island     | Read one owned Space and render the irreversible-action warning and explicit confirmation.                    |

The route parameter is asynchronous in Next.js 16 and is awaited before validation.
Missing, malformed or inaccessible Space ids produce the same not-found result.

### 3.2 `/host` page

The page is ordered for a useful mobile and keyboard flow:

1. One `h1`: `Manage Spaces`.
2. A short explanation that new Spaces start Pending verification and are not public.
3. An allow-listed success `Alert` with `role="status"`, when applicable.
4. A `Create a Space` section containing the create form.
5. A `Your Spaces` section with the count and list.
6. An empty-state `Card` when the list has no rows.

Each Space card shows:

- its name as a heading;
- a Verification status badge:
  - `Pending verification` for `pending`;
  - `Verified` for `verified`;
  - `Rejected` for `rejected`;
- address;
- description when present;
- operating hours in a readable 24-hour display;
- an explicit explanation for special hours:
  - equal opening/closing: `Open 24 hours`;
  - closing earlier than opening: suffix `next day`;
- the last updated timestamp; and
- 48-pixel-minimum Edit and Delete links whose accessible names include the Space name
  when adjacent card context would otherwise be ambiguous.

The list is authoritative server output. The feature does not pretend that a mutation
succeeded before Postgres accepts it.

### 3.3 Create/edit form

One route-local `SpaceForm` Client Component supports `create` and `edit` modes. The
Server Component provides initial values and the correct imported action. It uses
React 19's `useActionState` for pending and returned-server state, following the pattern
already established by STORY-03.

Field order and HTML controls:

| Field        | HTML                                             | Attributes and guidance                                                   |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Space name   | STORY-02 `Input`                                 | `type="text"`, `autoComplete="organization"`, required, `maxLength=100`   |
| Address      | STORY-02 `Input`                                 | `type="text"`, `autoComplete="street-address"`, required, `maxLength=200` |
| Description  | native `textarea` styled only with design tokens | optional, `maxLength=2000`, visible character limit guidance              |
| Opening time | STORY-02 `Input`                                 | `type="time"`, required, 24-hour value                                    |
| Closing time | STORY-02 `Input`                                 | `type="time"`, required, hint explaining next-day and 24-hour meanings    |

`maxLength` helps ordinary users but does not replace Zod or database constraints. The
form has `noValidate` so one consistent Zod message set drives browser and server
feedback. On submit it:

1. blocks a duplicate submit while pending;
2. validates `Object.fromEntries(new FormData(form))` in the browser;
3. prevents submission and exposes inline errors if invalid;
4. moves focus to the first `[aria-invalid="true"]` field;
5. otherwise dispatches the Server Action; and
6. shows a returned form error in a destructive `Alert`.

Each label is explicit. Each invalid control has `aria-invalid="true"` and an
`aria-describedby` reference to its first error and any persistent hint. Pending button
copy is `Creating Space…` or `Saving changes…`; the button remains focusable while
disabled, matching the established auth-form pattern.

The action accepts the same fields when JavaScript is unavailable. Client validation is
an enhancement; server validation and RLS remain mandatory.

### 3.4 Delete confirmation

The confirmation page names the Space and says deletion is permanent. It contains:

- a `Cancel` link to `/host` styled as an outline action;
- a destructive `Delete Space` submit button;
- a hidden, server-supplied `spaceId` value; and
- a destructive `Alert` for a recoverable action error.

The Cancel action receives keyboard focus before the destructive button in DOM order.
The confirmation does not require typing the name because the story asks for a
confirmation, not a high-friction challenge, and Sprint 1 Spaces have no dependent
Zones, Units or Reservations yet.

### 3.5 Host shell

The layout mirrors the established Seeker shell without coupling the two route-local
components. `HostHeader` is a Server Component that:

- calls `getUser()` as a backstop to `proxy.ts`;
- redirects an anonymous request to `/login?returnUrl=%2Fhost`;
- reads the current profile, never `user_metadata`;
- displays the saved full name, falling back to `Host portal` if it is null;
- maps `seeker`, `host` and `admin` to the glossary labels Seeker, Host and
  Administrator;
- includes an `aria-current="page"` Spaces navigation link; and
- submits the existing `signOut` action.

An Administrator may render this shell (D-032), so neither the badge nor name is
hard-coded to Host. The page remains an owner portal, not the Administrator queue.

### 3.6 Responsive behavior

- At 360 pixels the form is one column, cards stack, and action links wrap vertically
  or onto multiple lines without horizontal scrolling.
- At 768 pixels opening and closing inputs may share two columns; content remains in
  reading order.
- At 1024 pixels the create section and list may use the available width, while readable
  text remains constrained and cards do not depend on hover.
- Long but valid names, addresses and descriptions wrap with `overflow-wrap` behavior;
  they never force the viewport wider.
- All interactive controls inherit or explicitly match STORY-02's 48×48-pixel minimum.
- No meaning depends only on badge color. Every Verification status is written as text.
- The document retains a logical heading hierarchy and one `main` landmark supplied by
  the Host layout.

### 3.7 File plan

```text
app/(dashboard)/host/
  layout.tsx                         Server Component: Host portal shell and main landmark
  page.tsx                           Server Component: auth backstop, create section, owned list, notices
  actions.ts                        Server Actions: createSpace, updateSpace, deleteSpace
  _components/
    host-header.tsx                  Server Component: profile identity, role badge, navigation, logout
    space-form.tsx                   Client Component: shared create/edit fields and action state
    space-form-field.tsx             Client helper: labels, hints and inline error associations
    space-list.tsx                   Server/presentational component: cards and empty state
    delete-space-form.tsx            Client Component: pending/error state for confirmed deletion
  spaces/
    [spaceId]/
      edit/
        page.tsx                     Server Component: owner-scoped read and edit form
      delete/
        page.tsx                     Server Component: owner-scoped read and confirmation
lib/validation/
  space.ts                           spaceSchema, spaceIdSchema and inferred types
  space.test.ts                      Vitest boundary and normalization tests
```

No file is added under `app/api/`, `lib/supabase/`, `supabase/migrations/`,
`supabase/tests/` or `components/ui/`.

## 4. Security, failure handling and verification

### 4.1 Security boundaries

| Layer                                      | Responsibility                                                                         | What it does not replace                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `proxy.ts`                                 | Refresh the session and route anonymous, Seeker and Host users to appropriate portals. | It does not authorize a database row or mutation.             |
| Server Component/Action `getUser()`        | Establish the authenticated user from a server-verified Supabase session.              | It does not grant access to a Space.                          |
| Explicit `host_id = user.id` query filters | Express that this UI is an owner's portal and make zero-row handling deterministic.    | They do not replace RLS; callers can bypass application code. |
| PostgreSQL RLS                             | Decide which Space rows the session may select, insert, update or delete.              | It does not validate friendly form messages.                  |
| Column grants                              | Prevent Host writes to `id`, `host_id`, `status` and timestamps.                       | They do not validate text lengths or time syntax.             |
| PostgreSQL constraints                     | Backstop required values and text lengths.                                             | They do not replace browser/server Zod feedback.              |
| Zod in browser                             | Give immediate, field-specific feedback.                                               | It is untrusted and optional.                                 |
| Zod in Server Action                       | Reject malformed or overlong input before a query.                                     | It does not establish ownership.                              |

### 4.2 Threat and failure handling

- **Forged ownership/status fields:** ignored by explicit payload construction and
  independently rejected by column grants.
- **Forged Space UUID:** validated, then owner-scoped; RLS still enforces zero rows.
- **Cross-Host direct request:** update/delete returns no row and one generic error,
  without confirming another Host's Space exists.
- **Seeker or non-owning Administrator mutation:** insert RLS requires Host;
  update/delete require a row whose `host_id` is the caller. UI routing is not relied
  upon.
- **Stored script text:** React renders name, address and description as text. No route
  uses `dangerouslySetInnerHTML`, so stored text is escaped rather than executed.
- **Double submit:** pending buttons are disabled and the client blocks a second
  submission. The database remains authoritative if two requests still race.
- **Stale edit/delete page:** a zero-row mutation returns a safe message instead of
  claiming success.
- **Network/database failure:** keep safe entered form values and show a retryable form
  error. Never clear the form or redirect on failure.
- **Missing profile/header row:** show a controlled load error or redirect rather than
  trusting user metadata. This is an account-integrity problem, not a blank identity.
- **Untrusted success query string:** only the three fixed tokens in §2.6 render.
- **Secrets:** only the publishable-key server client is used. This story never imports
  or creates a secret-key client.

### 4.3 Vitest matrix for `lib/validation/space.test.ts`

| Case                                                          | Expected                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| All five fields valid, with a normal same-day time pair       | Pass; strings are normalized as documented.               |
| Name/address/description have surrounding whitespace          | Pass; output is trimmed.                                  |
| Description is missing or empty                               | Pass as `''`; action later stores `null`.                 |
| Name or address is empty or whitespace-only                   | Fail with the required-field message.                     |
| Name is exactly 100 characters / 101 characters               | Pass / fail with the name length message.                 |
| Address is exactly 200 characters / 201 characters            | Pass / fail with the address length message.              |
| Description is exactly 2,000 characters / 2,001 characters    | Pass / fail with the description length message.          |
| `00:00`, `07:00`, `18:00` and `23:59`                         | Pass.                                                     |
| Empty opening or closing time                                 | Fail with that field's required message.                  |
| `7:00`, `24:00`, `12:60`, seconds, words or an arbitrary date | Fail with that field's valid-time message.                |
| Closing is earlier than opening                               | Pass; it means next-day closing (D-027).                  |
| Opening equals closing                                        | Pass; it means open 24 hours (D-027).                     |
| Valid UUID / malformed `spaceId`                              | Pass / fail.                                              |
| Extra keys such as `host_id` and `status`                     | Not present in parsed output and never used in a payload. |

Each new rule is watched fail once by temporarily violating the expectation before the
implementation is trusted.

### 4.4 Existing pgTAP matrix

No policy or table changes are planned, so duplicating STORY-01's 21 Space-policy tests
would add no coverage. `supabase/tests/02-spaces.sql` already proves:

| Actor and attempt                                   | Expected and existing evidence                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor lists Spaces                      | Verified Spaces only.                                                                                                                     |
| Seeker lists Spaces                                 | Verified Spaces only.                                                                                                                     |
| Seeker creates a Space                              | `42501`.                                                                                                                                  |
| Seeker updates/deletes a Host Space                 | 0 rows.                                                                                                                                   |
| Administrator lists Spaces                          | All statuses, for future moderation.                                                                                                      |
| Administrator creates a Space                       | `42501`; only Hosts create.                                                                                                               |
| Host lists Spaces                                   | Public Verified rows plus the Host's own non-Verified rows. The application additionally filters the owner portal to `host_id = user.id`. |
| Host creates a Space                                | Succeeds with caller as owner and status `pending`.                                                                                       |
| Host supplies `status` or another `host_id`         | `42501`.                                                                                                                                  |
| Host changes their own `status` or `host_id`        | `42501`.                                                                                                                                  |
| Host updates their own Verified Space               | Succeeds and remains `verified`.                                                                                                          |
| Host deletes their own Space                        | Succeeds.                                                                                                                                 |
| Another Host reads the first Host's Pending Space   | Hidden.                                                                                                                                   |
| Another Host updates/deletes the first Host's Space | 0 rows; original row remains unchanged.                                                                                                   |

`npm run db:test` is run during STORY-05's final acceptance even though no SQL changed,
because the story explicitly depends on those security criteria. If implementation
reveals a genuine missing policy case, that is a new migration and pgTAP change owned by
Adrian; the team must stop and amend this design before altering an applied migration.

### 4.5 Manual journey matrix

Use invented data and the shared `@example.test` accounts only (D-013, D-028).

| Journey                                                                              | Expected                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Sign in as `host@example.test`, open `/host`                                         | Header shows saved profile identity and Host badge; owned list or empty state renders.                              |
| Create `Timpla Study Loft`, an invented address, description and `07:00–22:00` hours | Redirects to the refreshed list; card is present and says Pending verification.                                     |
| Refresh after creation                                                               | Created Space remains.                                                                                              |
| Submit create with missing fields, overlong values and invalid time text             | Inline errors appear; focus moves to the first invalid field; safe values remain.                                   |
| Edit the Space's name, description, address and hours                                | Redirects to the list; every saved value is visible after refresh.                                                  |
| Save `18:00–02:00`                                                                   | Accepted and displayed as next-day closing.                                                                         |
| Save equal opening and closing values                                                | Accepted and displayed as Open 24 hours.                                                                            |
| Open Delete, choose Cancel                                                           | Returns to the list and Space remains.                                                                              |
| Open Delete again, submit Delete Space                                               | Redirects to the list with success status; Space is absent after refresh.                                           |
| Sign in as `host2@example.test`                                                      | The first Host's Pending Space is absent. Direct tampering is covered by pgTAP and action zero-row handling.        |
| Sign in as a Seeker and request `/host`                                              | Redirected to `/seeker`.                                                                                            |
| Locally sign in as Administrator and request `/host`                                 | Route is allowed and actual Administrator badge appears; no Host-owned rows are treated as the Administrator's own. |
| Keyboard-only create, edit, cancel and confirm-delete paths                          | Logical focus order, visible focus, no trap, and status/errors announced.                                           |
| View at 360, 768 and 1024 pixels                                                     | No horizontal scroll, overlap, clipped text or pointer-only action.                                                 |
| Disable JavaScript and submit valid/invalid forms                                    | Server validation/mutations still work; successful Server Actions use redirect responses.                           |

### 4.6 Acceptance traceability

| Requirement                                         | Planned evidence                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| FR-3.1 basic Space registration and operating hours | Create/edit manual journeys; schema tests; persisted list read. Photos, tags and seat map are explicitly deferred. |
| FR-5.1 non-Verified Space not public                | Existing anonymous/Seeker pgTAP results.                                                                           |
| SRS §3.2.2 accessibility and responsive layout      | Keyboard and 360/768/1024 manual matrix; STORY-02 primitives.                                                      |
| SRS §3.5.1 role enforcement                         | STORY-03 route-guard tests plus STORY-01 RLS/role pgTAP tests.                                                     |
| SRS §3.5.2 injection/XSS protection                 | Supabase parameterized query builder, Zod input limits, React text escaping and no raw HTML.                       |
| D-010 read/mutate architecture                      | Server Components read; one route-segment `actions.ts` mutates; no internal REST handler.                          |
| D-027 minimal Sprint 1 fields                       | Exact five editable fields; no tags, prices, preferences or weekday schedule.                                      |

### 4.7 Verification commands

Every implementation PR runs `npm run check`. The final STORY-05 acceptance pass also
runs `npm run build` and `npm run db:test`, then completes the manual matrix above. A
schema change is not expected; therefore `npm run db:reset` and `npm run db:types` are
not implementation steps unless this design is revised first.

## 5. Tasks and estimates

These rows become TSK sub-issues only after this design is merged. The estimates total
the story's planned three working days across Adrian and James; calendar time can be
shorter where independent work runs in parallel.

| Task     | What                                                                                                                                        | Owner              | Points (1–10) | Days | Depends on                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------- | ---- | ---------------------------------------------- |
| TSK-05.1 | Add `spaceSchema`, `spaceIdSchema`, types and exhaustive Vitest boundary tests                                                              | @dreeyanzz         | 2             | 0.5  | STORY-01 fields; Zod from STORY-03             |
| TSK-05.2 | Add `createSpace`, `updateSpace` and `deleteSpace` Server Actions, explicit payloads, owner scopes, safe errors, revalidation and redirects | @dreeyanzz         | 3             | 0.5  | TSK-05.1                                       |
| TSK-05.3 | Add the Host shell/header, authenticated owner read, create section container, Space cards, status badges and empty state                   | @JamesNino-Mandawe | 3             | 0.5  | STORY-02, STORY-03; can run alongside TSK-05.1 |
| TSK-05.4 | Add the shared create/edit form, edit route, client/server error presentation and wire both mutations                                       | @JamesNino-Mandawe | 4             | 1.0  | TSK-05.1, TSK-05.2, TSK-05.3                   |
| TSK-05.5 | Add the owner-scoped delete-confirmation route, wire deletion, finish responsive/keyboard QA and execute the full acceptance matrix         | @JamesNino-Mandawe | 2             | 0.5  | TSK-05.2, TSK-05.3, TSK-05.4                   |

### Task completion details

**TSK-05.1 is done when:**

- all exact §2.3 rules and messages exist in one shared schema;
- UUID validation is separate from visible fields;
- §4.3 is covered by Vitest; and
- `npm run check` passes.

**TSK-05.2 is done when:**

- all three actions authenticate independently of `proxy.ts`;
- create omits ownership/status columns;
- update/delete scope by authenticated owner and treat zero rows safely;
- no raw Supabase error crosses the server boundary;
- successful mutations revalidate before redirecting; and
- `npm run check` and the existing `npm run db:test` pass.

**TSK-05.3 is done when:**

- `/host` has a real shell and one main landmark;
- identity and role come from `profiles`, not metadata;
- the page selects only caller-owned rows and requested display columns;
- cards cover all three Verification statuses and both special time cases;
- the empty state and create-section placement are present; and
- 360/768/1024 layouts have no horizontal overflow.

**TSK-05.4 is done when:**

- create and edit reuse the same five-field component;
- client and Server Action validation agree;
- error associations, first-error focus and pending behavior work by keyboard;
- edit reads only an owned row and returns not-found otherwise;
- success returns to an immediately refreshed list; and
- valid data persists through a browser refresh.

**TSK-05.5 is done when:**

- GET is read-only and deletion requires explicit form submission;
- Cancel is non-destructive and precedes Delete in focus order;
- stale/unauthorized ids do not enumerate other Hosts' Spaces;
- the full §4.5 manual matrix is recorded in the PR; and
- `npm run check`, `npm run build` and `npm run db:test` are green.

## 6. Build order

Each task uses a fresh branch from updated `main`; no PR is stacked. TSK-05.3 may be
built in parallel with Adrian's first two tasks because it needs only merged STORY-01,
STORY-02 and STORY-03 contracts. TSK-05.4 does not start until its three dependencies
are on `main`.

| #   | Branch                           | PR title                                             | Contains |
| --- | -------------------------------- | ---------------------------------------------------- | -------- |
| 1   | `feature/STORY-05-space-schema`  | `feat(STORY-05): add the space form rules`           | TSK-05.1 |
| 2   | `feature/STORY-05-space-actions` | `feat(STORY-05): add Space CRUD actions`             | TSK-05.2 |
| 3   | `feature/STORY-05-host-portal`   | `feat(STORY-05): add the Host portal and Space list` | TSK-05.3 |
| 4   | `feature/STORY-05-space-forms`   | `feat(STORY-05): add create and edit Space forms`    | TSK-05.4 |
| 5   | `feature/STORY-05-space-delete`  | `feat(STORY-05): add confirmed Space deletion`       | TSK-05.5 |

After this design merges, the agent creates these five TSK issues as #54 sub-issues,
removes `needs-design` from #54 and gives the tasks their estimates, assignees and Sprint
1 board status. Code starts only after those tracking steps and in the order above.

## 7. Rejected alternatives

- **Create/edit/delete dialogs:** the course Sprint plan names dialogs, but STORY-02 did
  not ship a Dialog primitive. Building an accessible modal locally would duplicate
  design-system ownership and add focus trapping, escape handling and restoration risk.
  A form on `/host` plus dedicated edit/delete routes meets every acceptance criterion,
  works without JavaScript and gives confirmation its own unambiguous page.
- **Browser `window.confirm()` for deletion:** it is difficult to style or test, gives
  inconsistent accessibility across browsers and requires client JavaScript. The
  dedicated confirmation page is explicit and progressively enhanced.
- **A REST route for CRUD:** internal form mutations belong in Server Actions (D-010).
  No outside system calls these operations.
- **A service-role/secret-key client:** it would bypass RLS, which is the security
  boundary (D-007). The caller's publishable-key session is required.
- **Trusting `proxy.ts` or a hidden `host_id`:** proxy only routes, and hidden fields are
  user-controlled. The action authenticates and the database supplies/enforces owner
  identity.
- **One action with an `intent` string for create/update/delete:** it makes accepted
  inputs and failure states less explicit. Three named actions are easier to type,
  review and authorize.
- **Client-side Supabase reads and optimistic list updates:** they duplicate the server
  source of truth and can briefly claim success before RLS accepts a write. Server reads
  plus revalidation are sufficient at Sprint 1 scale.
- **A soft-delete column:** the existing table has no such state, and changing it needs
  a migration, RLS decisions and later filtering. The story explicitly asks to delete.
- **Resetting edited Verified Spaces to Pending:** there is no Administrator queue in
  Sprint 1; D-027 says they remain Verified until STORY-14 revisits the rule.
- **Weekday-specific schedules:** D-027 selects one daily opening and closing time.
- **A single rich-text description:** no requirement needs formatting, and accepting
  HTML increases the XSS surface. Description remains plain text.
- **Adding Textarea, Dialog or Toast to `components/ui`:** another story owns that
  shared surface. A styled native textarea and existing Alert are enough.
- **Duplicating pgTAP cases in a new STORY-05 SQL file:** the table and policies do not
  change, and STORY-01 already tests the exact negative cases. Redundant policy tests
  would make maintenance noisier without observing a new behavior.
- **Pagination and client sorting:** Sprint 1 test data is small, and neither is an
  acceptance criterion. The deterministic server order is sufficient.

## 8. Open questions

None. The story's apparent choices are already settled:

- fields and time meaning by D-027 and STORY-01;
- reads versus mutations by D-010;
- RLS as the security boundary by D-007;
- route access for Administrators by D-032;
- available primitives and light-mode token use by D-031; and
- the owner split by the Sprint 1 brief.

If implementation discovers that an existing grant, policy or settled field cannot
support these flows, work stops. The team opens a design correction (and a
`decision-needed` issue if alternatives affect later stories) before adding a migration
or changing the approach.

## 9. After the build

Fill this section when the last task is complete:

- differences between the implemented flow and this plan, with reasons and PR numbers;
- the status line changed to `implemented YYYY-MM-DD`;
- every document made stale by the implementation;
- who verified each #54 acceptance criterion and how;
- the final `npm run check`, `npm run build` and `npm run db:test` results; and
- the completed manual accessibility and responsive evidence.
