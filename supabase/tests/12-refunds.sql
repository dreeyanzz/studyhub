-- STORY-14, TSK-14.2: sandbox refunds. Tests docs/design/STORY-14-admin-console.md §2 and
-- §4's refund rows, and the reservation lifecycle's P1 (FR-5.3, D-047, D-085, D-088).
--
-- Seed accounts:
--   admin   a0000000-0000-4000-8000-000000000001  Alma Reyes
--   host    b0000000-0000-4000-8000-000000000001  owns e...01, Kapihan Study Hall
--   seeker  c0000000-0000-4000-8000-000000000001  Sam Dela Cruz
--   seeker2 c0000000-0000-4000-8000-000000000002  Rina Bautista
--
-- Fixtures: reservation 14...NN has payment 24...NN, all on Kapihan Study Hall.
--   01  seeker   S1  reserved, paid 1 hour ago; the Host overrides it below (R9)
--   02  seeker2  S4  cancelled, paid 2 hours ago, as a take-down leaves it (R14, D-085)
--   03  seeker2  S5  expired and unpaid; the webhook confirms it late below (P2)
--   04  seeker   S6  no-show, forfeited 3 hours ago (R7)
--   05  seeker   S7  cancelled after paying, forfeited 4 hours ago (R8)
--   06  seeker   S8  completed visit, paid 5 hours ago
--   07  seeker2  S2  reserved (active), paid 10 minutes ago
--   08  seeker   S3  reserved, paid 20 minutes ago, wait window lapsed but not recorded
--   09  seeker2  D1  expired, never paid (R3)
--   10  seeker   --  cancelled 90 days ago and still paid: refundable, older than everything
--   and 110 forfeited no-shows of seeker2, paid 60 days ago, to fill the pages.

begin;
create extension if not exists pgtap with schema extensions;
select plan(69);

-- pgTAP's throws_ok sees an error's code and message, but not its hint, and the app tells
-- one refusal from another by the hint (design §2). This runs a statement as the current
-- role and returns '<code> <hint>' for the error it raises.
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  v_code text;
  v_hint text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_code = returned_sqlstate, v_hint = pg_exception_hint;
  return v_code || ' ' || coalesce(nullif(v_hint, ''), '(no hint)');
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures, as postgres
-- ---------------------------------------------------------------------------
set local role postgres;

-- Clear seeded reservations/payments inside this rolled-back transaction so the
-- global admin_payment_records counts and paging checks below cover only this
-- file's fixtures (TSK-13.2 seeds two completed visits on Kapihan Study Hall).
delete from public.reservations;

insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token, checked_in_at, checked_out_at, ended_at
) values
  ('14000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'S1',
   'reserved', interval '60 minutes', now() - interval '61 minutes', now() + interval '30 minutes',
   'RFND00000001', null, null, null),
  ('14000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'S4',
   'cancelled', interval '60 minutes', now() - interval '121 minutes', null,
   null, null, null, now() - interval '100 minutes'),
  ('14000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 'S5',
   'expired', interval '30 minutes', now() - interval '40 minutes', null,
   null, null, null, now() - interval '40 minutes'),
  ('14000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000006', 'S6',
   'no_show', interval '60 minutes', now() - interval '181 minutes', now() - interval '121 minutes',
   'RFND00000004', null, null, now() - interval '121 minutes'),
  ('14000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007', 'S7',
   'cancelled', interval '60 minutes', now() - interval '241 minutes', now() - interval '181 minutes',
   'RFND00000005', null, null, now() - interval '230 minutes'),
  ('14000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000008', 'S8',
   'completed', interval '60 minutes', now() - interval '301 minutes', now() - interval '241 minutes',
   'RFND00000006', now() - interval '280 minutes', now() - interval '200 minutes',
   now() - interval '200 minutes'),
  ('14000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'S2',
   'reserved', interval '60 minutes', now() - interval '11 minutes', now() + interval '50 minutes',
   'RFND00000007', null, null, null),
  ('14000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'D1',
   'expired', interval '30 minutes', now() - interval '6 hours', null,
   null, null, null, now() - interval '6 hours'),
  ('14000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', null, 'S1',
   'cancelled', interval '60 minutes', now() - interval '90 days', null,
   null, null, null, now() - interval '90 days' + interval '30 minutes');

insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at
) values
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001',
   'paid', 5000, 'cs_test_14_01', 'pi_test_14_01', now() - interval '1 hour'),
  ('24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002',
   'paid', 5000, 'cs_test_14_02', 'pi_test_14_02', now() - interval '2 hours'),
  ('24000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000003',
   'pending', 5000, 'cs_test_14_03', null, null),
  ('24000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000004',
   'forfeited', 5000, 'cs_test_14_04', 'pi_test_14_04', now() - interval '3 hours'),
  ('24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000005',
   'forfeited', 5000, 'cs_test_14_05', 'pi_test_14_05', now() - interval '4 hours'),
  ('24000000-0000-4000-8000-000000000006', '14000000-0000-4000-8000-000000000006',
   'paid', 5000, 'cs_test_14_06', 'pi_test_14_06', now() - interval '5 hours'),
  ('24000000-0000-4000-8000-000000000007', '14000000-0000-4000-8000-000000000007',
   'paid', 5000, 'cs_test_14_07', 'pi_test_14_07', now() - interval '10 minutes'),
  ('24000000-0000-4000-8000-000000000009', '14000000-0000-4000-8000-000000000009',
   'pending', 5000, 'cs_test_14_09', null, null),
  ('24000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000010',
   'paid', 5000, 'cs_test_14_10', 'pi_test_14_10', now() - interval '90 days');

-- 110 older forfeited fees, so the pages have more than 101 rows
insert into public.reservations (
  seeker_id, space_id, unit_id, unit_label, status, wait_window, payment_window_ends_at, ended_at
)
select 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', null,
  'Bulk ' || n, 'no_show', interval '60 minutes',
  now() - interval '60 days' - n * interval '1 minute',
  now() - interval '60 days' - n * interval '1 minute' + interval '1 hour'
from generate_series(1, 110) as n;

insert into public.payments (reservation_id, status, fee_amount, external_payment_id, paid_at)
select r.id, 'forfeited', 5000, 'pi_test_14_bulk_' || substr(r.unit_label, 6), r.payment_window_ends_at
from public.reservations r
where r.unit_label like 'Bulk %';

-- 01: the Host overrides the paid hold (R9), and the fee stays paid
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$select public.set_unit_state(
    'f0000000-0000-4000-8000-000000000001', 'available',
    '14000000-0000-4000-8000-000000000001', 'reserved'
  )$$,
  'fixture: the Host overrides seeker''s paid hold on S1 (R9)'
);

-- 03: the payment arrives after the hold expired (P2): paid, and the hold stays expired
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select is(
  public.confirm_payment(
    '14000000-0000-4000-8000-000000000003', 'cs_test_14_03', 'pi_test_14_03'
  ) ->> 'outcome',
  'late_payment',
  'fixture: the webhook confirms the expired hold''s payment late (P2)'
);

-- 08: seeker's next hold, whose wait window has lapsed without the lapse being recorded
set local role postgres;
insert into public.reservations (
  id, seeker_id, space_id, unit_id, unit_label, status, wait_window,
  payment_window_ends_at, wait_window_ends_at, booking_token
) values (
  '14000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'S3',
  'reserved', interval '15 minutes', now() - interval '21 minutes', now() - interval '5 minutes',
  'RFND00000008'
);
insert into public.payments (
  id, reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at
) values (
  '24000000-0000-4000-8000-000000000008', '14000000-0000-4000-8000-000000000008',
  'paid', 5000, 'cs_test_14_08', 'pi_test_14_08', now() - interval '20 minutes'
);

