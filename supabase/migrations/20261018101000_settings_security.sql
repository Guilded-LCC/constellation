begin;
create or replace function public.app_can_upload_settings(p_server uuid,p_kind text) returns boolean language sql stable security definer set search_path=public as $$
 select case when p_kind='role-icons' then app_has(p_server,'manage_roles') when p_kind='emotes' then app_has(p_server,'manage_emotes') else false end;
$$;
revoke execute on function public.app_can_upload_settings(uuid,text) from public,anon;
grant execute on function public.app_can_upload_settings(uuid,text) to authenticated;
drop policy "managers upload draft role icons" on storage.objects;
drop policy "managers upload emotes" on storage.objects;
create policy "managers upload draft role icons" on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers' and (storage.foldername(name))[3]='role-icons' and public.app_can_upload_settings(((storage.foldername(name))[2])::uuid,'role-icons'));
create policy "managers upload emotes" on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers' and (storage.foldername(name))[3]='emotes' and public.app_can_upload_settings(((storage.foldername(name))[2])::uuid,'emotes'));
alter function public.app_api(text,jsonb) rename to app_api_before_settings;
revoke execute on function public.app_api_before_settings(text,jsonb) from public,anon,authenticated;
create function public.app_api(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare s uuid:=nullif(p_payload->>'server','')::uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 if p_action='server/join' and not exists(select 1 from invites where code=trim(p_payload->>'code') and (expires_at is null or expires_at>now())) then raise exception 'This invitation has expired or was revoked'; end if;
 if p_action='server/invite' and exists(select 1 from servers where id=s and invite_policy='managers') and not app_has(s,'manage_server') then raise exception 'Only server managers may create invites'; end if;
 return app_api_before_settings(p_action,p_payload);
end $$;
revoke execute on function public.app_api(text,jsonb) from public,anon;
grant execute on function public.app_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
