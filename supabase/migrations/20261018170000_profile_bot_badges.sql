alter table public.profiles
  add column if not exists is_bot boolean not null default false;

create or replace function public.guard_profile_is_bot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service_role boolean := coalesce(auth.jwt()->>'role' = 'service_role', false);
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_bot, false)
      and not coalesce(public.is_platform_staff(), false)
      and not coalesce(is_service_role, false) then
      raise exception using errcode = '42501', message = 'Only platform staff can assign the bot badge';
    end if;
    return new;
  end if;

  if new.is_bot is distinct from old.is_bot
    and not coalesce(public.is_platform_staff(), false)
    and not coalesce(is_service_role, false) then
    raise exception using errcode = '42501', message = 'Only platform staff can change the bot badge';
  end if;
  return new;
end
$$;

drop trigger if exists profiles_guard_is_bot on public.profiles;
create trigger profiles_guard_is_bot
before insert or update of is_bot on public.profiles
for each row execute function public.guard_profile_is_bot();

create or replace function public.app_public_profile(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'name', p.name,
    'bio', p.bio,
    'avatar', p.avatar,
    'status', p.status,
    'is_bot', coalesce(p.is_bot, false)
  )
  from public.profiles p
  where p.id = p_user
$$;

create or replace function public.app_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  state jsonb;
  me uuid := auth.uid();
begin
  state := public.app_state_before_staff_suspensions();
  return jsonb_set(
    state,
    '{user}',
    coalesce(state->'user', '{}'::jsonb) || jsonb_build_object(
      'is_platform_staff', public.is_platform_staff(),
      'is_platform_admin', public.is_platform_admin(),
      'is_bot', coalesce((select p.is_bot from public.profiles p where p.id = me), false),
      'suspended_reason', (select s.reason from public.user_suspensions s where s.user_id = me)
    )
  );
end
$$;

notify pgrst, 'reload schema';
