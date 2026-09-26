# Testing

Tests ride along with the code they test: a feature and its tests land in the same pull
request.

## Three layers

| Layer           | Tool       | Where                                | Run                             |
| --------------- | ---------- | ------------------------------------ | ------------------------------- |
| Unit            | Vitest     | Next to the code: `lib/**/x.test.ts` | `npm test`                      |
| Database policy | pgTAP      | `supabase/tests/NN-name.sql`         | `npm run db:test` (local stack) |
| Journey         | Playwright | `e2e/` (arrives with STORY-06)       | Added with STORY-06             |

## Unit tests (Vitest)

**What to test:**

- the pure logic in `lib/<domain>/`
- every Zod schema in `lib/validation/`

**Naming:** name tests after behaviour, for example
`it('rejects a password without a number')`.

**Test data:** put shared test data in an `x.fixtures.ts` file next to the test.

## Database policy tests (pgTAP)

Row-Level Security is the security boundary. So every table or policy change ships with
tests that answer two questions:

1. **Does the wrong user get nothing?** Another seeker, another host, or an anonymous
   visitor gets **zero rows**. Not an error: zero rows.
2. **What is the right user prevented from doing to their own rows?** For example, a
   seeker cannot set their own role to `admin`, and a host cannot mark their own space as
   verified.

Add the positive case too: the right user can do the thing.

How a denial shows up depends on the operation:

| Operation                                 | What "denied" looks like                  |
| ----------------------------------------- | ----------------------------------------- |
| `select` blocked by RLS                   | 0 rows                                    |
| `insert` or `update` failing `with check` | Error `42501`                             |
| `update` or `delete` blocked by `using`   | 0 rows affected, and the row is unchanged |
| A table with no GRANT                     | Error `42501` (permission denied)         |
| A trigger rejecting a state change        | Error `P0001`                             |

**How a test file is built:**

- Start each file with `begin; select plan(n);` and end it with `select * from finish(); rollback;`.
- To act as a user, use `set local role authenticated` together with `set local request.jwt.claims = '{"sub": "<user id>", "role": "authenticated"}'`.
- The seed users come from `supabase/seed.sql`, which lists each account's fixed id at the top. Act as one by putting its id in `sub`.

**Watch a new test fail once before you trust it.** Remove the policy, run the test, see
it go red, then put the policy back.

## When a whole suite fails at once

Stash your change and run the suite on `main` first:

```bash
git stash
git switch main
# run the suite
git switch -
git stash pop
```

If it also fails on `main`, the problem is the environment, not your change.

## Manual checks

For UI work, check the page:

- at 360, 768 and 1024 px wide
- with the keyboard only
- as each seeded role involved

Say in the PR which account you used and what you saw.
