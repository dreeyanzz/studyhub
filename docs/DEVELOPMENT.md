# Development

Accounts, environments, secrets, the daily loop, and changing the database. The rules
are in [`AGENTS.md`](../AGENTS.md); this page is the practical side.

## Accounts and services

| Service                                 | For                                               | Owner                                                              | Status                                        |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| GitHub `dreeyanzz/studyhub`             | Code, pull requests, issues, the board            | Adrian (admin); teammates have write                               | Active                                        |
| Supabase: cloud dev project             | Shared database for teammates and Vercel previews | Adrian; teammates invited (D-065)                                  | Active (`studyhub-dev`)                       |
| Supabase: production project            | The deployed app                                  | Adrian only, in its own organization (D-090)                       | Ready for switch day (`studyhub-prod`, D-090) |
| Vercel (Hobby)                          | Hosting: `main` to production, PRs to previews    | Adrian                                                             | Active: worqph.vercel.app                     |
| Payment sandbox: Stripe sandbox (D-070) | Reservation fees                                  | Adrian (the sandbox); teammates who test payments get its test key | Active                                        |
| Google Cloud (`Worq`, OAuth 2.0, D-095) | Continue with Google sign-in and sign-up          | Team Gmail (`worq.team.ph@gmail.com`); Adrian manages credentials  | Active (In production)                        |

The Vercel project is `studyhub`, in Adrian's account. Until the production project
exists, its production deployment (worqph.vercel.app) and its previews use the cloud dev
project's URL and publishable key, the only two settings it has. Payments there need
`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` added in Vercel,
and the webhook registered in the Stripe Dashboard with API version `2026-10-28.endive`,
the one the code pins (D-070, STORY-09 design, "Stripe settings"). Leave the sandbox's default
API version on it too, because `stripe listen` renders events at the default.

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

| Environment            | Database                                                                          | App                            | Data                                                  |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| Local (migration work) | `npm run db:start` (Docker)                                                       | `npm run dev`                  | `supabase/seed.sql`, invented                         |
| Local (other work)     | Shared cloud dev project                                                          | `npm run dev`                  | The shared test accounts (D-028), and what you create |
| Preview                | Shared cloud dev project                                                          | Vercel preview per PR          | The shared test accounts (D-028), and what you create |
| Production             | Production project                                                                | Vercel, from `main`            | Real accounts (D-091), and demo data built in the app |
| CI                     | A fresh local stack per job (`db` + 3 `e2e` shards; fast-passed on docs-only PRs) | `next start` (in `e2e` shards) | `supabase/seed.sql`, invented                         |

## Secrets

`.env.example` lists every variable and is committed. `.env.local` holds your values
and is gitignored.

