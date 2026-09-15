Closes #

## Why

## Key Changes

-

## Verification

- [ ] `npm run check`
- [ ] `npm run db:test` (any table, policy or function change)
- [ ] Manually exercised as:

## Checks

- [ ] Story work links its approved design doc in `docs/design/`
- [ ] New or changed table or policy has negative RLS tests (wrong user gets 0 rows; owner cannot make forbidden writes)
- [ ] Schema changed: `db:types` regenerated in this PR
- [ ] Docs this change makes stale are updated in this PR
- [ ] Synthetic data only (`@example.test`)
- [ ] I can explain every line of this diff

## AI assistance

- [ ] None
- [ ] Used (tool and what for):

## Still open

Co-Authored-By:
