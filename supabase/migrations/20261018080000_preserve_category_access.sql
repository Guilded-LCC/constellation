-- Removing a private category must not expose its child channels.
create or replace function public.preserve_category_access() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if old.allowed <> '[]'::jsonb then
    update channels set allowed=old.allowed
    where category_id=old.id and allowed='[]'::jsonb;
  end if;
  return old;
end $$;
drop trigger if exists preserve_access_on_category_delete on public.categories;
create trigger preserve_access_on_category_delete before delete on public.categories
for each row execute function public.preserve_category_access();
revoke execute on function public.preserve_category_access() from public,anon,authenticated;
