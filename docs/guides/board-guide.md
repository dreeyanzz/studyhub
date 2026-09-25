# Board guide

This guide is for Maria, who maintains the board, and for anyone who moves a card. The
board is the GitHub Project "StudyHub", linked to this repository. Its layout is a course
requirement (D-022).

## Columns (Status)

Exactly these five, in this order. The course checks them.

| Status           | Means                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Product Backlog  | Stories and tasks for later sprints                                                                                       |
| Sprint 1 Backlog | Planned for the current sprint, not started. Rename it "Sprint 2 Backlog", then "Sprint 3 Backlog", as each sprint starts |
| In Progress      | Someone is working on it on a feature branch                                                                              |
| Code Review      | Its pull request is open and waiting for review                                                                           |
| Done             | Merged and verified; the issue is closed                                                                                  |

## Fields

| Field           | Values                                              |
| --------------- | --------------------------------------------------- |
| Status          | The five columns above                              |
| Sprint          | Iteration: Sprint 1, 2 and 3, two weeks each        |
| Points          | 1–10                                                |
| Estimate (days) | Working days                                        |
| MoSCoW          | Must, Should, Could, Won't                          |
| Parent issue    | The STORY that a task belongs to (a built-in field) |

The issue forms apply `type:story` and `type:task` automatically. Add the `moscow:*` and
`area:*` labels by hand to match the dropdown answers in the issue body, and set the
sprint milestone.

## Views

- **Story board:** a board by Status, filtered to `label:"type:story"`. Use this view for
  the course screenshot.
- **Task board:** a board by Status, filtered to `label:"type:task"`, with column limits
  of 4 for In Progress and 4 for Code Review.
- **Table:** grouped by parent issue, showing Points, Estimate, MoSCoW, Assignees and
  Sprint.
- **One view per sprint**, filtered by Sprint.

## Automation

The board's built-in workflows:

- New issues and pull requests are added to Product Backlog.
- Closing an issue or merging its pull request moves it to Done.
- Reopening moves it back to In Progress.

## Who moves cards

| Move              | Who                                  | When                                   |
| ----------------- | ------------------------------------ | -------------------------------------- |
| To Sprint Backlog | Adrian and Maria, at sprint planning | When stories and tasks are chosen      |
| To Sprint Backlog | The assignee's agent                 | When it creates tasks from a design    |
| To In Progress    | The assignee                         | When they create the branch            |
| To Code Review    | The author                           | When they open the pull request        |
| To Done           | Automatic                            | When the PR merges or the issue closes |

WIP limits: at most 4 cards In Progress and 4 in Code Review, team-wide. If a column is
full, finish or review something before starting more.

## Weekly check (Maria)

- Every open task has an assignee, points and an estimate.
- Nothing is in In Progress without a branch, and nothing is in Code Review without a
  pull request.
- Stories whose design doc has merged no longer have `needs-design`, and they have their
  TSK sub-issues.
- Blocked items have the `blocked` label and a comment saying what they are waiting on.

## Sprint rollover

At the end of a sprint:

1. Move unfinished items to the next sprint's backlog, or back to Product Backlog.
2. Rename the "Sprint N Backlog" column.
3. Close the sprint's milestone.
4. Take the board screenshot for the sprint review.

## Commands for agents

An agent working through the [story loop](../../AGENTS.md#the-story-loop) keeps its
human's cards current with these commands. Editing the board needs the `project` scope
on the GitHub CLI login. If a command says the scope is missing, the human runs
`gh auth refresh -s project` themselves (it opens a browser).

**Create a task from a design's §5 and attach it to its story.** The body repeats the
task form's headings.

```bash
gh issue create --title "TSK-03.1: add the auth form rules" \
  --label type:task --label area:auth --milestone "Sprint 1 (Midterm)" --assignee @me \
  --body $'### Parent story\n\n#52\n\n### What\n\n…\n\n### Done when\n\n- [ ] …\n\n### Story points (1–10)\n\n2\n\n### Estimate (working days)\n\n0.5\n\n### Area\n\nauth'
gh api repos/dreeyanzz/studyhub/issues/52/sub_issues \
  -F sub_issue_id="$(gh api repos/dreeyanzz/studyhub/issues/<task number> --jq .id)"
```

**Find an issue's card.** New issues land in Product Backlog on their own.

```bash
gh project item-list 4 --owner dreeyanzz --limit 200 --format json \
  --jq '.items[] | select(.content.number == <issue number>) | .id'
```

**Set a card's fields.** Every edit takes
`gh project item-edit --project-id PVT_kwHOCUJgA84Bjmvk --id <card id>`, plus one of:

| Field           | Flags                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Status          | `--field-id PVTSSF_lAHOCUJgA84BjmvkzhiabXo --single-select-option-id <id>` |
| Points          | `--field-id PVTF_lAHOCUJgA84BjmvkzhiabcA --number <1–10>`                  |
| Estimate (days) | `--field-id PVTF_lAHOCUJgA84BjmvkzhiabcE --number <days>`                  |
| MoSCoW          | `--field-id PVTSSF_lAHOCUJgA84BjmvkzhiabdA --single-select-option-id <id>` |
| Sprint          | `--field-id PVTIF_lAHOCUJgA84BjmvkzhiabdE --iteration-id <id>`             |

| Option                                                                        | Id                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Status: Product Backlog · Sprint 1 Backlog · In Progress · Code Review · Done | `4e0171a5` · `84205269` · `a939e066` · `cb631dc3` · `29f6bcd9` |
| MoSCoW: Must · Should · Could · Won't                                         | `3eed1178` · `8fda412d` · `cb02434e` · `45aa925b`              |
| Sprint: Sprint 1 · Sprint 2 · Sprint 3                                        | `ab8798f2` · `4cfb2471` · `4573e4ab`                           |

A new task goes to Sprint 1 Backlog with its points, estimate and sprint set. After
that, the card moves with the work, as the table in "Who moves cards" says. Never move
another person's cards.

**Changing sprint dates.** Editing the Sprint field's dates gives every sprint a new id
and clears the sprint from every card. Before changing them, save each card's sprint.
Afterwards, set it again on every card, and update the ids above.

## The course screenshot

Open the Story board view, check that all five columns are visible, and capture the
whole board. Submit it the way the course asks.
