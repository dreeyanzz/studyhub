# Reviewing and merging

Every pull request is reviewed before it merges, and only Adrian can merge (D-014). The required approval count is temporarily 0, because Adrian is the only active developer; it goes back to 1 when the first teammate can review (issue #72). Adrian approves teammates' PRs, and a teammate approves Adrian's. Nobody can
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
   - it has an approval, once the rule requires one again (issue #72)
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

AI agents may review and comment (`gh pr comment`). They never approve and never merge.