| Variable                               | Where it may appear                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Client and server. Public                                                                                                                                                                                                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client and server. Public by design, because Row-Level Security limits what it can do                                                                                                                                                                                                                         |
| `CLOUD_DEV_ACCOUNT_PASSWORD`           | Not read by the app. The cloud dev project's test accounts sign in with it (D-028)                                                                                                                                                                                                                            |
| `CLOUD_DEV_ADMIN_PASSWORD`             | Not read by the app. The cloud dev project's Administrator signs in with it (D-061, D-065)                                                                                                                                                                                                                    |
| `SUPABASE_SECRET_KEY`                  | Server only, in `app/api` route handlers (the Stripe webhook) and `npm run db:accounts`. It bypasses RLS: never `NEXT_PUBLIC_`, never in client code (D-029, D-065)                                                                                                                                           |
| `STRIPE_SECRET_KEY`                    | Server only, in `lib/payments/stripe.ts`. The Stripe sandbox's `sk_test_` or `rk_test_` key; a live key is refused (D-005, D-070)                                                                                                                                                                             |
| `STRIPE_WEBHOOK_SECRET`                | Server only, in the Stripe webhook route and `npm run webhook:simulate`. Locally, the `whsec_` that `stripe listen --print-secret` prints; on Vercel, the Dashboard endpoint's                                                                                                                                |
| `STRIPE_API_URL`                       | Optional, server only. Points the Stripe calls at a stub; unset, they go to `https://api.stripe.com`                                                                                                                                                                                                          |
| `GMAIL_USER`                           | Optional, server only, in `lib/email/transport.ts`. The team Gmail address that sends STORY-16's hold confirmation email. In Vercel Production and optional in `.env.local` (D-089)                                                                                                                           |
| `GMAIL_APP_PASSWORD`                   | Optional, server only, in `lib/email/transport.ts`. The team Gmail account's app password. In Vercel Production and Adrian's `.env.local` only; never in Preview, CI, code or chat (D-089)                                                                                                                    |
| `SUPABASE_DEV_DB_URL`                  | GitHub Actions repository secret only, used by `.github/workflows/db-push-dev.yml` (D-096). `studyhub-dev`'s **Session Pooler** URI (port `5432`, IPv4-compatible on GitHub-hosted runners — not the direct IPv6-only URI and not Transaction Pooler `6543`). Never holds `studyhub-prod` credentials (D-090) |
| `PRODUCTION_DB_URL`                    | Adrian's `.env.local` only. `studyhub-prod`'s Postgres connection string for `npx supabase db push --db-url "$PRODUCTION_DB_URL"` and `npx supabase migration list --db-url "$PRODUCTION_DB_URL"` (D-090). Never in Vercel, GitHub Actions, code, or chat                                                     |
| `PRODUCTION_SUPABASE_URL`              | Adrian's `.env.local` only. `studyhub-prod`'s project URL, read only by `npm run db:promote-admin` so it cannot target cloud dev by mistake (D-090, D-091)                                                                                                                                                    |
| `PRODUCTION_SECRET_KEY`                | Adrian's `.env.local` only. `studyhub-prod`'s secret key, read only by `npm run db:promote-admin` (D-090, D-091). Bypasses RLS: never `NEXT_PUBLIC_`, never shared, never in client code or chat                                                                                                              |

`proxy.ts` reads the two `NEXT_PUBLIC_` variables on every page request (STORY-03), so
without them every page, the landing page included, fails with an error that names them.

**How cloud keys are shared (D-029, D-065):**

- Adrian sends each teammate a ready `.env.local` privately: never in the group chat, an issue or a PR. It holds the same values as Adrian's: the cloud dev URL, the publishable key, both test passwords and the secret key.
- The secret key bypasses Row-Level Security, so treat the whole file as a secret: keep it out of commits, screenshots and AI chats. `npm run db:accounts` uses the key to promote the cloud dev project's Administrator (D-061), and the Stripe webhook route uses it to call `confirm_payment` (STORY-09).
- These are the cloud dev project's values only. The production project's keys stay on Adrian's machine (and in Vercel Production on the switch day), in its own Supabase organization with Adrian as its only member (D-090).
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

