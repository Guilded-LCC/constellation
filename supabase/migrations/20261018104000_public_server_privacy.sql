begin;
create or replace function public.validate_member_invite() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()=new.user_id and not exists(select 1 from servers where id=new.server_id and (owner=auth.uid() or visibility='public')) and not exists(select 1 from invites where server_id=new.server_id and (expires_at is null or expires_at>now())) then raise exception 'This invitation has expired'; end if;
 return new;
end $$;
create or replace function public.app_discover_servers() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 return coalesce((select jsonb_agg(x) from (select s.id,s.name,s.description,s.avatar_url,(select count(*) from members m where m.server_id=s.id) member_count,app_member(s.id) joined from servers s where s.visibility='public' and not exists(select 1 from bans b where b.server_id=s.id and b.user_id=auth.uid()) order by s.name limit 100) x),'[]');
end $$;
create or replace function public.app_join_public_server(p_server uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 perform 1 from servers where id=p_server and visibility='public' for share;
 if not found then raise exception 'This server is private. Ask for an invitation.'; end if;
 if exists(select 1 from bans where server_id=p_server and user_id=auth.uid()) then raise exception 'You are banned from this server'; end if;
 insert into members(server_id,user_id) values(p_server,auth.uid()) on conflict do nothing;
 insert into audit(server_id,actor,action) values(p_server,auth.uid(),'Joined public server');
 return jsonb_build_object('id',p_server);
end $$;
revoke execute on function public.app_discover_servers(),public.app_join_public_server(uuid) from public,anon;
grant execute on function public.app_discover_servers(),public.app_join_public_server(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
