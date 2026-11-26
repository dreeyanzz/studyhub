# Design docs

**No code for a story until its design doc is merged** (D-016), and **no design doc until
the shared flows it uses are merged** (D-044). Adrian's merge is the approval, after
Maria's for a story with screens (D-042). Fixes, chores and docs-only changes don't need
a design doc.

## Who writes it, and when

**Writing it:**

- The story owner writes it once every shared flow the story uses is merged. The
  [flows index](../flows/README.md) lists them.
- Its §1 links each of those flows and draws only this story's part. It never changes a
  shared flow: that is a pull request to the flow doc.
- Branch: `feature/STORY-xx-design`.
- Pull request title: `docs(STORY-xx): design <short description>`.
- Reviewers: Adrian, plus Maria if the story has screens. Maria approves the user's steps
  in §1 and the UI in §3 (D-042).
- **Sprint 3's feature stories** (STORY-13, STORY-14, STORY-16, STORY-20) work
  differently (D-073, D-075). Adrian writes the design, Luke adds its screens section as
  his own commits on the same branch and approves it, and Maria's approval isn't needed:
  Maria and James review those screens once they're built.
- Start from [`TEMPLATE.md`](TEMPLATE.md).
- Keep it as short as the story allows.

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
- **A change to a shared flow:** a PR to its flow doc in [`../flows/`](../flows/README.md), never an edit inside a design (D-044).

## Index

| Story    | Design doc                                                                 | Status                                                              |
| -------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| STORY-01 | [STORY-01-database-rls.md](STORY-01-database-rls.md)                       | implemented 2026-09-26                                              |
| STORY-02 | [STORY-02-design-system.md](STORY-02-design-system.md)                     | implemented 2026-09-28; follow-up (TSK-02.3) implemented 2026-10-04 |
| STORY-03 | [STORY-03-auth-rbac.md](STORY-03-auth-rbac.md)                             | implemented 2026-09-28                                              |
| STORY-04 | [STORY-04-seeker-profile-crud.md](STORY-04-seeker-profile-crud.md)         | implemented 2026-09-30                                              |
| STORY-05 | [STORY-05-host-space-crud.md](STORY-05-host-space-crud.md)                 | implemented 2026-09-30                                              |
| STORY-06 | [STORY-06-testing-qa.md](STORY-06-testing-qa.md)                           | implemented 2026-10-04                                              |
| STORY-07 | [STORY-07-seat-map-builder.md](STORY-07-seat-map-builder.md)               | implemented 2026-11-09                                              |
| STORY-08 | [STORY-08-geo-discovery.md](STORY-08-geo-discovery.md)                     | implemented 2026-11-13                                              |
| STORY-09 | [STORY-09-reserve-now-holds.md](STORY-09-reserve-now-holds.md)             | implemented 2026-11-14                                              |
| STORY-10 | [STORY-10-check-in-release.md](STORY-10-check-in-release.md)               | implemented 2026-11-15                                              |
| STORY-11 | [STORY-11-space-profile.md](STORY-11-space-profile.md)                     | implemented 2026-11-14                                              |
| STORY-12 | [STORY-12-host-occupancy.md](STORY-12-host-occupancy.md)                   | implemented 2026-11-10                                              |
| STORY-13 | [STORY-13-reviews.md](STORY-13-reviews.md)                                 | implemented 2026-11-24                                              |
| STORY-14 | [STORY-14-admin-console.md](STORY-14-admin-console.md)                     | implemented 2026-11-26                                              |
| STORY-15 | [STORY-15-space-verification.md](STORY-15-space-verification.md)           | implemented 2026-11-09                                              |
| STORY-16 | [STORY-16-reservation-history.md](STORY-16-reservation-history.md)         | approved 2026-11-22                                                 |
| STORY-17 | [STORY-17-ui-ux-refresh.md](STORY-17-ui-ux-refresh.md)                     | approved 2026-11-23                                                 |
| STORY-19 | [STORY-19-final-hardening.md](STORY-19-final-hardening.md)                 | approved 2026-11-22                                                 |
| STORY-20 | [STORY-20-verification-follow-ups.md](STORY-20-verification-follow-ups.md) | approved 2026-11-25                                                 |
| STORY-21 | [STORY-21-google-oauth.md](STORY-21-google-oauth.md)                       | implemented 2026-11-24                                              |

STORY-00 (repository foundation) is docs and tooling only, so it has no design doc.
