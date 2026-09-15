# YYYY-MM-DD: what broke, in one plain line

Copy this file to `notes/YYYY-MM-DD-short-description.md`. Write for someone who was
not there and reads it six weeks from now.

**What broke:** what someone actually saw: the error, the wrong screen, the missing row.
Link the PR, commit or migration. Say when it started and how it was noticed.

**Impact:** who or what was affected, or would have been.

## Root cause

There are usually two: the mistake, and the missing check that let it through. Name
both.

## The fix

What changed, and why this fix rather than a narrower or broader one. Link the PR.

## Rejected alternatives

- **What you tried or considered:** why it did not work, or why it was not chosen.

## Still open

- What is still unresolved, and what it would take to resolve it.

## Docs and rules updated in this PR

- For example: an `AGENTS.md` working rule, `docs/guides/testing.md`, a CI job, a
  `DECISIONS.md` entry.
- Or: "none", with the reason this was a one-off.

## Lesson

One or two sentences a future session can act on.
