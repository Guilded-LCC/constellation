-- Central server permission evaluator. Owner and Administrator bypass channel
-- allow-lists. All other permissions are OR-ed across Member and assigned roles.
create or replace function public.has_server_permission(
  p_server uuid, p_user uuid, p_permission text
) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare v_owner uuid; v_allowed boolean;
begin
  if p_server is null or p_user is null or p_permission is null then return false; end if;
  select owner into v_owner from servers where id=p_server;
  if not found then return false; end if;
  if v_owner=p_user then return true; end if;
  if not exists(select 1 from members where server_id=p_server and user_id=p_user) then return false; end if;
  select exists(
    select 1 from roles r
    where r.server_id=p_server
      and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=p_server and mr.user_id=p_user and mr.role_id=r.id))
      and r.permissions ? 'administrator'
  ) into v_allowed;
  if v_allowed then return true; end if;
  return exists(
    select 1 from roles r
    where r.server_id=p_server
      and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=p_server and mr.user_id=p_user and mr.role_id=r.id))
      and r.permissions ? p_permission
  );
end $$;
revoke all on function public.has_server_permission(uuid,uuid,text) from public,anon;
grant execute on function public.has_server_permission(uuid,uuid,text) to authenticated;

-- Existing checks delegate through the one evaluator used by policy helpers.
create or replace function public.app_permissions(p_server uuid,p_user uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path=public as $$
  select case when exists(select 1 from servers where id=p_server and owner=p_user)
    then '["administrator","view_channels","send_messages","upload_media","add_reactions","manage_messages","manage_channels","manage_roles","manage_server","kick_members","ban_members","create_invites","manage_groups","manage_emotes","manage_webhooks","view_audit","join_voice","speak","manage_voice","create_topics","reply_topics","manage_topics","create_docs","manage_docs","create_events","manage_events","manage_lists"]'::jsonb
    else coalesce((select jsonb_agg(distinct permission) from roles r
    left join lateral jsonb_array_elements_text(r.permissions) permission on true
    where r.server_id=p_server and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=p_server and mr.user_id=p_user and mr.role_id=r.id))),'[]'::jsonb) end
$$;
create or replace function public.app_has(p_server uuid,p_permission text,p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_server_permission(p_server,p_user,p_permission)
$$;
create or replace function public.app_access(p_channel uuid,p_send boolean default false)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_server uuid; v_allowed jsonb; v_admin boolean; v_user uuid:=auth.uid();
begin
  select c.server_id,case when jsonb_array_length(c.allowed)>0 then c.allowed else coalesce(k.allowed,'[]'::jsonb) end
    into v_server,v_allowed from channels c left join categories k on k.id=c.category_id where c.id=p_channel;
  if v_server is null or v_user is null then return false; end if;
  if not public.has_server_permission(v_server,v_user,'view_channels') then return false; end if;
  v_admin:=public.has_server_permission(v_server,v_user,'administrator');
  if not v_admin and jsonb_array_length(v_allowed)>0 and not exists(
    select 1 from roles r where r.server_id=v_server and v_allowed ? r.id::text
      and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=v_server and mr.user_id=v_user and mr.role_id=r.id))
  ) then return false; end if;
  if p_send and (not public.has_server_permission(v_server,v_user,'send_messages')
    or (exists(select 1 from channels where id=p_channel and readonly) and not public.has_server_permission(v_server,v_user,'manage_messages'))) then return false; end if;
  return true;
end $$;

-- The message RPC is also a privileged data path; channel reads use the same
-- evaluator and allow-list logic as the Storage and feature-channel paths.
alter function public.app_messages(uuid,uuid) rename to app_messages_before_unified_permissions;
create or replace function public.app_messages(p_channel uuid default null,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_channel is not null and not public.app_access(p_channel) then
    raise exception 'You do not have access to this channel';
  end if;
  return public.app_messages_before_unified_permissions(p_channel,p_user);
end $$;
revoke all on function public.app_messages(uuid,uuid) from public,anon;
grant execute on function public.app_messages(uuid,uuid) to authenticated;

-- Existing roles gain reasonable defaults; users may subsequently disable them.
update roles r set permissions=(select coalesce(jsonb_agg(p order by p),'[]'::jsonb) from (
  select distinct value p from jsonb_array_elements_text(r.permissions || '["view_channels","send_messages","upload_media","add_reactions"]'::jsonb)
) x) where r.position=0;

-- Chat and storage checks use the same evaluator, while respecting channel access.
drop policy if exists "attachment uploads follow channel permission" on storage.objects;
create policy "attachment uploads follow channel permission" on storage.objects for insert to authenticated
with check (bucket_id='attachments' and (storage.foldername(name))[1]='channels'
  and public.app_access(((storage.foldername(name))[2])::uuid,true)
  and exists(select 1 from public.channels c where c.id=((storage.foldername(name))[2])::uuid
    and public.has_server_permission(c.server_id,auth.uid(),'upload_media')));

alter function public.app_api(text,jsonb) rename to app_api_before_unified_permissions;
create or replace function public.app_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_channel uuid:=nullif(p_payload->>'channel','')::uuid; v_server uuid; result jsonb;
begin
  if p_action='message/send' and v_channel is not null then
    if not public.app_access(v_channel,true) then raise exception 'You cannot send in this channel'; end if;
  end if;
  if p_action='message/react' then
    select c.server_id into v_server from messages m join channels c on c.id=m.channel_id where m.id=nullif(p_payload->>'id','')::uuid;
    if v_server is not null and not public.has_server_permission(v_server,auth.uid(),'add_reactions') then raise exception 'You cannot add reactions here'; end if;
  end if;
  result:=public.app_api_before_unified_permissions(p_action,p_payload);
  if p_action='server/create' then
    update roles set permissions=(select coalesce(jsonb_agg(p order by p),'[]'::jsonb) from (select distinct value p from jsonb_array_elements_text(permissions || '["view_channels","send_messages","upload_media","add_reactions"]'::jsonb)) x)
      where server_id=(result->>'id')::uuid and position=0;
  end if;
  return result;
end $$;
revoke all on function public.app_api(text,jsonb) from public,anon;
grant execute on function public.app_api(text,jsonb) to authenticated;

alter function public.app_feature_api(text,jsonb) rename to app_feature_api_before_unified_permissions;
create or replace function public.app_feature_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_channel uuid:=nullif(p_payload->>'channel','')::uuid; v_server uuid;
begin
  if p_action='attachment/create' then
    select server_id into v_server from channels where id=v_channel;
    if not public.app_access(v_channel,true) or not public.has_server_permission(v_server,auth.uid(),'upload_media') then
      raise exception 'You do not have permission to upload files in this channel';
    end if;
  end if;
  return public.app_feature_api_before_unified_permissions(p_action,p_payload);
end $$;
revoke all on function public.app_feature_api(text,jsonb) from public,anon;
grant execute on function public.app_feature_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
