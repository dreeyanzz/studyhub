# Design docs

**No code for a story until its design doc is merged** (D-016). Adrian's merge is the
approval. Fixes, chores and docs-only changes are exempt.

## Who writes it, and when

**Writing it:**

- The story owner writes it at the start of the story.
- Branch: `feature/STORY-xx-design`.
- Pull request title: `docs(STORY-xx): design <short description>`.
- Start from [`TEMPLATE.md`](TEMPLATE.md).
- Keep Sprint 1 docs to one or two pages.

**Once it is merged:**

- Each row of its §5 becomes a TSK sub-issue of the story.
- The `needs-design` label comes off the story.
- Code PRs link the doc.

## Naming

`STORY-xx-short-desc.md`, using the same short description as the story's branches.

## Status line

- `draft`
- `approved YYYY-MM-DD` (set in the PR that merges it)
- `implemented YYYY-MM-DD`
- `superseded by STORY-xx`

## The test

> Could someone who has never opened the code read this document and predict what the
> code does?

If yes, it is enough, whatever sections it has. If no, it is incomplete, however many
sections it has. Every doc must still name its negative tests: what the wrong user gets,
and what the right user is prevented from doing to their own rows.

## Changing a design after approval

- **A small correction found while building:** edit the doc in the same PR as the code, and record it in §9.
- **A change of approach:** a new PR to the design doc, approved like the first one.

## Index

| Story    | Design doc                                           | Status                 |
| -------- | ---------------------------------------------------- | ---------------------- |
| STORY-01 | [STORY-01-database-rls.md](STORY-01-database-rls.md) | implemented 2026-09-26 |
| STORY-02 |                                                      | not written            |
| STORY-03 | [STORY-03-auth-rbac.md](STORY-03-auth-rbac.md)       | draft                  |
| STORY-04 |                                                      | not written            |
| STORY-05 |                                                      | not written            |
| STORY-06 |                                                      | not written            |
| STORY-07 |                                                      | not written            |
| STORY-08 |                                                      | not written            |
| STORY-09 |                                                      | not written            |
| STORY-10 |                                                      | not written            |
| STORY-11 |                                                      | not written            |
| STORY-12 |                                                      | not written            |
| STORY-13 |                                                      | not written            |
| STORY-14 |                                                      | not written            |

STORY-00 (repository foundation) is docs and tooling only, so it has no design doc.