-- ---------------------------------------------------------------------------
-- 1. Only Administrators run the refund functions (design §2, D-053)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', 'A reason')$$,
  '42501', null,
  'a signed-out visitor cannot run record_refund'
);
select throws_ok(
  $$select * from public.admin_payment_records()$$,
  '42501', null,
  'a signed-out visitor cannot run admin_payment_records'
);
select throws_ok(
  $$select private.is_refundable('24000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'a signed-out visitor cannot run private.is_refundable'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', 'A reason')$$,
  '42501', null,
  'a Seeker cannot record a refund, of their own fee either'
);
select throws_ok(
  $$select * from public.admin_payment_records()$$,
  '42501', null,
  'a Seeker cannot run admin_payment_records'
);
select throws_ok(
  $$select private.is_refundable('24000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'a Seeker cannot run private.is_refundable'
);
select throws_ok(
  $$update public.payments
    set status = 'refunded', refund_id = 're_test_self', refunded_at = now(), refund_reason = 'Mine'
    where id = '24000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'a Seeker cannot refund their own payment by writing to it (N6)'
);

set local request.jwt.claims =
  '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', 'A reason')$$,
  '42501', null,
  'a Host cannot record a refund, for their own Space either'
);
select throws_ok(
  $$select * from public.admin_payment_records()$$,
  '42501', null,
  'a Host cannot run admin_payment_records'
);
select throws_ok(
  $$select private.is_refundable('24000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'a Host cannot run private.is_refundable'
);

set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select private.is_refundable('24000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'an Administrator cannot run private.is_refundable: only the two functions use it'
);
select throws_ok(
  $$select * from public.payments$$,
  '42501', null,
  'an Administrator reads payments only through admin_payment_records, never directly'
);
select throws_ok(
  $$update public.payments
    set status = 'refunded', refund_id = 're_test_direct', refunded_at = now(), refund_reason = 'Direct'
    where id = '24000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'an Administrator cannot refund by writing to payments directly'
);

set local role postgres;

select is_empty(
  $$select g.rolname, c.col, k.privilege
    from (values ('anon'), ('authenticated')) as g (rolname)
    cross join (values ('refund_id'), ('refunded_at'), ('refunded_by'), ('refund_reason')) as c (col)
    cross join (values ('select'), ('insert'), ('update'), ('references')) as k (privilege)
    where has_column_privilege(g.rolname, 'public.payments', c.col, k.privilege)$$,
  'the refund columns have no grants: nobody but the functions reads or writes them (N6)'
);

-- ---------------------------------------------------------------------------
-- 2. Which fees can be refunded: private.is_refundable (D-088)
-- ---------------------------------------------------------------------------
select ok(
  private.is_refundable('24000000-0000-4000-8000-000000000001'),
  'a Host''s override leaves a refundable fee (R9)'
);
select ok(
  private.is_refundable('24000000-0000-4000-8000-000000000002'),
  'a take-down leaves a refundable fee (R14, D-085)'
);
select ok(
  private.is_refundable('24000000-0000-4000-8000-000000000003'),
  'a late payment on an expired hold leaves a refundable fee (P2)'
);
select is(
  array(
    select v.id
    from (values
      ('24000000-0000-4000-8000-000000000004'::uuid),
      ('24000000-0000-4000-8000-000000000005'::uuid),
      ('24000000-0000-4000-8000-000000000006'::uuid),
      ('24000000-0000-4000-8000-000000000007'::uuid),
      ('24000000-0000-4000-8000-000000000008'::uuid),
      ('24000000-0000-4000-8000-000000000009'::uuid)
    ) as v (id)
    where private.is_refundable(v.id)
  ),
  '{}'::uuid[],
  'forfeited fees (R7, R8), a completed visit''s fee, active holds'' fees and an unpaid fee are not refundable'
);
select ok(
  not private.is_refundable('24000000-0000-4000-8000-999999999999'),
  'a payment that doesn''t exist is not refundable'
);

-- ---------------------------------------------------------------------------
-- 3. admin_payment_records records lapses first (D-047)
-- ---------------------------------------------------------------------------
select is(
  (select status::text from public.payments where id = '24000000-0000-4000-8000-000000000008'),
  'paid',
  'before the read, the lapsed wait window''s fee still reads paid'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select payment_status::text || ' ' || reservation_status::text
   from public.admin_payment_records(p_payment_id => '24000000-0000-4000-8000-000000000008')),
  'forfeited no_show',
  'admin_payment_records reads a lapsed wait window''s fee as forfeited (R7)'
);

