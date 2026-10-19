# Documentation map

## Where to start

- **New to the team:**
  1. [`../README.md`](../README.md)
  2. [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
  3. [`ONBOARDING.md`](ONBOARDING.md): ask your AI assistant to run it
  4. [`SPRINT-2.md`](SPRINT-2.md): what each of us does this sprint
- **AI agents:** [`../AGENTS.md`](../AGENTS.md) first, every session.

## Which document wins

When two documents disagree, the higher one wins and the lower one gets a fix PR:

1. The CPEPE361 brief (course requirements)
2. [`course/StudyHub_SRS.md`](course/StudyHub_SRS.md): requirements, cited as `FR-x.y`
3. [`DECISIONS.md`](DECISIONS.md): decisions, cited as `D-NNN`
4. [`flows/`](flows/README.md): the flows several stories share (D-044)
5. [`design/`](design/): one design doc per story
6. `supabase/migrations/` and its Row-Level Security policies
7. The code

## Documents

| Document                           | What it is for                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| [`DECISIONS.md`](DECISIONS.md)     | Every decision that had alternatives, and what was rejected                     |
| [`GLOSSARY.md`](GLOSSARY.md)       | The words to use in code, UI and docs                                           |
| [`ONBOARDING.md`](ONBOARDING.md)   | Machine setup, written for an AI agent to run                                   |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Accounts, environments, secrets, the daily loop, changing the database          |
| [`SPRINT-2.md`](SPRINT-2.md)       | The Sprint 2 brief: who does what, who waits for whom, how to test, the dates   |
| [`SPRINT-1.md`](SPRINT-1.md)       | The Sprint 1 brief, kept as the record of how Sprint 1 ran                      |
| [`guides/`](guides/)               | How-to guides for the team workflow                                             |
| [`flows/`](flows/README.md)        | The flows several stories share, drawn before the designs that use them         |
| [`design/`](design/)               | Design docs (one per story), the template and the index                         |
| [`course/`](course/)               | Course deliverables; `.md` is the source, `npm run docs:docx` makes the `.docx` |
| [`../notes/`](../notes/)           | Postmortems                                                                     |

## Guides

- [`planning-a-story.md`](guides/planning-a-story.md): from story issue to Done
- [`working-with-git-and-prs.md`](guides/working-with-git-and-prs.md): branches, commits, PRs, fixing mistakes
- [`reviewing-and-merging.md`](guides/reviewing-and-merging.md): reviewing a PR; how Adrian merges
- [`testing.md`](guides/testing.md): unit, database policy and journey tests
- [`using-ai-assistants.md`](guides/using-ai-assistants.md): setting up each AI tool, its limits, and giving it credit
- [`writing-a-postmortem.md`](guides/writing-a-postmortem.md): when and how, and what to update
- [`board-guide.md`](guides/board-guide.md): running the GitHub Project board

## Where does it go?

| What happened                                                                           | Where it goes                                         |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Ordinary work                                                                           | The PR body (it becomes the commit on `main`)         |
| A decision that another story builds on, is costly to reverse, or had real alternatives | A new entry in [`DECISIONS.md`](DECISIONS.md) (D-044) |
| A flow that several stories share                                                       | `flows/<name>.md` (D-044)                             |
| A story's design                                                                        | `design/STORY-xx-*.md`                                |
| Something broke or cost real debugging                                                  | A postmortem in [`../notes/`](../notes/)              |
| A new term, or a word used two ways                                                     | [`GLOSSARY.md`](GLOSSARY.md)                          |
| An open question                                                                        | A `decision-needed` issue                             |
| A new script, command or environment value                                              | `AGENTS.md` Commands and `DEVELOPMENT.md`             |
