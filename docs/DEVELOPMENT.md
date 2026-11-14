# Development

Accounts, environments, secrets, the daily loop, and changing the database. The rules
are in [`AGENTS.md`](../AGENTS.md); this page is the practical side.

## Accounts and services

| Service                                        | For                                               | Owner                                  | Status                         |
| ---------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------ |
| GitHub `dreeyanzz/studyhub`                    | Code, pull requests, issues, the board            | Adrian (admin); teammates have write   | Active                         |
| Supabase: cloud dev project                    | Shared database for teammates and Vercel previews | Adrian; teammates invited (D-065)      | Active (`studyhub-dev`)        |
| Supabase: production project                   | The deployed app                                  | Adrian                                 | Created before the Final phase |
| Vercel (Hobby)                                 | Hosting: `main` to production, PRs to previews    | Adrian                                 | Active: worqph.vercel.app      |
| Payment sandbox: PayMongo in test mode (D-056) | Reservation fees                                  | Each developer, their own test account | STORY-09                       |

The Vercel project is `studyhub`, in Adrian's account. Until the production project
exists, its production deployment (worqph.vercel.app) and its previews use the cloud dev
project's URL and publishable key, the only two settings it has. Payments there need
`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` added in Vercel,
and the webhook registered in the Stripe Dashboard (STORY-09 design, "Stripe settings").

The Supabase free plan allows two active projects (dev and production). It pauses a
project after about a week without activity, so wake it the day before any demo.

## Tools

| Tool               | Who                                                       | Why                                                                                                     |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Node 24            | Everyone                                                  | Pinned in `.nvmrc` and `engines`                                                                        |
| Git and GitHub CLI | Everyone                                                  | Branches and pull requests                                                                              |
| Supabase CLI       | Everyone, through `npx`                                   | Pinned in `package.json`                                                                                |
| Docker Desktop     | Anyone writing migrations or running Playwright tests     | The local Supabase stack                                                                                |
| Playwright         | Whoever runs the Playwright tests                         | Pinned in `package.json`; needs Chromium (`npx playwright install chromium`)                            |
| pandoc             | Whoever exports a submission                              | `npm run docs:docx`                                                                                     |
| Stripe CLI         | Whoever tests payments against the Stripe sandbox (D-070) | `npm run stripe:listen`. Install it (`winget install Stripe.StripeCli` on Windows), then `stripe login` |

## Environments

| Environment            | Database                                   | App                   | Data                                                  |
| ---------------------- | ------------------------------------------ | --------------------- | ----------------------------------------------------- |
| Local (migration work) | `npm run db:start` (Docker)                | `npm run dev`         | `supabase/seed.sql`, invented                         |
| Local (other work)     | Shared cloud dev project                   | `npm run dev`         | The shared test accounts (D-028), and what you create |
| Preview                | Shared cloud dev project                   | Vercel preview per PR | The shared test accounts (D-028), and what you create |
| Production             | Production project                         | Vercel, from `main`   | Demo data, invented; no seeded admin                  |
| CI                     | A fresh local stack per run (the `db` job) | None                  | `supabase/seed.sql`, invented                         |

## Secrets

`.env.example` lists every variable and is committed. `.env.local` holds your values
and is gitignored.

| Variable                               | Where it may appear                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Client and server. Public                                                                                                                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client and server. Public by design, because Row-Level Security limits what it can do                                                                                          |
| `CLOUD_DEV_ACCOUNT_PASSWORD`           | Not read by the app. The cloud dev project's test accounts sign in with it (D-028)                                                                                             |
| `CLOUD_DEV_ADMIN_PASSWORD`             | Not read by the app. The cloud dev project's Administrator signs in with it (D-061, D-065)                                                                                     |
| `SUPABASE_SECRET_KEY`                  | Server only, in `app/api` route handlers (the Stripe webhook) and `npm run db:accounts`. It bypasses RLS: never `NEXT_PUBLIC_`, never in client code (D-029, D-065)            |
| `STRIPE_SECRET_KEY`                    | Server only, in `lib/payments/stripe.ts`. The Stripe sandbox's `sk_test_` or `rk_test_` key; a live key is refused (D-005, D-070)                                              |
| `STRIPE_WEBHOOK_SECRET`                | Server only, in the Stripe webhook route and `npm run webhook:simulate`. Locally, the `whsec_` that `stripe listen --print-secret` prints; on Vercel, the Dashboard endpoint's |
| `STRIPE_API_URL`                       | Optional, server only. Points the Stripe calls at a stub; unset, they go to `https://api.stripe.com`                                                                           |

`proxy.ts` reads the two `NEXT_PUBLIC_` variables on every page request (STORY-03), so
without them every page, the landing page included, fails with an error that names them.

**How cloud keys are shared (D-029, D-065):**

- Adrian sends each teammate a ready `.env.local` privately: never in the group chat, an issue or a PR. It holds the same values as Adrian's: the cloud dev URL, the publishable key, both test passwords and the secret key.
- The secret key bypasses Row-Level Security, so treat the whole file as a secret: keep it out of commits, screenshots and AI chats. `npm run db:accounts` uses the key to promote the cloud dev project's Administrator (D-061), and the Stripe webhook route uses it to call `confirm_payment` (STORY-09).
- These are the cloud dev project's values only. The production project's keys are decided when it is created (D-017).
- If a secret key is ever committed or posted publicly, Adrian or Luke **rotates it** in the Supabase dashboard, then Adrian sends everyone a new `.env.local`. Deleting the line is not enough.
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

