-- Recover uploaders for attachments created before uploader tracking existed by
-- reading the storage object owner, then expose richer public profiles.

update public.message_attachments a
set uploaded_by = o.owner_id::uuid
from storage.objects o
where o.bucket_id = 'attachments'
  and o.name = a.storage_path
  and a.uploaded_by is null
  and o.owner_id is not null
  and o.owner_id ~ '^[0-9a-fA-F-]{36}$';

create or replace function public.app_public_profile(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'name', p.name,
    'bio', p.bio,
    'avatar', p.avatar,
    'avatar_url', p.avatar_url,
    'banner_url', p.banner_url,
    'status', p.status,
    'custom_status', p.custom_status,
    'custom_status_emoji', p.custom_status_emoji,
    'is_bot', coalesce(p.is_bot, false),
    'created_at', p.created_at,
    'badges', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'name', b.name, 'icon_url', b.icon_url)
        order by b.position, b.id)
      from public.profile_badges pb
      join public.staff_badges b on b.id = pb.badge
      where pb.user_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = p_user
$$;

create or replace function public.app_user_profile(p_user uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path=public as $$
declare target uuid := coalesce(p_user, auth.uid()); profile jsonb; shared integer;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  profile := public.app_public_profile(target);
  if profile is null then raise exception 'User not found'; end if;

  select count(*) into shared
  from public.servers s
  join public.members tm on tm.server_id = s.id and tm.user_id = target
  where exists (select 1 from public.members vm where vm.server_id = s.id and vm.user_id = auth.uid());

  return profile || jsonb_build_object(
    'mutual_count', shared,
    'mutual_servers', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'avatar_url', s.avatar_url) order by s.name)
      from public.servers s
      join public.members tm on tm.server_id = s.id and tm.user_id = target
      where exists (select 1 from public.members vm where vm.server_id = s.id and vm.user_id = auth.uid())
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.app_user_profile(uuid) from public, anon;
grant execute on function public.app_user_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
