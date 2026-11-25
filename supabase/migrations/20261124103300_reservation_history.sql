-- STORY-16, TSK-16.1: Seeker reservation history read function.
-- Implements docs/design/STORY-16-reservation-history.md §2 (D-047, D-052, D-055, D-080, D-081).
-- Never edit this file once applied; add a new migration instead.

create or replace function public.my_reservation_history(
  p_page_size integer default 20,
  p_page_offset integer default 0
)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  created_at timestamptz,
  checked_in_at timestamptz,
  ended_at timestamptz,
  space_id uuid,
  space_name text,
  space_listed boolean,
  unit_id uuid,
  unit_label text,
  payment_status public.payment_status,
  fee_amount integer,
  refunded_at timestamptz,
  review_id uuid,
  review_status public.review_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_page_size integer;
  v_page_offset integer;
  v_unit_ids uuid[];
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- One more than the 100 the page shows at most, so the page can tell whether there are more.
  v_page_size := greatest(1, least(coalesce(p_page_size, 20), 101));
  v_page_offset := greatest(0, coalesce(p_page_offset, 0));

  -- 1. Record lapses first for the units of the caller's active holds (D-047), so a
  --    hold whose wait window has lapsed reads as no_show with its fee forfeited.
  select coalesce(array_agg(distinct r.unit_id), '{}')
  into v_unit_ids
  from public.reservations r
  where r.seeker_id = v_caller_id
    and r.status in ('pending_payment', 'reserved', 'occupied')
    and r.unit_id is not null;

  if coalesce(array_length(v_unit_ids, 1), 0) > 0 then
    perform private.record_lapses(v_unit_ids);
  end if;

  -- 2. Return the caller's ended reservations whose payment isn't pending, newest first
  --    by when it was held.
  return query
  select
    r.id,
    r.status,
    r.created_at,
    r.checked_in_at,
    r.ended_at,
    s.id,
    s.name,
    (s.status = 'verified'),
    r.unit_id,
    r.unit_label,
    p.status,
    p.fee_amount,
    p.refunded_at,
    rv.id,
    rv.status
  from public.reservations r
  join public.payments p on p.reservation_id = r.id
  join public.spaces s on s.id = r.space_id
  left join public.reviews rv
    on rv.reservation_id = r.id
   and r.checked_in_at is not null
  where r.seeker_id = v_caller_id
    and r.status in ('expired', 'no_show', 'completed', 'cancelled')
    and p.status <> 'pending'
  order by r.created_at desc, r.id desc
  limit v_page_size
  offset v_page_offset;
end;
$$;

comment on function public.my_reservation_history(integer, integer) is
  'Returns the caller''s paid, ended reservations newest first, recording lapses first. STORY-16 (D-047, D-052, D-055, D-080, D-081).';

revoke all on function public.my_reservation_history(integer, integer)
  from public, anon, authenticated;
grant execute on function public.my_reservation_history(integer, integer)
  to authenticated;