-- ---------------------------------------------------------------------------
-- 4. admin_payment_records lists, filters and pages (design §2)
-- ---------------------------------------------------------------------------
select is(
  array(select payment_id from public.admin_payment_records(p_page_size => 8)),
  array[
    '24000000-0000-4000-8000-000000000003',
    '24000000-0000-4000-8000-000000000007',
    '24000000-0000-4000-8000-000000000008',
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002',
    '24000000-0000-4000-8000-000000000004',
    '24000000-0000-4000-8000-000000000005',
    '24000000-0000-4000-8000-000000000006'
  ]::uuid[],
  'admin_payment_records lists paid, forfeited and refunded payments, newest payment first'
);
select is(
  (select count(*)::integer from public.admin_payment_records(p_page_size => 101))
    + (select count(*)::integer from public.admin_payment_records(p_page_size => 101, p_page_offset => 101)),
  119,
  'its pages hold every payment where money moved, 119 of them, and neither unpaid fee'
);
select is(
  (array(select payment_id from public.admin_payment_records(p_page_size => 101, p_page_offset => 101)))[18],
  '24000000-0000-4000-8000-000000000010'::uuid,
  'the oldest payment comes last'
);
select is_empty(
  $$select 1 from public.admin_payment_records(p_payment_id => '24000000-0000-4000-8000-000000000009')$$,
  'admin_payment_records never returns a pending payment, even asked for it by id'
);
select results_eq(
  $$select payment_status::text, fee_amount, payment_intent_id, reservation_id, reservation_status::text,
      unit_label, checked_in_at is null, ended_at is not null, space_id, space_name, seeker_full_name,
      refund_id is null, refundable
    from public.admin_payment_records(p_payment_id => '24000000-0000-4000-8000-000000000001')$$,
  $$values ('paid', 5000, 'pi_test_14_01', '14000000-0000-4000-8000-000000000001'::uuid, 'cancelled',
      'S1', true, true, 'e0000000-0000-4000-8000-000000000001'::uuid, 'Kapihan Study Hall',
      'Sam Dela Cruz', true, true)$$,
  'p_payment_id reads one payment, with its reservation, Space and Seeker'
);
select is(
  array(select payment_id from public.admin_payment_records(p_page_size => 8) where refundable),
  array[
    '24000000-0000-4000-8000-000000000003',
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002'
  ]::uuid[],
  'a Host''s override, a take-down and a late payment each read refundable, and no other fee does'
);
select is(
  array(select payment_id from public.admin_payment_records(p_status => 'paid', p_page_size => 101)),
  array[
    '24000000-0000-4000-8000-000000000003',
    '24000000-0000-4000-8000-000000000007',
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002',
    '24000000-0000-4000-8000-000000000006',
    '24000000-0000-4000-8000-000000000010'
  ]::uuid[],
  'p_status paid lists only paid payments'
);
select is(
  array(select payment_id from public.admin_payment_records(p_status => 'forfeited', p_page_size => 3)),
  array[
    '24000000-0000-4000-8000-000000000008',
    '24000000-0000-4000-8000-000000000004',
    '24000000-0000-4000-8000-000000000005'
  ]::uuid[],
  'p_status forfeited lists forfeited payments, newest first'
);
select is(
  array(select distinct payment_status::text from public.admin_payment_records(p_status => 'forfeited', p_page_size => 101)),
  array['forfeited'],
  'p_status forfeited lists nothing else'
);
select is(
  pg_temp.refusal($$select * from public.admin_payment_records(p_status => 'pending')$$),
  'P0001 invalid_status',
  'admin_payment_records refuses to list pending payments'
);
select is(
  array(select payment_id from public.admin_payment_records(p_refundable_only => true)),
  array[
    '24000000-0000-4000-8000-000000000003',
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002',
    '24000000-0000-4000-8000-000000000010'
  ]::uuid[],
  'admin_payment_records with p_refundable_only lists only refundable fees, older ones included'
);
select ok(
  not exists (
    select 1 from public.admin_payment_records()
    where payment_id = '24000000-0000-4000-8000-000000000010'
  ),
  'without p_refundable_only, the 90-day-old refundable fee is behind newer payments'
);
select is(
  (select count(*)::integer from public.admin_payment_records(p_page_size => 500)),
  101,
  'admin_payment_records clamps a page size of 500 to 101'
);
select is(
  (select count(*)::integer from public.admin_payment_records(p_page_size => 0)),
  1,
  'admin_payment_records clamps a page size of 0 to 1'
);
select is(
  (select count(*)::integer from public.admin_payment_records(p_page_size => null)),
  25,
  'a null page size reads the default 25'
);
select is(
  array(select payment_id from public.admin_payment_records(p_page_size => 3, p_page_offset => -10)),
  array(select payment_id from public.admin_payment_records(p_page_size => 3)),
  'admin_payment_records reads a negative offset as 0, from the first'
);

