-- STORY-09, TSK-09.3: attach_checkout_session and confirm_payment.
-- Design: docs/design/STORY-09-reserve-now-holds.md §2.
-- Flow: docs/flows/sandbox-payment-confirmation.md §4 (W5 to W21).
-- Never edit this file once applied; add a new migration instead.

-- 1. public.attach_checkout_session(reservation_id, checkout_session_id, checkout_url)
--    The Seeker's Server Action stores the PayMongo checkout it made through this, because
--    a Seeker has no grant on payments (N6). Flow §4.2.
create or replace function public.attach_checkout_session(
  p_reservation_id uuid,
  p_checkout_session_id text,
  p_checkout_url text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unit_id uuid;
  v_seeker_id uuid;
  v_res_status public.reservation_status;
  v_payment_id uuid;
  v_payment_status public.payment_status;
  v_existing_session_id text;
  v_existing_url text;
begin
  if p_reservation_id is null
     or nullif(btrim(p_checkout_session_id), '') is null
     or nullif(btrim(p_checkout_url), '') is null then
    raise exception 'attach_checkout_session needs a reservation, a checkout session and its URL'
      using errcode = '22023';
  end if;

  -- 1. Only the hold's Seeker (W16). An unknown id gets the same refusal, so it says
  --    nothing about whose reservations exist. Read without a lock first (D-047).
  select r.unit_id, r.seeker_id
  into v_unit_id, v_seeker_id
  from public.reservations r
  where r.id = p_reservation_id;

  if v_seeker_id is null or v_seeker_id is distinct from (select auth.uid()) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 2. Locks the unit, records its lapses, then locks the reservation and the payment
  --    (D-047). Recording under the unit's lock means a payment window that passed while
  --    this call waited for the lock still reads expired.
  if v_unit_id is not null then
    perform 1 from public.units u where u.id = v_unit_id for update;
    perform private.record_lapses(array[v_unit_id]);
  end if;

  select r.status
  into v_res_status
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  select p.id, p.status, p.checkout_session_id, p.checkout_url
  into v_payment_id, v_payment_status, v_existing_session_id, v_existing_url
  from public.payments p
  where p.reservation_id = p_reservation_id
  for update;

  -- 3. Only an unpaid hold takes a checkout (W17). The Server Action expires the session
  --    it just made.
  if v_res_status is distinct from 'pending_payment'
     or v_payment_status is distinct from 'pending' then
    raise exception 'hold_ended'
      using errcode = 'P0001', hint = 'hold_ended';
  end if;

  -- 4. The first attach wins (W15). A second checkout changes nothing, and the Server
  --    Action expires it and redirects to the first. The same checkout sent again is
  --    still the first, so it reads as attached and the Server Action keeps it.
  if v_existing_session_id is not null then
    return jsonb_build_object(
      'attached', v_existing_session_id = p_checkout_session_id,
      'checkout_url', v_existing_url
    );
  end if;

  update public.payments
  set checkout_session_id = p_checkout_session_id,
      checkout_url = p_checkout_url
  where id = v_payment_id;

  return jsonb_build_object('attached', true, 'checkout_url', p_checkout_url);
end;
$$;

comment on function public.attach_checkout_session(uuid, text, text) is
  'Stores the first PayMongo checkout of the caller''s own unpaid hold. STORY-09 (W15 to W17, D-047).';

revoke all on function public.attach_checkout_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, text, text) to authenticated;

-- 2. public.confirm_payment(reservation_id, checkout_session_id, external_payment_id)
--    The payment webhook's call, with the secret key only (N7, D-010). Flow §4.1.
create or replace function public.confirm_payment(
  p_reservation_id uuid,
  p_checkout_session_id text,
  p_external_payment_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unit_id uuid;
  v_res_status public.reservation_status;
  v_wait_window interval;
  v_payment_id uuid;
  v_payment_status public.payment_status;
  v_now timestamptz;
  v_outcome text;
begin
  if p_reservation_id is null
     or nullif(btrim(p_checkout_session_id), '') is null
     or nullif(btrim(p_external_payment_id), '') is null then
    raise exception 'confirm_payment needs a reservation, a checkout session and a payment id'
      using errcode = '22023';
  end if;

  -- 1. An unknown reservation changes nothing (W21). Read without a lock (D-047).
  select r.unit_id
  into v_unit_id
  from public.reservations r
  where r.id = p_reservation_id;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- 2. Locks the unit, then records its lapses, so a payment window that has passed reads
  --    expired (W18), even one that passed while this call waited for the lock. A
  --    payment that comes late never reserves. An ended reservation whose unit was
  --    deleted has a null unit_id: no unit to lock and nothing to record (W20, D-052).
  if v_unit_id is not null then
    perform 1 from public.units u where u.id = v_unit_id for update;
    perform private.record_lapses(array[v_unit_id]);
  end if;

  -- 3. Locks the reservation, then the payment (D-047).
  select r.status, r.wait_window
  into v_res_status, v_wait_window
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    -- Deleted between the read and the lock, with its Space or its Seeker.
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select p.id, p.status
  into v_payment_id, v_payment_status
  from public.payments p
  where p.reservation_id = p_reservation_id
  for update;

  if v_payment_id is null then
    -- hold_unit inserts the payment with its reservation, so this can't arise.
    raise exception 'reservation % has no payment', p_reservation_id
      using errcode = 'XX000';
  end if;

  -- 4. Only a pending payment moves (W6, W19).
  if v_payment_status <> 'pending' then
    return jsonb_build_object(
      'outcome', 'already_processed',
      'reservation_status', v_res_status,
      'payment_status', v_payment_status
    );
  end if;

  v_now := clock_timestamp();

  -- 5. R2, a confirmed payment: the hold is reserved, its wait window starts, and it gets
  --    its booking token (D-004, D-059). P2, a late payment: the hold stays ended, and
  --    the payment is left for an Administrator's refund (D-064, STORY-14).
  if v_res_status = 'pending_payment' then
    update public.reservations
    set status = 'reserved',
        wait_window_ends_at = v_now + v_wait_window,
        booking_token = private.new_booking_token()
    where id = p_reservation_id;

    v_res_status := 'reserved';
    v_outcome := 'confirmed';
  elsif v_res_status in ('expired', 'cancelled') then
    v_outcome := 'late_payment';
  else
    -- No move leaves a pending payment on a reserved, occupied, no-show or completed
    -- reservation. The route answers 500.
    raise exception 'reservation % is % with a pending payment', p_reservation_id, v_res_status
      using errcode = 'XX000';
  end if;

  -- In case the Seeker's tab closed before attach_checkout_session ran, the delivered
  -- checkout fills an empty one. A stored one stays (flow §4.1).
  update public.payments
  set status = 'paid',
      external_payment_id = p_external_payment_id,
      paid_at = v_now,
      checkout_session_id = coalesce(checkout_session_id, p_checkout_session_id)
  where id = v_payment_id;

  return jsonb_build_object(
    'outcome', v_outcome,
    'reservation_status', v_res_status,
    'payment_status', 'paid'
  );
end;
$$;

comment on function public.confirm_payment(uuid, text, text) is
  'Confirms a sandbox payment from the PayMongo webhook: R2, or P2 for an ended hold. STORY-09 (W5 to W21, N7, D-047, D-064).';

revoke all on function public.confirm_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, text) to service_role;
