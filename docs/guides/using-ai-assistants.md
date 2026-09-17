# Using AI assistants

AI tools are allowed and encouraged. Three rules come first:

1. **You own the work.** The person who opens the pull request must be able to explain
   every line. The Final phase includes a code authorship check and an oral defense.
2. **Disclose it.** Say in the PR's "AI assistance" section which tool you used and what
   for, and end the PR body with a `Co-Authored-By:` line.
3. **Agents never merge, approve, push to `main`, force-push, or change a shared
   database.** If a tool suggests doing one of these, stop.

## Setting up each tool

Every tool reads the same rules, from [`AGENTS.md`](../../AGENTS.md).

| Tool                          | How it reads `AGENTS.md`                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Claude Code                   | `CLAUDE.md` imports it. `.claude/settings.json` also blocks merging, approving, pushing to `main` and database pushes |
| Gemini CLI                    | `.gemini/settings.json` lists it as a context file                                                                    |
| Antigravity (1.20.5 or newer) | Reads it natively                                                                                                     |
| Codex                         | Reads it natively                                                                                                     |
| ChatGPT or another chat tool  | It cannot see the repository. Paste `AGENTS.md` at the start of the conversation, then the files you are working on   |

To check that it works, ask the tool: "What must a branch be named in this repository?"
The answer should be `feature/STORY-xx-short-desc`.

## Working with an agent

- **Start from the plan.** Give it the issue number and the design doc. Ask for a plan first, agree on it, and only then let it write code.
- **Keep the scope small:** one concern per session and per PR.
- **Check its work.** Read every diff before committing, and run `npm run check` yourself.
- **Protect secrets.** Never paste keys, passwords or `.env.local` into a chat.
- **Keep it honest.** Don't let an agent tick acceptance criteria it did not verify.

## Supabase MCP and other database tools

If you connect the Supabase MCP server, or any database tool, to an AI assistant:

- connect it **read-only**, for example with `read_only=true` in the server URL
- connect it to the **dev project** only

Schema changes go through migration files and pull requests, never through an assistant.

## Credit lines

End the PR body with one line per tool that helped:

- **Claude:** `Co-Authored-By: Claude <noreply@anthropic.com>`
- **Other tools:** use the line the tool writes itself, if it has one. Otherwise, name the tool with a reserved placeholder address, for example `Co-Authored-By: Gemini CLI <ai@example.invalid>`. The `.invalid` address is deliberate: the line is a disclosure, not a link to someone's account.

The `pr-title` check fails if the `Co-Authored-By:` line is left empty. Delete the line if
no AI was used.
