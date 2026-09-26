# STORY-04: Seeker portal and profile

**Status:** approved 2026-09-27 · **Owner:** @JamesNino-Mandawe · **Story:** #53 · **FR:** SRS §3.5.1, §3.8 ·
**Depends on:** STORY-01, STORY-02, STORY-03 · **Decisions:** D-007, D-010, D-013, D-016, D-019, D-027, D-028, D-031

## 0. Scope

**In:**

- Seeker portal layout (`app/(dashboard)/seeker/layout.tsx`): a header with the Seeker's full name, a `Seeker` role badge, and a Log out button that calls STORY-03's `signOut` Server Action.
- Profile form (`app/(dashboard)/seeker/page.tsx`): pre-filled with the Seeker's own profile, editing `full_name` (1–100 characters) and `phone_number` (up to 20 characters).
- Server Action (`app/(dashboard)/seeker/actions.ts`): `updateProfile()` validates the input and updates the Seeker's own `profiles` row through the Supabase client.
- Zod schema (`lib/validation/profile.ts`), run in the browser and again on the server, with its Vitest tests next to it.
- Placeholder cards saying that search arrives in Sprint 2 and reservations in Sprint 3.

**Out:**

- Study preferences, avatars and tags (STORY-08, D-027).
- `/login`, `/register`, the route guard and `signOut` (STORY-03).
- Host spaces (STORY-05).
- Tables, policies and grants: `profiles` and its rules already exist (STORY-01).

## 1. Flow

```mermaid
sequenceDiagram
    autonumber
    actor U as Seeker
    participant B as Browser
    participant P as /seeker page (Server Component)
    participant A as updateProfile (Server Action)
    participant DB as Postgres (RLS)
    U->>B: opens /seeker (proxy.ts has already checked the role, STORY-03)
    B->>P: request
    P->>DB: select full_name, phone_number, role from profiles where id = user.id
    DB-->>P: the Seeker's own row only
    P-->>B: header, profile form, placeholder cards
    U->>B: edits the name or phone number, presses Save
    B->>B: profileSchema (Zod) checks the input; errors show inline
    B->>A: submits the form
    A->>A: profileSchema checks the input again
    alt invalid
        A-->>B: field errors
    else valid
        A->>DB: update profiles set full_name, phone_number where id = user.id
        DB-->>A: 1 row updated (RLS: own row; grants: these two columns only)
        A-->>B: revalidatePath('/seeker') and a success message
    end
    U->>B: refreshes the page
    B->>P: request
    P->>DB: select the row again
    DB-->>P: the saved values
```

## 2. Data and state

- **Tables and columns:** none new. The action updates `public.profiles.full_name` and `phone_number`. `id` and `role` cannot be changed by the user: STORY-01 grants `update` on those two columns only, so a change to `id` or `role` fails with `42501` (D-027).
- **Zod schema in `lib/validation/profile.ts`:**
  - `full_name`: string, trimmed, 1–100 characters (`"Full name is required"`, `"Full name must be 100 characters or fewer"`).
  - `phone_number`: optional string, trimmed, up to 20 characters, matching `/^[0-9+\-\s()]*$/` (`"Invalid phone number format"`). An empty value is saved as `null`.
- **RLS policies and GRANTs:** unchanged from STORY-01. A Seeker selects and updates only their own `profiles` row.

## 3. UI and files

```
app/(dashboard)/seeker/
  layout.tsx                    Server Component: portal shell with the header
  page.tsx                      Server Component: reads the profile, renders the form and cards
  actions.ts                    Server Action: updateProfile()
  _components/
    seeker-header.tsx           Server Component: name, Seeker badge, Log out (STORY-03's signOut)
    profile-form.tsx            Client Component: form state, inline errors, result message
    preview-cards.tsx           Server Component: Sprint 2 and Sprint 3 placeholder cards
lib/validation/
  profile.ts                    Zod schema
  profile.test.ts               Vitest tests
```

