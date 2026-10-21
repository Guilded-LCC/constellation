-- Unified search across messages, threads, documents, forum topics and files.
-- Operators follow the familiar syntax: from: in: before: after: during:
-- has:link|file pinned:true mentions: plus free text.
create or replace function public.app_search(p_query text, p_limit integer default 40)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tokens text[];
  term text;
  q text := '';
  f_author uuid;
  f_channel text;
  f_before timestamptz;
  f_after timestamptz;
  f_has text;
  f_pinned boolean;
  f_mentions text;
  lim integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  result jsonb;
begin
  if me is null then raise exception 'Please sign in'; end if;
  tokens := regexp_split_to_array(trim(coalesce(p_query, '')), '\s+');
  foreach term in array tokens loop
    if term = '' then continue;
    elsif term ~* '^from:' then
      f_author := public.app_resolve_profile(substring(term from 6));
    elsif term ~* '^mentions:' then
      f_mentions := lower(substring(term from 10));
    elsif term ~* '^in:' then
      f_channel := lower(substring(term from 4));
    elsif term ~* '^before:' and substring(term from 8) ~ '^\d{4}-\d{2}-\d{2}$' then
      f_before := substring(term from 8)::timestamptz;
    elsif term ~* '^after:' and substring(term from 7) ~ '^\d{4}-\d{2}-\d{2}$' then
      f_after := substring(term from 7)::timestamptz;
    elsif term ~* '^during:' and substring(term from 8) ~ '^\d{4}-\d{2}-\d{2}$' then
      f_after := substring(term from 8)::timestamptz;
      f_before := f_after + interval '1 day';
    elsif term ~* '^has:' then
      f_has := lower(substring(term from 5));
    elsif term ~* '^pinned:' then
      f_pinned := lower(substring(term from 8)) in ('true', '1', 'yes', 'on');
    else
      q := trim(both ' ' from q || ' ' || term);
    end if;
  end loop;
  q := nullif(q, '');

  with hits as (
    select 'message'::text as kind, m.id, m.channel_id, c.server_id,
           coalesce(c.name, 'Direct message') as context,
           m.body as body, m.sender as author_id, m.created_at, m.pinned,
           m.id as target_id
    from messages m
    left join channels c on c.id = m.channel_id
    where (
        (m.channel_id is not null and public.app_access(m.channel_id))
        or (m.channel_id is null and me in (m.sender, m.recipient))
      )
      and (q is null or m.body ilike '%' || q || '%')
      and (f_author is null or m.sender = f_author)
      and (f_channel is null or lower(coalesce(c.name, '')) = f_channel)
      and (f_before is null or m.created_at < f_before)
      and (f_after is null or m.created_at >= f_after)
      and (f_pinned is null or m.pinned = f_pinned)
      and (f_mentions is null or m.body ilike '%@' || f_mentions || '%')
      and (f_has is null
        or (f_has = 'file' and exists (select 1 from message_attachments a where a.message_id = m.id))
        or (f_has in ('link', 'embed') and m.body ~* 'https?://'))

    union all

    select 'thread', t.id, t.channel_id, c.server_id,
           'Thread in #' || c.name,
           coalesce(root.body, ''), t.creator_id, t.updated_at, false,
           t.root_message_id
    from message_threads t
    join channels c on c.id = t.channel_id
    join messages root on root.id = t.root_message_id
    where public.app_access(t.channel_id)
      and (q is null
        or root.body ilike '%' || q || '%'
        or exists (select 1 from thread_replies r where r.thread_id = t.id and r.body ilike '%' || q || '%'))
      and (f_author is null or t.creator_id = f_author)
      and (f_channel is null or lower(c.name) = f_channel)
      and (f_before is null or t.updated_at < f_before)
      and (f_after is null or t.updated_at >= f_after)
      and f_has is null and f_pinned is null and f_mentions is null

    union all

    select 'document', d.id, d.channel_id, c.server_id,
           '# ' || d.title,
           d.body, d.created_by, d.updated_at, false,
           null::uuid
    from documents d
    join channels c on c.id = d.channel_id
    where public.app_access(d.channel_id)
      and (q is null or d.title ilike '%' || q || '%' or d.body ilike '%' || q || '%')
      and (f_author is null or d.created_by = f_author)
      and (f_channel is null or lower(c.name) = f_channel)
      and (f_before is null or d.updated_at < f_before)
      and (f_after is null or d.updated_at >= f_after)
      and f_has is null and f_pinned is null and f_mentions is null

    union all

    select 'forum', t.id, t.channel_id, c.server_id,
           lower(c.name) || ' · forum topic',
           t.body, t.author, t.created_at, t.pinned,
           null::uuid
    from forum_topics t
    join channels c on c.id = t.channel_id
    where public.app_access(t.channel_id)
      and (q is null
        or t.title ilike '%' || q || '%'
        or t.body ilike '%' || q || '%'
        or exists (select 1 from forum_replies r where r.topic_id = t.id and r.body ilike '%' || q || '%'))
      and (f_author is null or t.author = f_author)
      and (f_channel is null or lower(c.name) = f_channel)
      and (f_before is null or t.created_at < f_before)
      and (f_after is null or t.created_at >= f_after)
      and (f_pinned is null or t.pinned = f_pinned)
      and f_has is null and f_mentions is null

    union all

    select 'file', a.id, a.channel_id, c.server_id,
           '#' || c.name || ' · file',
           a.file_name, m.sender, a.created_at, false,
           a.message_id
    from message_attachments a
    join channels c on c.id = a.channel_id
    left join messages m on m.id = a.message_id
    where public.app_access(a.channel_id)
      and (q is null or a.file_name ilike '%' || q || '%')
      and (f_author is null or m.sender = f_author)
      and (f_channel is null or lower(c.name) = f_channel)
      and (f_before is null or a.created_at < f_before)
      and (f_after is null or a.created_at >= f_after)
      and f_has is null and f_pinned is null and f_mentions is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', kind, 'id', id, 'server_id', server_id, 'channel_id', channel_id,
    'context', context, 'snippet', left(body, 200),
    'author', public.app_public_profile(author_id),
    'created_at', created_at, 'pinned', pinned, 'target_id', target_id
  ) order by created_at desc), '[]'::jsonb)
  into result
  from (select * from hits order by created_at desc limit lim) ranked;

  return result;
