-- STORY-20, TSK-20.1: the Taken down verification status (D-084).
-- Design: docs/design/STORY-20-verification-follow-ups.md §2. Flow:
-- docs/flows/space-verification.md. Never edit this file once applied; add a new
-- migration instead.
--
-- On its own because Postgres refuses to use an enum value in the transaction that
-- added it ("unsafe use of new value"), and the next migration uses it.

alter type public.space_status add value if not exists 'taken_down';