**Accessibility:** built from STORY-02's `Button`, `Input`, `Label`, `Card`, `Badge` and `Alert`, which already meet the 48×48 px targets and have opaque focus rings (D-031). Each input has a `Label`; errors use `aria-invalid` and `aria-describedby`. A save error uses `Alert` with `role="alert"`; the success message uses `Alert` with `role="status"`. Placeholder cards are not links or tab stops. No horizontal scrolling at 360, 768 and 1024 px, and the whole form works by keyboard.

## 4. Security and test matrix

| Layer  | Case                                                         | Expected                                                   |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Vitest | Valid `full_name` and `phone_number`                         | Passes                                                     |
| Vitest | Empty or whitespace-only `full_name`, or over 100 characters | Fails with the matching message                            |
| Vitest | `phone_number` over 20 characters or with letters or symbols | Fails with `"Invalid phone number format"`                 |
| Vitest | Empty `phone_number`                                         | Passes, and becomes `null`                                 |
| pgTAP  | A Seeker reads their own profile                             | 1 row (already in `supabase/tests/01-profiles.sql`)        |
| pgTAP  | A Seeker reads or updates another user's profile             | 0 rows; 0 rows affected, row unchanged (already in 01)     |
| pgTAP  | A Seeker changes their own `role` or `id`                    | `42501` (already in 01)                                    |
| Manual | `seeker@example.test` edits the profile, then refreshes      | The new values are still there                             |
| Manual | 360, 768 and 1024 px; keyboard only                          | No sideways scrolling; every control reachable, focus seen |

This story adds no table or policy, so it adds no pgTAP tests: STORY-01's tests already cover the wrong user and the forbidden writes.

## 5. Tasks and estimates

| Task     | What                                                                | Owner              | Points (1–10) | Days | Depends on         |
| -------- | ------------------------------------------------------------------- | ------------------ | ------------- | ---- | ------------------ |
| TSK-04.1 | `lib/validation/profile.ts` and its Vitest tests                    | @JamesNino-Mandawe | 2             | 0.5  | TSK-03.1 (Zod)     |
| TSK-04.2 | Seeker portal layout and header                                     | @JamesNino-Mandawe | 3             | 0.5  | STORY-02, TSK-03.4 |
| TSK-04.3 | Profile page and form, showing the saved profile                    | @JamesNino-Mandawe | 3             | 0.5  | TSK-04.1, TSK-04.2 |
| TSK-04.4 | `updateProfile` Server Action wired to the form                     | @JamesNino-Mandawe | 3             | 0.5  | TSK-04.3           |
| TSK-04.5 | Sprint 2 and Sprint 3 placeholder cards, and the accessibility pass | @JamesNino-Mandawe | 2             | 0.5  | TSK-04.3           |

TSK-04.2 depends on TSK-03.4 because the portal needs a signed-in Seeker and STORY-03's `signOut`.

## 6. Build order

One PR per row, each from its own branch, and every PR targets `main`.

| #   | Branch                            | PR title                                          | Contains |
| --- | --------------------------------- | ------------------------------------------------- | -------- |
| 1   | `feature/STORY-04-profile-schema` | `feat(STORY-04): add the profile form rules`      | TSK-04.1 |
| 2   | `feature/STORY-04-seeker-layout`  | `feat(STORY-04): add the seeker portal layout`    | TSK-04.2 |
| 3   | `feature/STORY-04-profile-form`   | `feat(STORY-04): add the profile form`            | TSK-04.3 |
| 4   | `feature/STORY-04-profile-save`   | `feat(STORY-04): save profile edits`              | TSK-04.4 |
| 5   | `feature/STORY-04-preview-cards`  | `feat(STORY-04): add the sprint 2 and 3 previews` | TSK-04.5 |

## 7. Rejected alternatives

- **Study preferences in Sprint 1:** they need curated tags, which arrive with STORY-08 (D-027).
- **Avatar uploads in Sprint 1:** no requirement asks for them, and they need Supabase Storage.
- **A REST endpoint for profile updates:** Server Actions mutate (D-010).
- **Toast notifications:** STORY-02 ships `Alert`, not a toast, and adding one would build part of STORY-02's design system here.

## 8. Open questions

None. The fields and rules are settled by D-027 and STORY-01. Zod arrives with STORY-03's TSK-03.1, and sign-out with TSK-03.4.

## 9. After the build

To be filled in when STORY-04 is done.