end $$;
revoke all on function public.app_search(text, integer) from public, anon;
grant execute on function public.app_search(text, integer) to authenticated;

-- Bookmarks: a private "keep this" list that survives scrolling away.
create table if not exists public.message_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.message_bookmarks enable row level security;
revoke all on public.message_bookmarks from public, anon, authenticated;

create or replace function public.app_bookmark_toggle(p_message uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ch uuid; sender uuid; recipient uuid;
begin
  if me is null then raise exception 'Please sign in'; end if;
  select channel_id, sender, recipient into ch, sender, recipient from messages where id = p_message;
  if not found then raise exception 'Message not found'; end if;
  if ch is not null then
    if not public.app_access(ch) then raise exception 'Cannot view this channel'; end if;
  elsif me not in (sender, recipient) then
    raise exception 'Private message';
  end if;
  if exists (select 1 from message_bookmarks where user_id = me and message_id = p_message) then
    delete from message_bookmarks where user_id = me and message_id = p_message;
    return false;
  end if;
  insert into message_bookmarks(user_id, message_id) values (me, p_message);
  return true;
end $$;
revoke all on function public.app_bookmark_toggle(uuid) from public, anon;
grant execute on function public.app_bookmark_toggle(uuid) to authenticated;

create or replace function public.app_bookmarks()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'server_id', c.server_id,
    'context', coalesce(c.name, 'Direct message'),
    'snippet', left(m.body, 200),
    'author', public.app_public_profile(m.sender),
    'created_at', m.created_at, 'bookmarked_at', b.created_at
  ) order by b.created_at desc), '[]'::jsonb)
  from message_bookmarks b
  join messages m on m.id = b.message_id
  left join channels c on c.id = m.channel_id
  where b.user_id = auth.uid()
$$;
revoke all on function public.app_bookmarks() from public, anon;
grant execute on function public.app_bookmarks() to authenticated;

-- Saved searches: named, permanent queries with no storage cost.
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  query text not null check (char_length(trim(query)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id, created_at desc);
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from public, anon, authenticated;

create or replace function public.app_saved_searches()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'query', query, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
  from saved_searches where user_id = auth.uid()
$$;
revoke all on function public.app_saved_searches() from public, anon;
grant execute on function public.app_saved_searches() to authenticated;

create or replace function public.app_save_search(p_name text, p_query text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text := trim(coalesce(p_name, '')); q text := trim(coalesce(p_query, ''));
begin
  if me is null then raise exception 'Please sign in'; end if;
  if n = '' or q = '' then raise exception 'Give the search a name and a query'; end if;
  insert into saved_searches(user_id, name, query) values (me, left(n, 60), left(q, 300));
  return public.app_saved_searches();
end $$;
revoke all on function public.app_save_search(text, text) from public, anon;
grant execute on function public.app_save_search(text, text) to authenticated;

create or replace function public.app_delete_search(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from saved_searches where id = p_id and user_id = auth.uid();
  return public.app_saved_searches();
end $$;
revoke all on function public.app_delete_search(uuid) from public, anon;
grant execute on function public.app_delete_search(uuid) to authenticated;

notify pgrst, 'reload schema';