## Running the Playwright tests locally

The Playwright tests (`npm run test:e2e`: STORY-06's smoke test, and the form-values test
from #146) run against the local Supabase stack only (D-013, D-028) and start their own
server on port 3100. They never talk to the cloud database.

1. Stop `npm run dev` first: Next 16 runs one dev server per project folder.
2. Install Chromium once: `npx playwright install chromium`
3. Ensure the local Supabase stack is running and seeded: `npm run db:start && npm run db:reset`
4. Run them: `npm run test:e2e`

## Testing payments locally

STORY-09's checkout goes to the Stripe sandbox, and Stripe confirms the payment with a
webhook to `/api/webhooks/stripe` (D-070). Stripe can't reach `localhost`, so locally
either the Stripe CLI forwards real events, or a script sends a signed fake one.

1. Put the sandbox's `STRIPE_SECRET_KEY` in `.env.local` (Adrian shares it like the cloud
   dev keys, D-065).
2. **Real payments:** run `npm run stripe:listen` beside `npm run dev`. Set
   `STRIPE_WEBHOOK_SECRET` to the `whsec_` it prints (the same one each time, from
   `stripe listen --print-secret`), and restart `npm run dev` if you changed it. Pay with
   Stripe's test card 4242 4242 4242 4242, any future date and any CVC.
3. **Timed checks and no CLI access:** `npm run webhook:simulate -- <reservation-id>`
   signs a paid `checkout.session.completed` event with your `STRIPE_WEBHOOK_SECRET`, any
   value you like when you don't use the CLI, and posts it to the dev server. Add
   `--url` for another port.

The webhook calls `confirm_payment` with `SUPABASE_SECRET_KEY`, so it changes whichever
database `.env.local` (or `.env.development.local`) points at.

## Changing the database

Adrian, the database owner, does this for every change, except that Luke does steps 1 to 5
for STORY-08 and STORY-10 (D-066). Step 6 is always Adrian's.

Work on the local stack. To try a change in the app, put the stack's URL and publishable
key in a gitignored `.env.development.local` (`npx supabase status` prints them), because
`npm run dev` reads that file ahead of `.env.local`. Delete it when you finish: until then,
your app doesn't use the cloud dev project.

1. Run `npm run db:new short_description`. Never edit a migration that has already been
   applied.
2. In that same file, write:
   - the DDL
   - `alter table … enable row level security`
   - the policies
   - the GRANTs for exactly the verbs those policies use
3. Add negative tests in `supabase/tests/`. The wrong user gets 0 rows, and the owner
   cannot make forbidden writes.
4. `npm run db:reset && npm run db:test && npm run db:race`.
5. `npm run db:types`, and commit the regenerated types in the same PR. Two people write
   migrations (D-066), so before the PR merges, merge `origin/main` into your branch and
   check:
   - **The order.** Your migration's timestamp must be later than every migration on
     `main`. If it isn't, rename your file to a later one. That is safe, because it hasn't
     reached a shared database yet. Otherwise `db push` refuses it without `--include-all`,
     and CI doesn't notice.
   - **The functions.** If you `create or replace` a function that another migration
     created, start from its latest definition on `main`. The later definition replaces
     the whole function, so any change you didn't carry over is lost with no error.
   - **The types.** If `lib/supabase/database.types.ts` conflicts, don't fix it by hand.
     Run steps 4 and 5 again.
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
- **Dashboard.** In the project's Supabase organization, Luke is an Administrator, and
  Maria and James are Developers (D-065). A Developer can read the keys and run SQL, but
  can't generate a new JWT secret, change Auth settings, reset the database password, or
  pause or delete the project. The organization holds only Worq's projects, because on
  the Free plan a role covers every project in it. Schema changes still go through
  migrations, never the dashboard.
- **Email confirmation is off**, as in local `config.toml`, so a new account can log in
  straight away.
- **Test accounts.** `npm run db:accounts` registers `host@`, `host2@` and
  `seeker@example.test`, and registers and promotes `admin@example.test` (D-028, D-061).
  Adrian runs it, as the database owner. It reads `SUPABASE_SECRET_KEY`,
  `CLOUD_DEV_ACCOUNT_PASSWORD` and `CLOUD_DEV_ADMIN_PASSWORD` from `.env.local`, and the
  two passwords must differ from the seed password and each other. Run it again whenever
  the project is recreated; it skips accounts that exist and checks each one's role and
  password. The production project has no Administrator until planned (D-028).

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
| User experience, design system, the board | Maria  |
| Authentication, sessions, the route guard | Luke   |
| The automated test suite (STORY-06)       | Luke   |
| Portal shells, QA                         | James  |

Luke writes STORY-08's and STORY-10's migrations, which Adrian reviews and pushes (D-066).
Stories after Sprint 1 are assigned at sprint planning.
