-- Allow service_role (SUPABASE_SECRET_KEY) to evaluate the wait-window CHECK
-- constraints on public.spaces and public.reservations during admin and demo
-- seed writes (D-097). Never edit this file once applied; add a new migration
-- instead.

grant usage on schema private to service_role;
grant execute on function private.is_valid_wait_window(interval) to service_role;
