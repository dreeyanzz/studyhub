# Planning a story

From a STORY issue to Done. The rule behind it: no code for a story until its design doc
is merged (D-016).

## 1. The story issue

All feature work belongs to a STORY-xx issue, created with the Story issue form. It
contains:

- the narrative: "As a …, I want …, so that …"
- FR IDs
- MoSCoW
- points and an estimate
- an owner
- unticked acceptance criteria

Maria keeps it on the board.

## 2. The design doc

The story owner writes `docs/design/STORY-xx-short-desc.md` from
[`docs/design/TEMPLATE.md`](../design/TEMPLATE.md):

- **Branch:** `feature/STORY-xx-design`
- **PR title:** `docs(STORY-xx): design <short description>`

What goes in it:

- **Keep Sprint 1 docs to one or two pages.** The test: could someone who has never seen the code predict what it does?
- **Name the negative tests.** The wrong user gets 0 rows; the owner's forbidden writes are rejected.
- **If you choose between real alternatives**, add a [DECISIONS](../DECISIONS.md) entry in the same PR.
- **If something unclear blocks you**, open a Decision issue instead of guessing.

Adrian merging the design PR is the approval. After that, remove the `needs-design`
label from the story.

## 3. Tasks

Each row of the design's §5 becomes a TSK sub-issue, created with the Task form. Each one has:

- a title like `TSK-xx.N: …`
- the parent story
- a "done when" list
- points (1–10) and days
- an assignee

Add each one to the story as a sub-issue: on the story's page, use "Create sub-issue" or
"Add existing issue". An agent does the same from the command line with the
[board guide's commands](board-guide.md#commands-for-agents).

**Sizing:**

- **Points** measure relative size, complexity and risk on a 1–10 scale.
- **Days** are working days.
- A task bigger than 5 points or 2 days is usually two tasks.

## 4. Branches and pull requests

Follow the design's §6 build order:

- One PR per row, each from its own `feature/STORY-xx-short-desc` branch.
- Every PR targets `main`.
- A PR closes its task with `Closes #…` and mentions the story with `Refs #…`.

## 5. Acceptance and Done

Only the person who checked an acceptance criterion ticks it, and the PR says who
checked it and how.

When the last task merges:

1. Fill in the design doc's §9 (what changed from the plan).
2. Set its status to `implemented`.
3. Close the story.

## Writing acceptance criteria

- **Good:** observable and checkable. "Another host gets 0 rows when updating this space."
- **Bad:** "Security works."

Each criterion should be something a teammate can verify in a few minutes, with a seeded
account or a test.

## MoSCoW

| Priority                 | Meaning                                       |
| ------------------------ | --------------------------------------------- |
| Must                     | The story fails without it                    |
| Should                   | Important, but the sprint survives without it |
| Could                    | Nice to have                                  |
| Won't have (this sprint) | Agreed: not now                               |