The Playwright tests (`npm run test:e2e`) run against the local Supabase stack only
(D-013, D-028) and start their own server on port 3100 (`next dev` locally, or
`next start` in CI and when `PLAYWRIGHT_USE_BUILD=1` is set after building with the local
stack's `NEXT_PUBLIC_*` env vars and `PLAYWRIGHT_DISABLE_ISR=1`). They never talk to the
cloud database.

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

The webhook calls `confirm_payment` with `SUPABASE_SECRET_KEY`, so it changes the
database that `NEXT_PUBLIC_SUPABASE_URL` points at, and both must come from the same
project. On the local stack, put its `SECRET_KEY` (`npx supabase status -o env` prints
it) in `.env.development.local` too, beside the URL and publishable key that "Changing the
database" names. With the cloud dev key left from `.env.local`, every delivery fails with
`42501` and the route answers 500.

`stripe listen` receives every event in the sandbox, so a teammate's payment reaches your
dev server too. It names a reservation your database doesn't have, and the route logs it
as an unknown reservation and answers 200.

Until the switch to production, a payment on a Vercel preview is confirmed too: the
sandbox's one endpoint is worqph, which uses cloud dev like the previews. Once worqph runs
on production, a preview's payment reaches production instead, which logs it as an
unknown reservation, and the preview's hold lapses unpaid. From then on, try payments
locally with the steps above (STORY-19's design).

## Changing the database

Adrian, the database owner, writes migrations for every change except STORY-08, STORY-10
and STORY-16, which Luke writes (D-066, D-094). Merging a migration PR automatically
pushes it to `studyhub-dev` via GitHub Actions (D-096); Adrian still pushes `studyhub-prod`
manually (D-090).

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
   - **The order.** Run `npm run db:check-order` (CI also runs it in the `db` job, D-096).
     Your migration's timestamp must be strictly later than every migration on `main`, and
     existing migrations on `main` must not be modified, renamed or deleted. If your
     timestamp is stale, rename the file before pushing — that is safe because it hasn't
     reached a shared database yet.
   - **The functions.** If you `create or replace` a function that another migration
     created, start from its latest definition on `main`. The later definition replaces
     the whole function, so any change you didn't carry over is lost with no error.
   - **The types.** If `lib/supabase/database.types.ts` conflicts, don't fix it by hand.
     Run steps 4 and 5 again.
6. After the PR merges to `main`, `.github/workflows/db-push-dev.yml` automatically pushes
   the migration to `studyhub-dev` using `SUPABASE_DEV_DB_URL` (D-096). Once `studyhub-prod`
   exists, Adrian pushes merged migrations there manually from `main` with
   `npx supabase db push --db-url "$PRODUCTION_DB_URL"`, never by re-linking the CLI
   (D-090). Neither path ever passes `--include-seed`: `seed.sql` holds the Administrator
   account and a public password (D-013).

Never apply a migration that has not been merged, and never change the schema in the
Supabase dashboard or through an AI tool. Otherwise the database no longer matches the
repository.

## The cloud dev project (database owner)

The shared database behind every teammate's `npm run dev` and the Vercel previews
(D-017).

- **Linking.** Once per machine: `npx supabase link --project-ref <ref>`. The ref is in
  the project's URL.
- **Migrations.** Automated on merge to `main` via `.github/workflows/db-push-dev.yml`
  (D-096); manual dry-run or re-run is available from the Actions tab on `main`.
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
  password. The production project's accounts are real addresses instead (D-091, STORY-19's
  design).
- **50-space Metro Cebu demo catalog (D-097).** `npm run db:seed:demo -- --reset` (cloud dev via `.env.local`) and `npm run db:seed:demo:local -- --reset` (local Docker Supabase) seed the same 50 real Metro Cebu study and co-working spaces, 15 synthetic `@example.test` accounts, zones, units, tags, cover photos (`space-photos` bucket), verification `space_events`, reservations, payments, reviews, and moderation fixtures while keeping `supabase/seed.sql` minimal for pgTAP and Playwright CI.
- **Deleting an account.** Before you delete a Host's account in the dashboard, delete
  their Spaces in the app, or empty each Space's `space-photos/<space_id>` folder on the
  Storage page. Nothing else removes those photos, and the bucket is public (D-092). The
  same goes for the production project.
- **Google OAuth (`studyhub-dev` and `studyhub-prod`, STORY-21, D-095).**
  - Google Cloud project `Worq` (under the team Gmail account `worq.team.ph@gmail.com`) holds
    the `Worq Web` OAuth 2.0 Web Client with basic scopes only (`openid`, `email`, `profile`),
    published **In production** (Branding home page `https://worqph.vercel.app`, privacy
    policy `https://worqph.vercel.app/privacy`).
  - Authorized JavaScript origins: `https://worqph.vercel.app` and `http://localhost:3000`.
  - Authorized redirect URIs: `https://<studyhub-dev-ref>.supabase.co/auth/v1/callback`, plus
    `https://<studyhub-prod-ref>.supabase.co/auth/v1/callback` once `TSK-19.1` creates the
    production project (D-090).
  - In Supabase Dashboard (**Authentication → Providers → Google**), enable Google and store
    the Client ID and Client Secret there only — never in `.env.local`, commits or chat.
  - In Supabase Dashboard (**Authentication → URL Configuration → Redirect URLs**), keep
    `http://localhost:3000/api/auth/callback`, `http://127.0.0.1:3000/api/auth/callback`,
    `https://worqph.vercel.app/api/auth/callback`, and the project-scoped Vercel preview
    pattern `https://studyhub-*-dreeyanzzs-projects.vercel.app/api/auth/callback` (never a
    blanket `https://*.vercel.app/**`).
  - Local `supabase/config.toml` keeps `[auth.external.google]` disabled by default so Docker
    and CI never require Google secrets; automated tests cover OAuth onboarding via pgTAP
    (`supabase/tests/13-google-oauth.sql`), Vitest and Playwright (`e2e/google-oauth.spec.ts`).

## The production project (database owner, D-090, D-091)

`studyhub-prod` is kept ready to run `https://worqph.vercel.app` on any day Adrian chooses
(D-090, [STORY-19 design](design/STORY-19-final-hardening.md)). Every step below runs on
Adrian's machine or in the service dashboards — agents never run `supabase db push`,
`supabase link`, or touch a shared database (`AGENTS.md`).

### One-time setup (`TSK-19.1`)

1. **Supabase organization and project.** Create `studyhub-prod` in a Supabase organization
   of its own with Adrian as its only member, in the same region as `studyhub-dev`. On the
   Supabase Free plan, an organization role covers every project in it (so keeping it out of
   `lamph-org` keeps production Adrian-only, D-090), and the account allows two active
   projects (`studyhub-dev` and `studyhub-prod`; keep `vesper-org` projects paused).
2. **Local credentials (Adrian only).** Put `studyhub-prod`'s `PRODUCTION_DB_URL`,
   `PRODUCTION_SUPABASE_URL` and `PRODUCTION_SECRET_KEY` in Adrian's `.env.local` only.
   Never run `supabase link` against `studyhub-prod`, and never put production keys in
   Vercel Preview, GitHub Actions, code, or chat.
3. **Push merged migrations from `main`.** From a clean, up-to-date `main` branch:
   ```bash
   npx supabase db push --db-url "$PRODUCTION_DB_URL"
   npx supabase migration list --db-url "$PRODUCTION_DB_URL"
   ```
   Verify that the migration list matches `studyhub-dev` and that the public `space-photos`
   Storage bucket exists. Never pass `--include-seed`: `supabase/seed.sql` holds a public
   password and synthetic accounts (D-013, D-028).
4. **Supabase Auth settings on `studyhub-prod`:**
   - **Site URL:** `https://worqph.vercel.app`
   - **Redirect URLs:** `https://worqph.vercel.app/**` (accepts `/api/auth/callback`)
   - **Email confirmation:** **On** (every new user confirms by email before signing in)
   - **Password rules:** at least 8 characters, with a number and a symbol (matches STORY-03)
   - **Custom SMTP (D-089):** host `smtp.gmail.com`, port `465`, team Gmail account
     (`worq.team.ph@gmail.com`) and its app password, sender name `Worq`
   - **Google OAuth (STORY-21, D-095):** add
     `https://<studyhub-prod-ref>.supabase.co/auth/v1/callback` to Google Cloud's `Worq Web`
     OAuth 2.0 client Authorized redirect URIs, and enable **Authentication → Providers →
     Google** on `studyhub-prod` with that Client ID and Client Secret.

### Until the switch day

Whenever a migration PR merges to `main`, `.github/workflows/db-push-dev.yml` pushes it to
`studyhub-dev` automatically (D-096). Adrian then pulls `main` and runs:

```bash
npx supabase db push --db-url "$PRODUCTION_DB_URL"
npx supabase migration list --db-url "$PRODUCTION_DB_URL"
```

so `studyhub-prod` always matches `studyhub-dev`.

### Switch-day checklist (Adrian's call, D-090, D-091)

Real production accounts are created only after `worqph.vercel.app` runs on `studyhub-prod`
so their sign-up writes go to production and their confirmation links resolve on `worqph`.

1. [ ] Confirm `studyhub-prod`'s migration list matches `studyhub-dev`
       (`npx supabase migration list --db-url "$PRODUCTION_DB_URL"`).
2. [ ] In Vercel **Project Settings → Environment Variables**, update **Production** only
       (keep **Preview** pointed at `studyhub-dev`):
   - `NEXT_PUBLIC_SUPABASE_URL` → `studyhub-prod` URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `studyhub-prod` publishable key
   - `SUPABASE_SECRET_KEY` → `studyhub-prod` secret key
   - Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set on **Production** only (D-089)
   - Leave `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the Stripe sandbox (D-005,
     D-070)
3. [ ] Redeploy `main` to Vercel **Production** (`https://worqph.vercel.app`).
4. [ ] Register the three real role accounts on `https://worqph.vercel.app/register` and
       confirm each from the team Gmail inbox (D-091):
   - **Host:** `worq.team.ph+host@gmail.com` (sign up as Host)
   - **Seeker:** `worq.team.ph+seeker@gmail.com` (sign up as Seeker)
   - **Administrator:** `worq.team.ph+admin@gmail.com` (sign up as Seeker first)
     Choose strong unique passwords, keep them out of the repository and chat, and share them
     privately with teammates for rehearsals (D-029).
5. [ ] Promote the Administrator account from Adrian's machine:
   ```bash
   npm run db:promote-admin -- worq.team.ph+admin@gmail.com
   ```
   The script prints the target production host, refuses `@example.test` addresses, refuses
   to run if `PRODUCTION_SUPABASE_URL` matches `NEXT_PUBLIC_SUPABASE_URL`, requires the
   account's email to be confirmed, sets `profiles.role = 'admin'` and
   `profiles.role_confirmed = true`, and reads the row back to verify.
6. [ ] Verify role boundaries on `https://worqph.vercel.app`: confirm `+seeker` and `+host`
       cannot open `/admin`, and `+admin` can.
7. [ ] Rehearse the full product flow on `https://worqph.vercel.app`: create and approve a
       Space, hold a Unit, pay in the Stripe sandbox, confirm STORY-16's hold confirmation email
       arrives, check in at the Host desk, post a review, moderate a reported review, and refund
       an eligible payment.
8. [ ] Build the demo Spaces, seat maps, photos, tags, and approvals through the app
       (never run `seed.sql` on production, D-028, D-091).

**Ongoing operational notes after the switch:**

- **Preview payments:** Stripe's sandbox sends events to one webhook endpoint
  (`https://worqph.vercel.app/api/webhooks/stripe`). After the switch, a sandbox payment on
  a Vercel Preview reaches `studyhub-prod`, which logs an unknown reservation (`not_found`)
  and answers `200`, leaving the preview hold unpaid until it lapses. Test payments locally
  with `npm run stripe:listen` or `npm run webhook:simulate`.
- **Deleting Host accounts:** Before deleting a Host account in the Supabase dashboard,
  delete their Spaces in the app or empty each `space-photos/<space_id>` folder in Storage
  first (D-092).
- **Waking before a pitch:** Supabase's free plan pauses an inactive project after about a
  week; open `https://worqph.vercel.app` the day before any demo or pitch.

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
| Database, migrations, RLS, CI/CD          | Adrian |
| User experience, design system, the board | Maria  |
| Authentication, sessions, the route guard | Luke   |
| The automated test suite (STORY-06)       | Luke   |
| Portal shells, QA                         | James  |

Luke writes STORY-08's, STORY-10's and STORY-16's migrations (D-066, D-094); any teammate
can squash-merge approved PRs once CI is green, and `studyhub-dev` migrations auto-push on
merge (D-096).
Stories after Sprint 1 are assigned at sprint planning.
