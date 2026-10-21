-- Polls attach to a message so they live in the conversation instead of a
-- separate screen: the question is the message body, options live here.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 200),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  multiple boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists polls_channel_idx on public.polls(channel_id, created_at desc);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 9),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_votes from public, anon, authenticated;

create or replace function public.app_poll_create(
  p_channel uuid, p_question text, p_options jsonb,
  p_multiple boolean default false, p_closes_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_question text := left(trim(coalesce(p_question, '')), 200);
  v_options jsonb;
  v_labels text[];
  v_message uuid;
  v_poll uuid;
begin
  if me is null then raise exception 'Please sign in'; end if;
  if p_channel is null or not public.app_access(p_channel, true) then
    raise exception 'You cannot post in this channel';
  end if;
  if char_length(v_question) < 1 then raise exception 'Write a question'; end if;

  select coalesce(jsonb_agg(label), '[]'::jsonb), array_agg(label)
    into v_options, v_labels
  from (
    select left(trim(value), 80) as label, ordinality as position
    from jsonb_array_elements_text(coalesce(p_options, '[]'::jsonb)) with ordinality
    where char_length(trim(value)) > 0
    order by ordinality
  ) cleaned;

  if coalesce(jsonb_array_length(v_options), 0) < 2 then
    raise exception 'Add at least two options';
  end if;
  if coalesce(jsonb_array_length(v_options), 0) > 10 then
    raise exception 'Use at most ten options';
  end if;
  if array_length(v_labels, 1) <> (select count(distinct lower(l)) from unnest(v_labels) l) then
    raise exception 'Each option must be different';
  end if;

  insert into messages(channel_id, sender, body) values (p_channel, me, v_question) returning id into v_message;
  insert into polls(message_id, channel_id, question, options, multiple, closes_at, created_by)
  values (v_message, p_channel, v_question, v_options, coalesce(p_multiple, false), p_closes_at, me)
  returning id into v_poll;

  return jsonb_build_object('message', v_message, 'poll', v_poll);
end $$;
revoke all on function public.app_poll_create(uuid, text, jsonb, boolean, timestamptz) from public, anon;
grant execute on function public.app_poll_create(uuid, text, jsonb, boolean, timestamptz) to authenticated;

create or replace function public.app_poll_vote(p_poll uuid, p_index integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_poll public.polls;
  v_options integer;
begin
  if me is null then raise exception 'Please sign in'; end if;
  select * into v_poll from polls where id = p_poll;
  if not found then raise exception 'Poll not found'; end if;
  if not public.app_access(v_poll.channel_id) then raise exception 'Cannot view this channel'; end if;
  if v_poll.closed_at is not null or (v_poll.closes_at is not null and v_poll.closes_at < now()) then
    raise exception 'This poll is closed';
  end if;
  v_options := jsonb_array_length(v_poll.options);
  if p_index is null or p_index < 0 or p_index >= v_options then raise exception 'Choose an option'; end if;

  if not v_poll.multiple then
    delete from poll_votes where poll_id = p_poll and user_id = me;
  end if;
  insert into poll_votes(poll_id, user_id, option_index) values (p_poll, me, p_index)
  on conflict (poll_id, user_id, option_index) do nothing;
  return true;
end $$;
revoke all on function public.app_poll_vote(uuid, integer) from public, anon;
grant execute on function public.app_poll_vote(uuid, integer) to authenticated;

create or replace function public.app_poll_close(p_poll uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_poll public.polls;
  v_server uuid;
begin
  select * into v_poll from polls where id = p_poll;
  if not found then raise exception 'Poll not found'; end if;
  select server_id into v_server from channels where id = v_poll.channel_id;
  if v_poll.created_by <> me and not public.has_server_permission(v_server, me, 'manage_messages') then
    raise exception 'Not permitted';
  end if;
  update polls set closed_at = coalesce(closed_at, now()) where id = p_poll;
  return true;
end $$;
revoke all on function public.app_poll_close(uuid) from public, anon;
grant execute on function public.app_poll_close(uuid) to authenticated;

-- Merge poll state into the message payload the client already receives.
alter function public.app_messages(uuid, uuid) rename to app_messages_before_polls;
create or replace function public.app_messages(p_channel uuid default null, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  payload jsonb;
  item jsonb;
  out jsonb := '[]'::jsonb;
  v_poll public.polls;
  v_options jsonb;
begin
  payload := public.app_messages_before_polls(p_channel, p_user);
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return coalesce(payload, '[]'::jsonb);
  end if;
  for item in select value from jsonb_array_elements(payload) loop
    select * into v_poll from polls where message_id = (item ->> 'id')::uuid;
    if found then
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', o.value,
        'votes', (select count(*) from poll_votes v where v.poll_id = v_poll.id and v.option_index = (o.ord - 1)::int),
        'voted', exists (select 1 from poll_votes v where v.poll_id = v_poll.id and v.user_id = me and v.option_index = (o.ord - 1)::int)
      ) order by o.ord), '[]'::jsonb)
      into v_options
      from jsonb_array_elements_text(v_poll.options) with ordinality as o(value, ord);
      item := item || jsonb_build_object('poll', jsonb_build_object(
        'id', v_poll.id,
        'question', v_poll.question,
        'multiple', v_poll.multiple,
        'closes_at', v_poll.closes_at,
        'closed', v_poll.closed_at is not null or (v_poll.closes_at is not null and v_poll.closes_at < now()),
        'mine', v_poll.created_by = me,
        'options', v_options
      ));
    end if;
    out := out || jsonb_build_array(item);
  end loop;
  return out;
end $$;
revoke all on function public.app_messages(uuid, uuid) from public, anon;
grant execute on function public.app_messages(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
