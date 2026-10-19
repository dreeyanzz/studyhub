# STORY-xx: title

**Status:** draft · **Owner:** @handle · **Story:** #NN · **FR:** FR-x.y ·
**Depends on:** STORY-xx · **Flows:** [name](../flows/name.md) · **Decisions:** D-NNN

Copy this file to `docs/design/STORY-xx-short-desc.md`. Delete these instructions and
any section that genuinely does not apply, and say why.

## 0. Scope

**In:** what this story delivers.

**Out:** what it deliberately leaves to other stories.

## 1. Flow

**Shared flows** (D-044): link each flow in [`docs/flows/`](../flows/README.md) that this
story uses, and say which of its arrows or steps this story builds. Don't draw a shared
flow again here, and never change one: that is a pull request to the flow doc.

**This story's own part:** a sequence diagram of its main path, across every layer
involved.

```mermaid
sequenceDiagram
    autonumber
    actor U as Seeker
    participant B as Browser
    participant A as Server Action
    participant DB as Postgres (RLS)
    U->>B: does something
    B->>A: calls the action with input validated by Zod
    A->>DB: query or mutation, governed by RLS
    DB-->>A: only the rows this user may see
    A-->>B: result, then revalidate
```

## 2. Data and state

- **Tables and columns** (new or changed), with types, constraints and defaults. Use
  [GLOSSARY](../GLOSSARY.md) names.
- **Enums.**
- **State transitions** this story adds. Link the ones a shared flow already draws
  instead of copying them:

  | From | Event | To  | Precondition | Who |
  | ---- | ----- | --- | ------------ | --- |
  |      |       |     |              |     |

- **Zod schemas** in `lib/validation/`: fields and rules, shared by browser and server.
- **RLS policies and GRANTs:** one line per table, role and verb.

## 3. UI and files

- **User experience** (Maria decides, D-042): each screen and the order of steps, the
  wording, and the empty, loading and error states. Unless Maria wrote this doc, Maria
  approves this section and the user's steps in §1.
- **Routes and components.** Mark each as a Server Component or a Client Component.
- **Where the files go:**

  ```
  app/(dashboard)/…
  lib/…
  ```

- **Accessibility:** 48×48 px targets, a keyboard-only path, visible focus, 4.5:1
  contrast, no horizontal scrolling at 360/768/1024 px, and a list view for anything
  shown on a map.

## 4. Security and test matrix

| Layer  | Case                                               | Expected            |
| ------ | -------------------------------------------------- | ------------------- |
| pgTAP  | The right user does the action                     | Succeeds            |
| pgTAP  | A different user tries it                          | 0 rows, or rejected |
| pgTAP  | The owner makes a forbidden write to their own row | Rejected            |
| Vitest | Pure logic and Zod rules                           |                     |
| Manual | The journey, as a seeded user                      |                     |

## 5. Tasks and estimates

These rows become the story's TSK sub-issues once this doc is merged.

| Task     | What | Owner | Points (1–10) | Days | Depends on |
| -------- | ---- | ----- | ------------- | ---- | ---------- |
| TSK-xx.1 |      |       |               |      |            |

## 6. Build order

One PR per row, and every PR targets `main`.

| #   | Branch               | PR title            | Contains |
| --- | -------------------- | ------------------- | -------- |
| 1   | `feature/STORY-xx-…` | `feat(STORY-xx): …` |          |

## 7. Rejected alternatives

- **An option you considered:** why it was not chosen. If another story builds on the
  choice, it is costly to reverse once data exists, or a reasonable teammate would have
  chosen differently, add it to [DECISIONS](../DECISIONS.md) too (D-044).

## 8. Open questions

- #NN (`decision-needed`): the question, and what depends on it.

## 9. After the build

Fill this in when the story is done:

- what turned out different from this plan, and why
- the status line changed to `implemented YYYY-MM-DD`
- the docs this story changed
- who verified each acceptance criterion
