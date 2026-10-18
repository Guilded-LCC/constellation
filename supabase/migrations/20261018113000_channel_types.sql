alter function public.app_api(text,jsonb) rename to app_api_before_features;
create or replace function public.app_api(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); s uuid:=nullif(p_payload->>'server','')::uuid; v_id uuid:=nullif(p_payload->>'id','')::uuid; cat uuid:=nullif(p_payload->>'category_id','')::uuid; typ text:=upper(coalesce(p_payload->>'type','TEXT')); begin
 if p_action='channel/save' then
  if not app_has(s,'manage_channels') then raise exception 'Missing permission: manage_channels'; end if;
  if typ not in ('TEXT','VOICE','LIST','DOCS','CALENDAR','FORUM') then raise exception 'Invalid channel type'; end if;
  if cat is null then select id into cat from categories where server_id=s and name=left(coalesce(p_payload->>'category','Channels'),50) limit 1; end if;
  if v_id is null then insert into channels(server_id,name,type,topic,category,category_id,allowed,readonly) values(s,left(trim(p_payload->>'name'),60),typ,left(coalesce(p_payload->>'topic',''),300),coalesce((select name from categories where id=cat),'Channels'),cat,coalesce(p_payload->'allowed','[]'),coalesce((p_payload->>'readonly')::boolean,false)) returning id into v_id; else update channels set name=left(trim(p_payload->>'name'),60),type=typ,topic=left(coalesce(p_payload->>'topic',''),300),category_id=cat,category=coalesce((select name from categories where id=cat),category),allowed=coalesce(p_payload->'allowed','[]'),readonly=coalesce(p_payload->>'readonly'::text,'false')::boolean where channels.id=v_id and server_id=s; end if;
  return jsonb_build_object('id',v_id);
 end if;
 return app_api_before_features(p_action,p_payload);
end $$;
revoke all on function public.app_api(text,jsonb) from public,anon;
grant execute on function public.app_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
