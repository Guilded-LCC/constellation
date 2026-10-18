begin;

create or replace function public.app_invite_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.invites%rowtype;
  result jsonb;
begin
  if coalesce(length(trim(p_code)), 0) not between 1 and 128 then
    raise exception 'This invitation is invalid or expired';
  end if;

  select * into invitation
  from public.invites
  where code = trim(p_code)
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'This invitation is invalid or expired'; end if;

  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'avatar_url', s.avatar_url,
    'member_count', (select count(*) from public.members m where m.server_id = s.id),
    'inviter_name', coalesce(p.name, p.username, 'A member'),
    'inviter_avatar', coalesce(p.avatar, '')
  ) into result
  from public.servers s
  left join public.profiles p on p.id = invitation.created_by
  where s.id = invitation.server_id;

  if result is null then raise exception 'This server is no longer available'; end if;
  return result;
end;
$$;

revoke all on function public.app_invite_preview(text) from public;
grant execute on function public.app_invite_preview(text) to anon, authenticated;
notify pgrst, 'reload schema';

commit;
