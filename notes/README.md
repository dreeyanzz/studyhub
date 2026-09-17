# Notes

Postmortems: what broke, why nothing caught it, and what we changed. This is the
team's memory. An AI session that starts tomorrow knows only what is written in the
repository.

## When to write one

- Something cost an hour or more of debugging.
- A migration did not apply, or behaved differently in the cloud.
- The wrong person could read or change data.
- CI or a deploy looked green, and was not.
- How something works surprised you.

## How

Copy [`TEMPLATE.md`](TEMPLATE.md) to `notes/YYYY-MM-DD-short-description.md`. The full
guide is [`docs/guides/writing-a-postmortem.md`](../docs/guides/writing-a-postmortem.md).

## The rule that makes them worth writing

If a postmortem settles how we should work, change that rule **in the same PR**.
That means a new check, a changed rule, or a new "never do X".

The rule might live in `AGENTS.md`, a guide, `docs/DECISIONS.md`, a template, or CI. A
lesson that lives only in `notes/` gets repeated.
