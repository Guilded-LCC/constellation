alter function public.app_messages(uuid,uuid) rename to app_messages_before_features;
create or replace function public.app_messages(p_channel uuid default null,p_user uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare payload jsonb; begin
 payload:=app_messages_before_features(p_channel,p_user);
 return coalesce((select jsonb_agg(m||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'type',a.content_type,'size',a.byte_size,'path',a.storage_path)) from message_attachments a where a.message_id=(m->>'id')::uuid),'[]'::jsonb)) order by ord) from jsonb_array_elements(payload) with ordinality x(m,ord)),'[]'::jsonb);
end $$;
alter function public.app_state() rename to app_state_before_features;
create or replace function public.app_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare payload jsonb; me uuid:=auth.uid(); badges jsonb; begin
 payload:=app_state_before_features();
 select coalesce(jsonb_agg(badge),'[]'::jsonb) into badges from profile_badges where user_id=me;
 return jsonb_set(payload,'{user}',coalesce(payload->'user','{}'::jsonb)||jsonb_build_object('badges',badges,'platform_staff',app_is_platform_admin(me)));
end $$;
revoke all on function public.app_messages(uuid,uuid),public.app_state() from public,anon;
grant execute on function public.app_messages(uuid,uuid),public.app_state() to authenticated;
notify pgrst,'reload schema';
