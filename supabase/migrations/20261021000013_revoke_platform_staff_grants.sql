-- Staff data is only reachable through security-definer staff functions. Table
-- grants let PostgREST answer 200 with an empty list, which still discloses
-- that the endpoint exists and contradicts the staff-only contract.
revoke all on table public.platform_staff from public, anon, authenticated;
create or replace function public.app_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_staff();
$$;
revoke all on function public.app_is_staff() from public, anon;
grant execute on function public.app_is_staff() to authenticated;
