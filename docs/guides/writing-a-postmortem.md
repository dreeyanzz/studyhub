# Writing a postmortem

A postmortem is a short note about something that went wrong or surprised us. It is
written so that nobody has to solve the same problem twice. Postmortems live in
[`notes/`](../../notes/) and use [`notes/TEMPLATE.md`](../../notes/TEMPLATE.md).

## When to write one

- Something cost an hour or more of debugging.
- A migration did not apply, or behaved differently in the cloud.
- The wrong person could read or change data, or nearly could.
- CI or a deploy looked green, and was not.
- How a tool or library works surprised you.

Typos and quick fixes don't need one; the PR body is enough.

## How

1. Copy `notes/TEMPLATE.md` to `notes/YYYY-MM-DD-short-description.md`, using today's
   date.
2. Write it for someone who was not there and reads it six weeks from now.
3. **Root cause:** name both the mistake and the missing check that let it through.
4. **Rejected alternatives:** what you tried that did not work. This part saves the next
   person the most time.
5. **Still open:** be honest about what is not fixed.
6. **Lesson:** one or two sentences someone can act on.

Put it in the same PR as the fix when you can. Otherwise, open its own PR titled
`docs(STORY-xx): add postmortem on …`.

## Update the rule, not just the note

If the postmortem settles how we should work, change the rule in the same PR, and list
the change under "Docs and rules updated in this PR":

| The postmortem found             | Change                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| A new "never do X"               | An `AGENTS.md` working rule, and the guide it belongs to             |
| A decision that turned out wrong | A new [DECISIONS](../DECISIONS.md) entry that supersedes the old one |
| A missing check                  | CI, a hook, a lint rule, or a test                                   |
| A gap in a template              | The template                                                         |

A lesson that lives only in `notes/` gets repeated.
