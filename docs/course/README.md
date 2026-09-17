# Course deliverables

These are the documents submitted for CPEPE361. The `.md` files are the source, and the
`.docx` files are generated from them (D-021). Never edit a `.docx` by hand.

| File                                               | What it is                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `StudyHub_SRS.md` / `.docx`                        | Software Requirements Specification v2.0: the requirements baseline (FR-x.y)                  |
| `StudyHub_Project_Planning_Worksheet.md` / `.docx` | Project Planning Worksheet v2.0                                                               |
| `StudyHub_Sprint_1_Plan.md` / `.docx`              | Sprint 1 plan: backlog, stories, tasks, estimates. Its `.docx` is created on the first export |
| `StudyHub_Sprint_2_Plan_DRAFT.md`                  | Sprint 2 plan, **draft**: tentative until the Sprint 1 review. Not for submission             |
| `StudyHub_Sprint_3_Plan_DRAFT.md`                  | Sprint 3 plan, **draft**: tentative until the Sprint 2 review. Not for submission             |
| `StudyHub_Project_Management_Board.html` / `.svg`  | The board snapshot for the Sprint 1 submission                                                |
| `diagrams/`                                        | The figures used by the SRS                                                                   |
| `archive/`                                         | The v1 originals, kept for audit                                                              |

## Drafts

A file ending in `_DRAFT.md` is a proposal, not a baseline. It moves no card, creates no
issue and starts no code; its §0 says what has to be true before it becomes real, and its
last section says what the pull request that baselines it does. `npm run docs:docx` still
exports a `.docx` for it, so check the filename before putting anything in a submission.

## Changing a deliverable

Edit the `.md` in a pull request, like any other change. The SRS is the requirements
baseline, so a change to it also needs a new row in its Revision History and Adrian's
approval.

## Exporting .docx for a submission

Install pandoc (<https://pandoc.org/installing.html>), then run:

```bash
npm run docs:docx
```

This regenerates the `.docx` next to every `.md` in this folder. To export only some of
them, pass a filename filter:

```bash
npm run docs:docx -- Sprint
```

Open each one in Word to check it before submitting, and commit the regenerated files in
the same PR as the `.md` changes they reflect.

### How the .docx is formatted

Formatting comes from `scripts/reference.docx`: **Times New Roman throughout, US Letter,
one-inch margins**. It is the only `.docx` in the repository that is an input rather than
a generated deliverable, so it is also the only one that may be edited by hand — open it
in Word, change the styles, and commit it. Never set fonts or margins on an exported
file, because the next export overwrites them.
