# STORY-02: Accessible design system and public shell

**Status:** draft · **Owner:** @fayeye-09 · **Story:** [#51](https://github.com/dreeyanzz/studyhub/issues/51)
**Source:** SRS §3.2.2, §3.7.1 · **Depends on:** none · **Decisions:** D-002, D-010, D-016, D-026

## 0. Scope

**In:** Tailwind 4 semantic tokens; shadcn/ui Button, Input, Label, Card, Badge and Alert; Worq landing page, public header and footer. Deliver the shared components first so STORY-03, 04 and 05 can use them.

**Out:** authentication, dashboards, database access, search/filter behavior, maps, availability and holds. Describe future discovery and reserve-now features as coming in Sprint 2/3; do not display invented live inventory or functional-looking search controls.

## 1. Flow

Visitor requests `/` → Next.js renders the public layout and landing page → browser displays static content → visitor follows section links or the Log in / Sign up links (`/login`, `/register`, supplied by STORY-03). Until those routes land, authentication is a known integration dependency, not a completed journey. No Server Action, API or database participates; a cross-layer sequence diagram is unnecessary here (D-010).

## 2. Data and state

No tables, enums, policies, GRANTs, Zod schemas or persistent state. No session is read. Keep the navigation visible and allow it to wrap on small screens, avoiding menu state. Native focus, hover, disabled and invalid states belong to the primitives.

## 3. UI and files

Proposed visual direction carries forward the existing local draft: forest green, warm cream and sage, Georgia headings with the existing Geist body font. Light mode is the supported public presentation; no theme switch in this story. Use a 4 px spacing scale, 16 px card corners and 10 px control corners.

| Token pair  | Foreground | Background            |
| ----------- | ---------- | --------------------- |
| Body / card | `#173c2d`  | `#f8f9f3` / `#ffffff` |
| Primary     | `#ffffff`  | `#215c3f`             |
| Secondary   | `#244832`  | `#e5eddc`             |
| Muted       | `#536356`  | `#eef1e8`             |
| Accent      | `#244832`  | `#ddebcc`             |
| Destructive | `#ffffff`  | `#ad2929`             |

These are proposed pairs, not completed accessibility evidence. Verify every rendered text pair, including hover and error states, at ≥4.5:1. Input boundaries and focus indicators must be distinguishable at ≥3:1 against adjacent colors; use an opaque green focus ring with an offset.

| Files                                                     | Responsibility / rendering                                                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/globals.css`                                         | Semantic colors and typography through existing `@theme inline` mappings; control sizing and visible focus                                                                          |
| `components/ui/{button,input,label,card,badge,alert}.tsx` | Generate using the existing shadcn `base-nova` configuration; keep the generated Base UI composition API. Retain Client Component boundaries where required by generated primitives |
| `components.json`, `package.json`, `package-lock.json`    | Change only if the component generator requires it; preserve configured style and pinned dependency versions                                                                        |
| `app/(public)/layout.tsx`                                 | Server Component: public header, skip link, children and footer                                                                                                                     |
| `components/public/site-header.tsx`, `site-footer.tsx`    | Server Components: Worq branding, section navigation and auth links                                                                                                                 |
| `app/(public)/page.tsx`                                   | Server Component: hero, how-it-works section and Seeker/Host benefits; replaces `app/page.tsx` without changing `/`                                                                 |

Keep `app/layout.tsx` as the shared root. Header section links use `/#how-it-works` and `/#for-hosts`. The skip link targets a focusable `main` landmark. Use one h1, ordered headings, semantic links for navigation and buttons for actions. All interactive targets are ≥48×48 px, including icon controls and footer links. Static cards and badges are not tab stops. Inputs have associated labels; errors use `aria-invalid` and `aria-describedby`. Status is conveyed in words; dynamic urgent alerts use appropriate announcement semantics. Respect reduced motion. No external imagery is required for this first public shell.

## 4. Security and test matrix

| Layer    | Case                                                                              | Expected                                                                                       |
| -------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Checks   | `npm run check`                                                                   | Typecheck, lint, formatting and existing unit tests pass                                       |
| Manual   | 360, 768 and 1024 px; enlarged text                                               | No horizontal overflow, clipping or hidden controls                                            |
| Manual   | Tab / Shift+Tab, Enter on links, Space on buttons, skip link                      | Logical order, visible focus, correct native activation and main focus                         |
| Manual   | Every rendered text/state pair and control rectangle                              | ≥4.5:1 text contrast; ≥48×48 px targets; record measured results                               |
| Manual   | Temporary local primitive fixture: label, error, disabled, alert and focus states | Accessible names/descriptions and expected keyboard behavior; fixture not shipped              |
| Security | Anonymous visitor and signed-in visitor                                           | Same static content; no credentials, private data or database requests                         |
| Database | Wrong-user reads and owner's forbidden writes                                     | Not applicable: this story exposes no reads or writes; policy tests belong to database stories |

Do not add unit tests that only mirror static markup. Record browser, viewport and keyboard evidence during implementation; never carry over results from the old checkout.

## 5. Tasks and estimates

Create sub-issues only after this design is merged. Total: 5 points / 2 days.

| Task     | What                                                                      | Owner      | Points | Days | Depends on      |
| -------- | ------------------------------------------------------------------------- | ---------- | ------ | ---- | --------------- |
| TSK-02.1 | Tokens, six primitives and accessibility checks                           | @fayeye-09 | 3      | 1    | Design merged   |
| TSK-02.2 | Public layout, landing page, header/footer and responsive/keyboard checks | @fayeye-09 | 2      | 1    | TSK-02.1 merged |

## 6. Build order

Each branch starts from current `main`; each PR targets `main`.

| #   | Branch                            | PR title                                        | Contains |
| --- | --------------------------------- | ----------------------------------------------- | -------- |
| 1   | `feature/STORY-02-ui-foundations` | `feat(STORY-02): add accessible ui foundations` | TSK-02.1 |
| 2   | `feature/STORY-02-public-shell`   | `feat(STORY-02): add responsive public shell`   | TSK-02.2 |

## 7. Rejected alternatives

Per-page colors duplicate tokens and make contrast corrections inconsistent. A custom mobile menu adds client state without a navigation need. Fake searchable inventory would imply functionality owned by later stories. These are local implementation choices, not changes to existing architecture decisions.

## 8. Open questions

The owner and Adrian should review the proposed palette, typography and static landing scope with this draft. No blocking database dependency. Authentication destinations must be rechecked when STORY-03 merges.

## 9. After the build

Pending implementation: record deviations, changed docs and who verified each acceptance criterion, then set the status to `implemented YYYY-MM-DD`. No implementation or acceptance checks are claimed by this draft.