-- ---------------------------------------------------------------------------
-- 5. record_refund: P1, and its refusals (design §2, D-088)
-- ---------------------------------------------------------------------------
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 'ch_test_14_02', 'A reason')$$),
  'P0001 invalid_refund_id',
  'a refund needs a re_ refund id: not a charge id'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', null, 'A reason')$$),
  'P0001 invalid_refund_id',
  'a refund needs a re_ refund id: not none'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_', 'A reason')$$),
  'P0001 invalid_refund_id',
  'a refund needs a re_ refund id: not the prefix alone'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', '')$$),
  'P0001 invalid_reason',
  'a refund needs a reason: not an empty one'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', E'  \n\t  ')$$),
  'P0001 invalid_reason',
  'a refund needs a reason: not one that is only spaces and line breaks'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', null)$$),
  'P0001 invalid_reason',
  'a refund needs a reason: not none'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000002', 're_test_14_02', repeat('x', 301))$$),
  'P0001 invalid_reason',
  'a refund needs a reason of at most 300 characters'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000004', 're_test_14_04', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund a no-show''s forfeited fee (R7)'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000005', 're_test_14_05', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund a fee forfeited by the Seeker''s own cancel (R8)'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000006', 're_test_14_06', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund a completed visit''s fee'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000007', 're_test_14_07', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund an active hold''s fee'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000009', 're_test_14_09', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund a fee that was never paid'
);
select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-999999999999', 're_test_14_99', 'A reason')$$),
  'P0001 not_refundable',
  'an Administrator cannot refund a payment that doesn''t exist'
);

set local role postgres;

select results_eq(
  $$select status::text, refund_id, refunded_at, refunded_by, refund_reason
    from public.payments where id = '24000000-0000-4000-8000-000000000002'$$,
  $$values ('paid', null::text, null::timestamptz, null::uuid, null::text)$$,
  'every refusal left the take-down''s fee paid, with no refund recorded'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  public.record_refund(
    '24000000-0000-4000-8000-000000000001', 're_test_14_01', '  The Host closed the zone for repairs.  '
  ) ->> 'payment_status',
  'refunded',
  'P1: an Administrator refunds a paid fee whose hold ended without a check-in'
);

set local role postgres;

