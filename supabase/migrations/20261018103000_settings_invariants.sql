begin;
alter table public.roles add constraint roles_nonnegative_position check(position between 0 and 10000);
alter table public.roles add constraint roles_unique_position unique(server_id,position) deferrable initially deferred;
create or replace function public.app_api(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare s uuid:=nullif(p_payload->>'server','')::uuid;result jsonb;
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 if p_action='server/join' and not exists(select 1 from invites where code=trim(p_payload->>'code') and (expires_at is null or expires_at>now())) then raise exception 'This invitation has expired or was revoked'; end if;
 if p_action='server/invite' then
  result:=app_settings(s,'invite/create',jsonb_build_object('hours',168));
  return jsonb_build_object('code',result->>'code');
 end if;
 return app_api_before_settings(p_action,p_payload);
end $$;
create or replace function public.app_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare state jsonb; s jsonb; servers jsonb:='[]';latest jsonb;log jsonb;
begin
 state:=app_state_before_settings();
 for s in select value from jsonb_array_elements(state->'servers') loop
  select coalesce(jsonb_agg(x),'[]') into latest from (
   select m.id,left(m.body,240) body,extract(epoch from m.created_at) created,c.name channel,c.id channel_id,app_public_profile(m.sender) author
   from messages m join channels c on c.id=m.channel_id where c.server_id=(s->>'id')::uuid and c.readonly and app_access(c.id) order by m.created_at desc limit 3
  ) x;
  log:='[]';
  if app_has((s->>'id')::uuid,'view_audit') or app_has((s->>'id')::uuid,'manage_server') then
   select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'server_id',a.server_id,'actor',a.actor,'action',a.action,'created',extract(epoch from a.created_at)) order by a.id desc),'[]') into log from (select * from audit where server_id=(s->>'id')::uuid order by id desc limit 100) a;
  end if;
  servers:=servers||jsonb_build_array(s||jsonb_build_object('announcements',latest,'audit',log));
 end loop;
 return jsonb_set(state,'{servers}',servers);
end $$;
-- Keep the webhook prefix within the existing 4,000-character message limit.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.app_webhook_post(text,text)'::regprocedure);
 definition:=replace(definition,'''[''||w.name||'' · webhook] ''||trim(p_content)','left(''[''||w.name||'' · webhook] ''||trim(p_content),4000)');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
