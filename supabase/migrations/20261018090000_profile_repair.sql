-- Repair auth/profile ownership for accounts created before the app schema upgrade.
-- All app foreign keys intentionally point at public.profiles(id).
create or replace function public.ensure_profile(p_user uuid default auth.uid())
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  u auth.users%rowtype;
  v_username text;
  v_name text;
  v_base text;
  v_suffix text;
begin
  if p_user is null or (auth.uid() is not null and p_user <> auth.uid()) then raise exception 'Not authorized'; end if;
  select * into u from auth.users where id = p_user;
  if not found then raise exception 'Account not found'; end if;
  v_base := lower(regexp_replace(coalesce(nullif(trim(u.raw_user_meta_data->>'username'),''), split_part(coalesce(u.email,''),'@',1), 'member'), '[^a-z0-9_.-]', '-', 'g'));
  v_base := left(v_base, 24);
  if length(v_base) < 3 then v_base := 'member'; end if;
  v_username := v_base;
  if exists(select 1 from public.profiles p where p.username = v_username and p.id <> p_user) then
    v_suffix := substr(replace(p_user::text,'-',''),1,7);
    v_username := left(v_base, 24) || '-' || v_suffix;
  end if;
  v_name := left(coalesce(nullif(trim(u.raw_user_meta_data->>'name'),''), split_part(coalesce(u.email,''),'@',1), 'Member'), 40);
  insert into public.profiles(id, username, name, bio, avatar, status)
  values(p_user, v_username, v_name, '', '✨', 'online')
  on conflict (id) do update set
    username = coalesce(nullif(public.profiles.username,''), excluded.username),
    name = coalesce(nullif(public.profiles.name,''), excluded.name),
    status = coalesce(nullif(public.profiles.status,''), 'online');
  return (select p from public.profiles p where p.id = p_user);
end;
$$;

create or replace function public.new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_profile(new.id);
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users
for each row execute function public.new_profile();

-- Backfill every existing account without changing existing profile data.
do $$
declare u record;
begin
  for u in select id from auth.users where not exists(select 1 from public.profiles p where p.id = auth.users.id) loop
    -- Trigger auth.uid() is unavailable in a migration, so insert safely here.
    insert into public.profiles(id, username, name, bio, avatar, status)
    select u.id,
      left(coalesce(nullif(lower(regexp_replace(split_part(coalesce(a.email,''),'@',1),'[^a-z0-9_.-]','-','g')),''),'member') || '-' || substr(replace(u.id::text,'-',''),1,7),32),
      left(coalesce(nullif(split_part(coalesce(a.email,''),'@',1),''),'Member'),40), '', '✨', 'online'
    from auth.users a where a.id=u.id
    on conflict (id) do nothing;
  end loop;
end $$;

revoke all on function public.ensure_profile(uuid) from public, anon;
grant execute on function public.ensure_profile(uuid) to authenticated;
