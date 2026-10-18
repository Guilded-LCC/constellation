alter table public.profiles
  add column if not exists custom_status text,
  add column if not exists custom_status_emoji text;

alter table public.profiles
  drop constraint if exists profiles_custom_status_length_check,
  add constraint profiles_custom_status_length_check
    check (custom_status is null or char_length(custom_status) <= 80),
  drop constraint if exists profiles_custom_status_emoji_length_check,
  add constraint profiles_custom_status_emoji_length_check
    check (custom_status_emoji is null or char_length(custom_status_emoji) <= 8);

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
    'custom_status', p.custom_status,
    'custom_status_emoji', p.custom_status_emoji,
    'is_bot', coalesce(p.is_bot, false)
  )
  from public.profiles p
  where p.id = p_user
$$;

create or replace function public.app_profile_status(p_text text, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  status_text text := nullif(left(trim(coalesce(p_text, '')), 80), '');
  status_emoji text := nullif(left(trim(coalesce(p_emoji, '')), 8), '');
begin
  if me is null then
    raise exception using errcode = '28000', message = 'Please sign in to update your status';
  end if;

  update public.profiles
  set custom_status = status_text,
      custom_status_emoji = status_emoji
  where id = me;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  return public.app_public_profile(me);
end
$$;

revoke all on function public.app_profile_status(text, text) from public, anon;
grant execute on function public.app_profile_status(text, text) to authenticated;

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
      'custom_status', (select p.custom_status from public.profiles p where p.id = me),
      'custom_status_emoji', (select p.custom_status_emoji from public.profiles p where p.id = me),
      'suspended_reason', (select s.reason from public.user_suspensions s where s.user_id = me)
    )
  );
end
$$;

notify pgrst, 'reload schema';
