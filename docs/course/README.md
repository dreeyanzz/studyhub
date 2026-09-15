# Course deliverables

These are the documents submitted for CPEPE361. The `.md` files are the source, and the
`.docx` files are generated from them (D-021). Never edit a `.docx` by hand.

| File                                               | What it is                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `StudyHub_SRS.md` / `.docx`                        | Software Requirements Specification v2.0: the requirements baseline (FR-x.y)                  |
| `StudyHub_Project_Planning_Worksheet.md` / `.docx` | Project Planning Worksheet v2.0                                                               |
| `StudyHub_Sprint_1_Plan.md` / `.docx`              | Sprint 1 plan: backlog, stories, tasks, estimates. Its `.docx` is created on the first export |
| `StudyHub_Project_Management_Board.html` / `.svg`  | The board snapshot for the Sprint 1 submission                                                |
| `diagrams/`                                        | The figures used by the SRS                                                                   |
| `archive/`                                         | The v1 originals, kept for audit                                                              |

## Changing a deliverable

Edit the `.md` in a pull request, like any other change. The SRS is the requirements
baseline, so a change to it also needs a new row in its Revision History and Adrian's
approval.

## Exporting .docx for a submission

Install pandoc (<https://pandoc.org/installing.html>), then run:

```bash
npm run docs:docx
```

This regenerates the `.docx` next to every `.md` in this folder. Open each one in Word to
check it before submitting, and commit the regenerated files in the same PR as the `.md`
changes they reflect.