select results_eq(
  $$select status::text, refund_id, refunded_at is not null, refunded_by, refund_reason
    from public.payments where id = '24000000-0000-4000-8000-000000000001'$$,
  $$values ('refunded', 're_test_14_01', true, 'a0000000-0000-4000-8000-000000000001'::uuid,
      'The Host closed the zone for repairs.')$$,
  'a refund records Stripe''s refund id, who made it, when and why, the reason trimmed'
);
select is(
  (select status::text from public.reservations where id = '14000000-0000-4000-8000-000000000001'),
  'cancelled',
  'the refund leaves its reservation as it ended (N11)'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  pg_temp.refusal($$select public.record_refund('24000000-0000-4000-8000-000000000001', 're_test_14_01', 'Again')$$),
  'P0001 already_refunded',
  'an Administrator cannot refund a fee twice'
);
select results_eq(
  $$select payment_status::text, refund_id, refunded_by, refunded_by_full_name, refund_reason, refundable
    from public.admin_payment_records(p_payment_id => '24000000-0000-4000-8000-000000000001')$$,
  $$values ('refunded', 're_test_14_01', 'a0000000-0000-4000-8000-000000000001'::uuid, 'Alma Reyes',
      'The Host closed the zone for repairs.', false)$$,
  'admin_payment_records reads the refund: its id, who made it and why, and no longer refundable'
);
select is(
  public.record_refund(
    '24000000-0000-4000-8000-000000000002', 're_test_14_02', '  ' || repeat('a', 300) || E'\n'
  ) ->> 'payment_status',
  'refunded',
  'a reason of 300 characters once trimmed is accepted'
);
select is(
  public.record_refund(
    '24000000-0000-4000-8000-000000000003', 're_test_14_03', 'Paid after the hold expired.'
  ) ->> 'payment_status',
  'refunded',
  'a late payment on an expired hold is refunded (P2, then P1)'
);
select throws_ok(
  $$select public.record_refund('24000000-0000-4000-8000-000000000010', 're_test_14_01', 'A reason')$$,
  '23505', null,
  'one Stripe refund cannot be recorded on two payments'
);
select is(
  array(select payment_id from public.admin_payment_records(p_status => 'refunded')),
  array[
    '24000000-0000-4000-8000-000000000003',
    '24000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000002'
  ]::uuid[],
  'p_status refunded lists the refunded payments, newest payment first'
);
select is(
  array(select payment_id from public.admin_payment_records(p_refundable_only => true)),
  array['24000000-0000-4000-8000-000000000010']::uuid[],
  'a refunded fee leaves the refundable list'
);

-- ---------------------------------------------------------------------------
-- 6. The table's own check (design §2)
-- ---------------------------------------------------------------------------
set local role postgres;

select is(
  (select char_length(refund_reason) from public.payments where id = '24000000-0000-4000-8000-000000000002'),
  300,
  'the 300-character reason is stored trimmed'
);
select throws_ok(
  $$update public.payments set status = 'refunded' where id = '24000000-0000-4000-8000-000000000010'$$,
  '23514', null,
  'a refunded payment needs its refund id, time and reason, whoever writes it'
);
select throws_ok(
  $$update public.payments
    set refund_id = 're_test_14_10', refunded_at = now(), refund_reason = 'Not refunded'
    where id = '24000000-0000-4000-8000-000000000010'$$,
  '23514', null,
  'a payment that isn''t refunded has no refund id, time or reason'
);

-- ---------------------------------------------------------------------------
-- 7. What the Seeker sees (design §0)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select status::text || ' ' || payment_status::text
   from public.my_reservation('14000000-0000-4000-8000-000000000001')),
  'cancelled refunded',
  'a Seeker''s own reservation reads a refunded payment as refunded'
);

set local request.jwt.claims =
  '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(
  (select status::text || ' ' || payment_status::text
   from public.my_reservation('14000000-0000-4000-8000-000000000003')),
  'expired refunded',
  'a Seeker''s expired hold reads its refunded late payment as refunded (P2)'
);

-- ---------------------------------------------------------------------------
-- 8. A deleted Administrator's refunds stay refunded
-- ---------------------------------------------------------------------------
set local role postgres;

delete from auth.users where id = 'a0000000-0000-4000-8000-000000000001';

select results_eq(
  $$select status::text, refund_id, refunded_by
    from public.payments where id = '24000000-0000-4000-8000-000000000001'$$,
  $$values ('refunded', 're_test_14_01', null::uuid)$$,
  'deleting the Administrator''s account keeps the refund, with refunded_by null'
);

select * from finish();
rollback;
