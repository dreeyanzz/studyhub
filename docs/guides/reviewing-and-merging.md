# Reviewing and merging

Every pull request is reviewed before it merges, and only Adrian can merge (D-014). The required approval count is 1. Adrian approves teammates' PRs, and a teammate approves Adrian's. Nobody can
approve their own PR.

## Reviewing a pull request

Read the linked design doc first, then the diff. Check:

- **Scope:** it does what the task and the design say, and nothing unrelated.
- **Tests:**
  - unit tests for new logic
  - for any table or policy change, negative pgTAP tests: the wrong user gets 0 rows, and the owner cannot make forbidden writes
- **Security:**
  - no secret key in client code
  - no authorization rule that exists only in app code (RLS is the boundary)
- **Accessibility (UI changes):**
  - 48×48 px targets, a keyboard path, visible focus, enough contrast
  - works at 360, 768 and 1024 px
  - a list view for anything shown on a map
- **Words:** glossary terms in code and UI.
- **Docs:** anything the change makes stale is updated in the same PR.
- **PR body:** Why, Key Changes and Verification are filled in honestly, and AI use is
  disclosed.

Comment on specific lines, then submit your review:

| Choice          | When to use it                           |
| --------------- | ---------------------------------------- |
| Request changes | Something must change before merge       |
| Approve         | You would be happy to maintain this code |
| Comment         | Anything else                            |

**Two rules:**

- Every review thread must be resolved before the PR can merge.
- Pushing new commits dismisses earlier approvals, so an approval always covers what actually lands.

## For the author

Answer every comment, either with a change or a reply. Resolve each thread once it is
settled. After pushing changes, request the review again.

## How Adrian merges

1. **Check** that:
   - the required checks are green
   - it has 1 approving review from a peer
   - every thread is resolved
   - for story work, the design doc is merged
2. **Read the squash commit title and message** in the merge box. They are what stays on `main`, and you can fix the wording there. The `Co-Authored-By:` line must stay last.
3. **Merge.** Tick "Merge without waiting for requirements to be met (bypass rules)" and choose "Squash and merge".
   - The bypass skips only the rule that stops teammates from merging. The approval and the checks still apply.
   - From a terminal: `gh pr merge <number> --squash --admin`.
4. **If the PR changed the database**, run `npx supabase db push` against the cloud dev project.
5. **Check the board.** The task should be in Done and the story's progress updated.

GitHub deletes the PR's branch automatically.

## AI agents

AI agents review pull requests, and approve one only when their person says so (D-034).
They never merge, and never approve a pull request they opened.

### Before writing a review

An agent reviews what it checked itself, not what the PR body claims:

1. Read the PR, its task (the "Done when" list), its story, and every design section and
   decision the change touches.
2. Check out the branch (`gh pr checkout <number>`). Run `npm run check` and
   `npm run build`, plus `npm run db:test` if SQL changed.
3. Run the design's §4 manual checks. Anything behind a login runs against the local
   Supabase stack with the seeded accounts, never the shared cloud project. UI changes
   are checked at 360, 768 and 1024 px, with text at 100% and 200%, and by keyboard.
4. Look for what the diff leaves stale: docs, the AGENTS.md layout note, design §9, and
   the PR body itself.

### What every agent review contains

In plain English, in this order:

1. **Verdict.** One or two sentences: what the PR does, and approve, request changes or
   comment.
2. **Against the task and the design.** Each "Done when" item, and each design section the
   change implements (by § number): met or not, and how you know.
3. **File by file.** What each changed file does, and whether it sits where
   [AGENTS.md](../../AGENTS.md#layout) says it should.
4. **Findings,** most serious first. Each one has:
   - a severity: **blocking** (must change before merge), **should fix**, or **nit**;
   - the file and line, also left as a line comment when that helps;
   - what goes wrong, as a concrete scenario ("clicking Log out gives a 404 and leaves you
     signed in");
   - the fix.
5. **Checks run.** Each command and its result, and each manual check with the account,
   page and outcome. Write "not run", and why, for anything skipped. Never report a check
   you did not run.
6. **Security, accessibility and docs.** Each row of the checklist in
   [Reviewing a pull request](#reviewing-a-pull-request), answered.
7. **Commits you pushed.** When your person asked you to fix problems on the author's
   branch: each commit and what it changed. The author reviews those commits, so they can
   explain every line in the Final phase.
8. **Disclosure,** as the last line: `_Review written with <tool>; submitted as an approval
on <person>'s instruction._` (or `as a comment` / `as a request for changes`).

### Approving

The agent submits the review as an approval only when all of these hold:

- its person has read the review and explicitly said to approve this pull request;
- the required checks are green on the commit being approved;
- no blocking finding is left;
- the agent did not open the pull request.

Otherwise it submits the review as a comment, or as a request for changes when something
blocking remains. Pushing after an approval dismisses it, so approve last.

```bash
gh pr review <number> --comment --body-file review.md          # the default
gh pr review <number> --request-changes --body-file review.md  # something blocking
gh pr review <number> --approve --body-file review.md          # only on instruction
```
