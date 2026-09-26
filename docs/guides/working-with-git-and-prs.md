# Working with git and pull requests

## Branches

**Format:** `feature/STORY-xx-short-desc`, with 2–4 lowercase words joined by hyphens.
The course requires this format, and the `pr-title` check enforces it.

- A fix uses the story whose code it fixes.
- A repository chore uses STORY-00.

Start every branch from an up-to-date `main`:

```bash
git switch main
git pull
git switch -c feature/STORY-03-login-page
```

## Commits

**Format:** `type(scope): subject`, for example `feat(STORY-03): add the login form`.

- **Types:** `feat fix docs style refactor perf test build ci chore revert`.
- **Subject:** starts with a lowercase letter, uses the imperative ("add", not "added"), and has no full stop at the end.
- **Hooks:** the commit-msg hook rejects a byte-order mark and any subject that is not `type(scope): summary`. It does not check the case of the subject, the mood, or a trailing full stop — the `pr-title` check enforces the lowercase summary, and only on the PR title, which is the commit that lands on `main`. The pre-commit hook formats and lints the files you staged.

Keep commits small and focused. They are squashed when the PR merges, so the branch
commits are for you and your reviewer. The PR title and body are what stays on `main`.

## Commit messages and PR bodies on Windows

Windows PowerShell 5.1 writes files with a byte-order mark (BOM), or as UTF-16. Both break
commit messages and PR bodies, and the commit-msg hook and the `pr-title` check reject a
BOM.

- **Short message:** `git commit -m "feat(STORY-03): add the login form"` works in any
  shell.
- **Long message or PR body:** write it in Git Bash with a heredoc, or in your editor
  saved as UTF-8 without BOM.
- **PowerShell, if you must:**
  `[IO.File]::WriteAllText("$PWD\msg.txt", $text, [Text.UTF8Encoding]::new($false))`,
  then `git commit -F msg.txt`.
- **Never, in PowerShell 5.1:** `$text | Out-File msg.txt`, `$text > msg.txt`, or
  `Set-Content msg.txt $text`.

## Opening a pull request

```bash
git push -u origin HEAD
gh pr create
```

You can also open the link that `git push` prints.

- **Title:** `type(STORY-xx): summary`, with the summary in lowercase.
- **Body:** fill in the template.
  - First line: `Closes #<task>`. Add `Refs #<story>`.
  - Delete lines that do not apply rather than leaving them empty. An empty `Closes #` or `Co-Authored-By:` line fails the check, and so does an HTML comment.
- **AI help:** if AI helped, say so under "AI assistance" and keep the last line as `Co-Authored-By: <tool> <email>`. Otherwise, delete that line.
- **Reviewer:** ask Adrian for your PRs, and any teammate for Adrian's.
- **Board:** move your task card to Code Review.

## Keeping your branch up to date

```bash
git fetch
git merge origin/main
```

Resolve any conflicts, run `npm run check`, then push. Day to day, you never need to
rebase or force-push. The one exception is repairing a stacked pull request (next
section), and a person does that, not an AI agent.

## Never stack pull requests

**Every PR targets `main`.** Squash merges put a new commit on `main`. So if your branch was built on top of another open PR's branch, it conflicts with itself once that PR merges.

If you already stacked one:

```bash
git fetch
git rebase --onto origin/main <last-commit-of-the-other-branch> <your-branch>
git push --force-with-lease
```

A person runs these commands, not an AI agent.

## Checks on every pull request

| Check      | What it verifies                                    |
| ---------- | --------------------------------------------------- |
| `checks`   | Install, typecheck, lint, format, unit tests, build |
| `pr-title` | The PR title, the branch name, and the PR body      |
| `db`       | pgTAP database policy tests on a fresh local stack  |

All required checks must be green. A PR also needs 1 approving review from a teammate (D-014).

## Fixing common mistakes

| Problem                                    | Fix                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| You committed on `main` locally            | Run `git branch feature/STORY-xx-desc` to keep the work, then `git reset --hard origin/main` on `main`. Ask first if unsure |
| A commit message is wrong (not yet pushed) | `git commit --amend`                                                                                                        |
| The branch name is wrong                   | `git branch -m feature/STORY-xx-new-name`, push the new name, and open the PR from it                                       |
| `pr-title` failed                          | Edit the PR title or body on GitHub; the check runs again                                                                   |
| `format:check` failed                      | `npm run format`, then commit and push                                                                                      |
