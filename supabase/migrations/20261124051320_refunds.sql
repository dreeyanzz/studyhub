-- STORY-14, TSK-14.2: sandbox refunds. Four refund columns on payments,
-- private.is_refundable, public.record_refund and public.admin_payment_records.
-- Design: docs/design/STORY-14-admin-console.md §2 (FR-5.3, D-047, D-085, D-088). It
-- makes the reservation lifecycle's P1, a payment going from paid to refunded. Never
-- edit this file once applied; add a new migration instead.

-- 1. The refund columns on payments (design §2). No role is granted any column of
--    payments, as before (the reservation lifecycle's N6): every read and write goes
--    through a function.
alter table public.payments
  add column refund_id text unique,
  add column refunded_at timestamptz,
  add column refunded_by uuid references public.profiles (id) on delete set null,
  add column refund_reason text;

comment on column public.payments.refund_id is
  'Stripe''s refund id (re_...), set when an Administrator refunds the fee. STORY-14 (D-088).';
comment on column public.payments.refunded_at is
  'When the refund was recorded. STORY-14 (D-088).';
comment on column public.payments.refunded_by is
  'The Administrator who refunded the fee. Null afterwards if that account is deleted. STORY-14 (D-088).';
comment on column public.payments.refund_reason is
  'The Administrator''s reason, 1 to 300 characters after trimming. Only Administrators read it. STORY-14 (D-088).';

-- The refund id, the time and the reason are set exactly when the payment is refunded.
-- refunded_by may go null afterwards (on delete set null), but is never set otherwise.
alter table public.payments
  add constraint payments_refund_fields
    check (
      (
        status = 'refunded'
        and refund_id is not null
        and refunded_at is not null
        and refund_reason is not null
      )
      or (
        status <> 'refunded'
        and refund_id is null
        and refunded_at is null
        and refunded_by is null
        and refund_reason is null
      )
    ),
  add constraint payments_refund_id_format
    check (refund_id ~ '^re_[A-Za-z0-9_]+$'),
  add constraint payments_refund_reason_length
    check (
      char_length(regexp_replace(refund_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
        between 1 and 300
    );

-- Deleting an Administrator's profile sets refunded_by to null on their refunds.
create index payments_refunded_by_idx on public.payments (refunded_by);

-- 2. private.is_refundable(payment_id): which fees can be refunded (D-088). A payment is
--    refundable when it is paid and its reservation ended without a check-in: a Host's
--    override (R9), a take-down (R14, D-085) or a payment after its hold ended (P2). An
--    ended reservation never moves again (N11), so the answer can't change under a
--    refund. A forfeited fee (R7, R8), a visit that happened and an active hold's fee
--    are not refundable.
create or replace function private.is_refundable(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payments p
    join public.reservations r on r.id = p.reservation_id
    where p.id = p_payment_id
      and p.status = 'paid'
      and r.status in ('cancelled', 'expired')
      and r.checked_in_at is null
  );
$$;

comment on function private.is_refundable(uuid) is
  'True when a payment is paid and its reservation was cancelled or expired with no check-in (R9, R14, P2). STORY-14 (D-088).';

revoke all on function private.is_refundable(uuid) from public, anon, authenticated;

-- 3. public.record_refund(payment_id, refund_id, reason): P1, after Stripe accepted the
--    refund (design §1, D-088). Only Administrators. It locks the payment alone: the
--    reservation it reads has ended and can't move, so the reservation lifecycle's lock
--    order (unit, reservation, payment) holds.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_refund_id text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_status public.payment_status;
  v_reason text;
  v_now timestamptz;
begin
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;
  v_caller_id := (select auth.uid());

  -- 1. Lock the payment, so a second Administrator's refund waits and then reads it
  --    refunded.
  select p.status
  into v_status
  from public.payments p
  where p.id = p_payment_id
  for update;

  if v_status = 'refunded' then
    raise exception 'payment is already refunded'
      using errcode = 'P0001', hint = 'already_refunded';
  end if;

  -- 2. The rule again, under the lock (D-088). A missing payment isn't refundable either.
  if not private.is_refundable(p_payment_id) then
    raise exception 'payment cannot be refunded'
      using errcode = 'P0001', hint = 'not_refundable';
  end if;

  if p_refund_id is null or p_refund_id !~ '^re_[A-Za-z0-9_]+$' then
    raise exception 'not a Stripe refund id'
      using errcode = 'P0001', hint = 'invalid_refund_id';
  end if;

  -- Trimmed as the form's rule trims it (lib/validation/admin.ts).
  v_reason := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_reason is null or char_length(v_reason) not between 1 and 300 then
    raise exception 'a refund needs a reason of 1 to 300 characters'
      using errcode = 'P0001', hint = 'invalid_reason';
  end if;

  -- 3. P1: paid -> refunded, with Stripe's refund id, the time, the caller and why.
  v_now := clock_timestamp();

  update public.payments
  set status = 'refunded',
      refund_id = p_refund_id,
      refunded_at = v_now,
      refunded_by = v_caller_id,
      refund_reason = v_reason
  where id = p_payment_id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'payment_status', 'refunded',
    'refund_id', p_refund_id,
    'refunded_at', v_now
  );
end;
$$;

comment on function public.record_refund(uuid, text, text) is
  'Records an Administrator''s sandbox refund that Stripe accepted: P1, paid -> refunded. STORY-14 (FR-5.3, D-088).';

revoke all on function public.record_refund(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_refund(uuid, text, text) to authenticated;

-- 4. public.admin_payment_records(...): the Payments page's read (design §2). Only
--    Administrators. It records lapses first, so a fee a lapsed wait window forfeited
--    reads forfeited (D-047). It returns paid, forfeited and refunded payments, newest
--    first, and never pending ones: no money moved for those.
create or replace function public.admin_payment_records(
  p_status public.payment_status default null,
  p_refundable_only boolean default false,
  p_payment_id uuid default null,
  p_page_size integer default 25,
  p_page_offset integer default 0
)
returns table (
  payment_id uuid,
  payment_status public.payment_status,
  fee_amount integer,
  paid_at timestamptz,
  payment_intent_id text,
  refund_id text,
  refunded_at timestamptz,
  refunded_by uuid,
  refunded_by_full_name text,
  refund_reason text,
  reservation_id uuid,
  reservation_status public.reservation_status,
  unit_label text,
  checked_in_at timestamptz,
  ended_at timestamptz,
  space_id uuid,
  space_name text,
  seeker_full_name text,
  refundable boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unit_ids uuid[];
  v_refundable_only boolean;
  v_page_size integer;
  v_page_offset integer;
begin
  if not (select private.has_role('admin')) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('paid', 'forfeited', 'refunded') then
    raise exception 'the status filter is paid, forfeited or refunded'
      using errcode = 'P0001', hint = 'invalid_status';
  end if;

  v_refundable_only := coalesce(p_refundable_only, false);
  -- One more than the 100 the page shows at most, so it can tell whether there are more.
  v_page_size := greatest(1, least(coalesce(p_page_size, 25), 101));
  v_page_offset := greatest(0, coalesce(p_page_offset, 0));

  -- 1. Record lapses for every unit with an active hold (D-047).
  select coalesce(array_agg(distinct r.unit_id), '{}')
  into v_unit_ids
  from public.reservations r
  where r.status in ('pending_payment', 'reserved', 'occupied')
    and r.unit_id is not null;

  perform private.record_lapses(v_unit_ids);

  -- 2. Read. Administrators may read full names already (STORY-01's profiles policy).
  return query
  select
    p.id,
    p.status,
    p.fee_amount,
    p.paid_at,
    p.external_payment_id,
    p.refund_id,
    p.refunded_at,
    p.refunded_by,
    refunder.full_name,
    p.refund_reason,
    r.id,
    r.status,
    r.unit_label,
    r.checked_in_at,
    r.ended_at,
    s.id,
    s.name,
    seeker.full_name,
    private.is_refundable(p.id)
  from public.payments p
  join public.reservations r on r.id = p.reservation_id
  join public.spaces s on s.id = r.space_id
  join public.profiles seeker on seeker.id = r.seeker_id
  left join public.profiles refunder on refunder.id = p.refunded_by
  where p.status in ('paid', 'forfeited', 'refunded')
    and (p_status is null or p.status = p_status)
    and (p_payment_id is null or p.id = p_payment_id)
    and (not v_refundable_only or private.is_refundable(p.id))
  order by p.paid_at desc, p.id desc
  limit v_page_size
  offset v_page_offset;
end;
$$;

comment on function public.admin_payment_records(public.payment_status, boolean, uuid, integer, integer) is
  'Lists paid, forfeited and refunded payments for Administrators, newest first, each marked refundable or not. STORY-14 (FR-5.3, D-047, D-088).';

revoke all on function public.admin_payment_records(public.payment_status, boolean, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_payment_records(public.payment_status, boolean, uuid, integer, integer)
  to authenticated;
