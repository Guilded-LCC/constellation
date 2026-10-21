-- Lets the client show the forced-rename screen without widening profile reads.
create or replace function public.app_must_rename()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select must_rename from profiles where id = auth.uid()), false);
$$;

revoke all on function public.app_must_rename() from public, anon;
grant execute on function public.app_must_rename() to authenticated;
