# Development

Accounts, environments, secrets, the daily loop, and changing the database. The rules
are in [`AGENTS.md`](../AGENTS.md); this page is the practical side.

## Accounts and services

| Service                                        | For                                               | Owner                                  | Status                         |
| ---------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------ |
| GitHub `dreeyanzz/studyhub`                    | Code, pull requests, issues, the board            | Adrian (admin); teammates have write   | Active                         |
| Supabase: cloud dev project                    | Shared database for teammates and Vercel previews | Adrian                                 | Active (`studyhub-dev`)        |
| Supabase: production project                   | The deployed app                                  | Adrian                                 | Created before the Final phase |
| Vercel (Hobby)                                 | Hosting: `main` to production, PRs to previews    | Adrian                                 | To be connected                |
| Payment sandbox (PayMongo or Stripe test mode) | Reservation fees                                  | Each developer, their own test account | STORY-09                       |

The Supabase free plan allows two active projects (dev and production). It pauses a
project after about a week without activity, so wake it the day before any demo.

## Tools

| Tool               | Who                          | Why                              |
| ------------------ | ---------------------------- | -------------------------------- |
| Node 24            | Everyone                     | Pinned in `.nvmrc` and `engines` |
| Git and GitHub CLI | Everyone                     | Branches and pull requests       |
| Supabase CLI       | Everyone, through `npx`      | Pinned in `package.json`         |
| Docker Desktop     | Database owner only          | The local Supabase stack         |
| pandoc             | Whoever exports a submission | `npm run docs:docx`              |

## Environments

| Environment            | Database                                   | App                   | Data                                                  |
| ---------------------- | ------------------------------------------ | --------------------- | ----------------------------------------------------- |
| Local (database owner) | `npm run db:start` (Docker)                | `npm run dev`         | `supabase/seed.sql`, invented                         |
| Local (everyone else)  | Shared cloud dev project                   | `npm run dev`         | The shared test accounts (D-028), and what you create |
| Preview                | Shared cloud dev project                   | Vercel preview per PR | The shared test accounts (D-028), and what you create |
| Production             | Production project                         | Vercel, from `main`   | Demo data, invented; no seeded admin                  |
| CI                     | A fresh local stack per run (the `db` job) | None                  | `supabase/seed.sql`, invented                         |

## Secrets

`.env.example` lists every variable and is committed. `.env.local` holds your values
and is gitignored.

| Variable                               | Where it may appear                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Client and server. Public                                                                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client and server. Public by design, because Row-Level Security limits what it can do                                      |
| `CLOUD_DEV_ACCOUNT_PASSWORD`           | Not read by the app. The cloud dev project's test accounts sign in with it (D-028)                                         |
| `SUPABASE_SECRET_KEY`                  | Server only, in `app/api` route handlers. It bypasses RLS: never `NEXT_PUBLIC_`, never in client code. Adrian only (D-029) |

**How cloud keys are shared (D-029):**

- Adrian sends each teammate a ready `.env.local` privately: never in the group chat, an issue or a PR. It holds the cloud dev URL, the publishable key and the test accounts' password.
- The secret key stays with Adrian. Nothing uses it yet.
- If a secret key is ever committed or posted publicly, **rotate it** in the Supabase dashboard. Deleting the line is not enough.
- GitHub push protection is on and blocks many keys automatically.

## The daily loop

```bash
git switch main && git pull
git switch -c feature/STORY-xx-short-desc
npm run dev
# change the code and its tests
npm run check
git add -p
git commit -m "feat(STORY-xx): describe the change"
git push -u origin HEAD
gh pr create            # then fill in the template
```

To catch up with `main`, run `git fetch && git merge origin/main`. You never need to
rebase or force-push.

## Changing the database (database owner)

1. Run `npm run db:new short_description`. Never edit a migration that has already been
   applied.
2. In that same file, write:
   - the DDL
   - `alter table … enable row level security`
   - the policies
   - the GRANTs for exactly the verbs those policies use
3. Add negative tests in `supabase/tests/`. The wrong user gets 0 rows, and the owner
   cannot make forbidden writes.
4. `npm run db:reset && npm run db:test`.
5. `npm run db:types`, and commit the regenerated types in the same PR.
6. After the PR merges, Adrian runs `npx supabase db push` from `main` against the cloud
   dev project, and against production once it exists. Migrations do not ride along with
   Vercel deploys, so push them before the code that needs them reaches production.
   `db push` sends migrations only. Never add `--include-seed`: `seed.sql` holds the
   Administrator account and a public password (D-013).

Never apply a migration that has not been merged, and never change the schema in the
Supabase dashboard or through an AI tool. Otherwise the database no longer matches the
repository.

## The cloud dev project (database owner)

The shared database behind every teammate's `npm run dev` and the Vercel previews
(D-017).

- **Linking.** Once per machine: `npx supabase link --project-ref <ref>`. The ref is in
  the project's URL.
- **Migrations.** Step 6 above, after every merged migration.
- **Email confirmation is off**, as in local `config.toml`, so a new account can log in
  straight away.
- **Test accounts.** `npm run db:accounts` registers `host@`, `host2@` and
  `seeker@example.test` through Supabase Auth sign-up, so the sign-up trigger gives each
  its role (D-028). It reads `CLOUD_DEV_ACCOUNT_PASSWORD` from `.env.local`, which must
  differ from the seed password. Run it again whenever the project is recreated; it skips
  accounts that exist and checks each one's role and password. There is never an
  Administrator on a cloud project (D-013).

## Scheduled work

Vercel's Hobby plan runs cron jobs at most once a day (D-011). Some things must happen
within minutes:

- releasing a unit whose payment window has expired
- marking a no-show at the end of a wait window

These cannot depend on Vercel cron. STORY-09's design decides the mechanism; for
example, expiry checked in the query itself, with Supabase `pg_cron` for clean-up.

## Who owns what

| Area                                      | Owner  |
| ----------------------------------------- | ------ |
| Database, migrations, RLS, CI, merging    | Adrian |
| Design system, UI primitives, the board   | Maria  |
| Authentication, sessions, the route guard | Luke   |
| The automated test suite (STORY-06)       | Luke   |
| Portal shells, QA                         | James  |

Stories after Sprint 1 are assigned at sprint planning.
