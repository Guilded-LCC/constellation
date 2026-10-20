begin;
create table public.server_webhooks (
 id uuid primary key default gen_random_uuid(), server_id uuid not null references public.servers on delete cascade,
 channel_id uuid not null references public.channels on delete cascade, created_by uuid not null references public.profiles,
 name text not null check(length(trim(name)) between 1 and 50), token_hash text not null unique,
 created_at timestamptz not null default now(),last_used_at timestamptz
);
alter table public.server_webhooks enable row level security;
revoke all on public.server_webhooks from public,anon,authenticated;
create or replace function public.app_webhooks(p_server uuid,p_action text default 'read',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare token text; rid uuid; channel uuid:=nullif(p_data->>'channel','')::uuid;
begin
 if not app_has(p_server,'manage_webhooks') then raise exception 'You do not have permission to manage webhooks'; end if;
 if p_action='create' then
  if not exists(select 1 from channels where server_id=p_server and id=channel) or not app_access(channel,true) then raise exception 'Choose a channel you can post in'; end if;
  token:=encode(gen_random_bytes(32),'hex');
  insert into server_webhooks(server_id,channel_id,created_by,name,token_hash) values(p_server,channel,auth.uid(),trim(p_data->>'name'),encode(digest(token,'sha256'),'hex')) returning id into rid;
 elsif p_action='delete' then delete from server_webhooks where id=(p_data->>'id')::uuid and server_id=p_server;
 elsif p_action<>'read' then raise exception 'Unknown webhook operation'; end if;
 if p_action<>'read' then insert into audit(server_id,actor,action) values(p_server,auth.uid(),'webhook/'||p_action); end if;
 return jsonb_build_object('hooks',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'channel_id',w.channel_id,'created_at',w.created_at)) from server_webhooks w where w.server_id=p_server),'[]'::jsonb),'token',token,'id',rid);
end $$;
create or replace function public.app_webhook_post(p_token text,p_content text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare w server_webhooks%rowtype;c channels%rowtype;k categories%rowtype;allowed jsonb;mid uuid;
begin
 if length(p_token)<>64 then raise exception 'Invalid webhook'; end if;
 if length(trim(p_content)) not between 1 and 4000 then raise exception 'Message must contain 1–4000 characters'; end if;
 select * into w from server_webhooks where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception 'Invalid webhook'; end if;
 if w.last_used_at>clock_timestamp()-interval '1 second' then raise exception 'Please wait before sending another webhook message'; end if;
 select * into c from channels where id=w.channel_id;
 select * into k from categories where id=c.category_id;
 allowed:=case when c.allowed<>'[]' then c.allowed else coalesce(k.allowed,'[]') end;
 if not app_has(w.server_id,'manage_webhooks',w.created_by) or not app_has(w.server_id,'send_messages',w.created_by) or not app_has(w.server_id,'view_channels',w.created_by)
   or (c.readonly and not app_has(w.server_id,'manage_messages',w.created_by))
   or (allowed<>'[]' and not(app_permissions(w.server_id,w.created_by)?'administrator') and not exists(select 1 from member_roles where user_id=w.created_by and server_id=w.server_id and allowed?role_id::text))
 then raise exception 'The webhook no longer has access to this channel'; end if;
 insert into messages(channel_id,sender,body) values(w.channel_id,w.created_by,'['||w.name||' · webhook] '||trim(p_content)) returning id into mid;
 update server_webhooks set last_used_at=clock_timestamp() where id=w.id;
 return jsonb_build_object('id',mid);
end $$;
revoke execute on function public.app_webhooks(uuid,text,jsonb),public.app_webhook_post(text,text) from public,anon,authenticated;
grant execute on function public.app_webhooks(uuid,text,jsonb) to authenticated;
grant execute on function public.app_webhook_post(text,text) to anon,authenticated;
alter function public.app_state() rename to app_state_before_settings;
revoke execute on function public.app_state_before_settings() from public,anon,authenticated;
create function public.app_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare state jsonb; s jsonb; servers jsonb:='[]';latest jsonb;
begin
 state:=app_state_before_settings();
 for s in select value from jsonb_array_elements(state->'servers') loop
  select coalesce(jsonb_agg(x),'[]') into latest from (
   select m.id,left(m.body,240) body,extract(epoch from m.created_at) created,c.name channel,c.id channel_id,app_public_profile(m.sender) author
   from messages m join channels c on c.id=m.channel_id where c.server_id=(s->>'id')::uuid and c.readonly and app_access(c.id) order by m.created_at desc limit 3
  ) x;
  servers:=servers||jsonb_build_array(s||jsonb_build_object('announcements',latest));
 end loop;
 return jsonb_set(state,'{servers}',servers);
end $$;
revoke execute on function public.app_state() from public,anon;
grant execute on function public.app_state() to authenticated;
notify pgrst,'reload schema';
commit;
