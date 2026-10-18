create table if not exists public.message_replies (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  parent_message_id uuid not null references public.messages(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  root_message_id uuid not null unique references public.messages(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thread_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists message_replies_parent_created_idx on public.message_replies(parent_message_id, created_at);
create index if not exists thread_replies_thread_created_idx on public.thread_replies(thread_id, created_at);

alter table public.message_replies enable row level security;
alter table public.message_threads enable row level security;
alter table public.thread_replies enable row level security;
revoke all on public.message_replies, public.message_threads, public.thread_replies from public, anon, authenticated;

create or replace function public.app_message_relations(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  me uuid := auth.uid();
  ch uuid := nullif(p_payload->>'channel','')::uuid;
  parent_id uuid := nullif(p_payload->>'message','')::uuid;
  thread_id uuid := nullif(p_payload->>'thread','')::uuid;
  item_id uuid;
  server_id uuid;
  private_mode boolean := coalesce((p_payload->>'private')::boolean,false);
  result jsonb;
begin
  if me is null then raise exception 'Please sign in'; end if;

  if p_action = 'list' then
    if ch is null or not public.app_access(ch,false) then raise exception 'You cannot access this channel'; end if;
    select c.server_id into server_id from public.channels c where c.id=ch;
    return jsonb_build_object(
      'replies', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('author', public.app_public_profile(r.author_id)) order by r.created_at)
        from public.message_replies r join public.messages m on m.id=r.parent_message_id
        where r.channel_id=ch and (r.visibility='public' or r.author_id=me or m.sender=me or public.has_server_permission(server_id,me,'manage_messages'))),'[]'::jsonb),
      'threads', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('reply_count',(select count(*) from public.thread_replies tr where tr.thread_id=t.id)) order by t.updated_at desc)
        from public.message_threads t where t.channel_id=ch),'[]'::jsonb)
    );
  end if;

  if p_action = 'reply/create' then
    select c.server_id into server_id from public.messages m join public.channels c on c.id=m.channel_id
      where m.id=parent_id and m.channel_id=ch;
    if server_id is null or not public.app_access(ch,true) then raise exception 'You cannot reply in this channel'; end if;
    if private_mode and not public.has_server_permission(server_id,me,'private_replies') then raise exception 'Private replies are not enabled for your role'; end if;
    insert into public.message_replies(channel_id,parent_message_id,author_id,body,visibility)
      values(ch,parent_id,me,left(trim(p_payload->>'body'),4000),case when private_mode then 'private' else 'public' end) returning id into item_id;
    return jsonb_build_object('id',item_id);
  end if;

  if p_action = 'thread/create' then
    select c.server_id into server_id from public.messages m join public.channels c on c.id=m.channel_id
      where m.id=parent_id and m.channel_id=ch;
    if server_id is null or not public.app_access(ch,true) then raise exception 'You cannot start a thread here'; end if;
    insert into public.message_threads(channel_id,root_message_id,creator_id) values(ch,parent_id,me)
      on conflict(root_message_id) do update set updated_at=public.message_threads.updated_at returning id into item_id;
    return jsonb_build_object('id',item_id);
  end if;

  if p_action in ('thread/open','thread/reply','thread/archive') then
    select c.server_id into server_id from public.message_threads t join public.channels c on c.id=t.channel_id
      where t.id=thread_id and (ch is null or t.channel_id=ch);
    if server_id is null then raise exception 'Thread not found'; end if;
    if p_action='thread/open' then
      if not public.app_access(ch,false) then raise exception 'You cannot access this thread'; end if;
      select to_jsonb(t) || jsonb_build_object(
        'root', (select to_jsonb(m) || jsonb_build_object('author',public.app_public_profile(m.sender)) from public.messages m where m.id=t.root_message_id),
        'replies', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('author',public.app_public_profile(r.author_id)) order by r.created_at) from public.thread_replies r where r.thread_id=t.id),'[]'::jsonb)
      ) into result from public.message_threads t where t.id=thread_id;
      return result;
    end if;
    if not public.app_access(ch,true) then raise exception 'You cannot post in this thread'; end if;
    if p_action='thread/reply' then
      if exists(select 1 from public.message_threads where id=thread_id and archived) and not public.has_server_permission(server_id,me,'manage_messages') then raise exception 'This thread is archived'; end if;
      insert into public.thread_replies(thread_id,author_id,body) values(thread_id,me,left(trim(p_payload->>'body'),4000)) returning id into item_id;
      update public.message_threads set updated_at=now() where id=thread_id;
      return jsonb_build_object('id',item_id);
    end if;
    if not public.has_server_permission(server_id,me,'manage_messages') then raise exception 'You cannot archive threads'; end if;
    update public.message_threads set archived=coalesce((p_payload->>'archived')::boolean,true),updated_at=now() where id=thread_id;
    return '{}'::jsonb;
  end if;

  raise exception 'Unknown message relation action';
end $$;

revoke all on function public.app_message_relations(text,jsonb) from public,anon;
grant execute on function public.app_message_relations(text,jsonb) to authenticated;
notify pgrst,'reload schema';
