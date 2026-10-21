-- Instant interactions: one round trip that toggles a reaction and returns the
-- resulting count, plus the caller's own reactions so the client can apply the
-- change to the UI immediately instead of reloading the whole channel.

create or replace function public.app_toggle_reaction(p_message uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_me uuid := auth.uid();
  v_channel uuid;
  v_server uuid;
  v_mine boolean;
  v_count integer;
begin
  if v_me is null then raise exception 'Please sign in'; end if;
  if coalesce(p_emoji, '') not in ('💜', '👍', '✨', '😂', '🎉', '👀') then
    raise exception 'Invalid reaction';
  end if;

  select channel_id into v_channel from public.messages where id = p_message;
  if not found then raise exception 'Message not found'; end if;

  if v_channel is not null then
    if not public.app_access(v_channel, true) then raise exception 'Private message'; end if;
    select server_id into v_server from public.channels where id = v_channel;
    if v_server is not null and not public.has_server_permission(v_server, v_me, 'add_reactions') then
      raise exception 'You cannot add reactions here';
    end if;
  elsif not exists (
    select 1 from public.messages
    where id = p_message and (sender = v_me or recipient = v_me)
  ) then
    raise exception 'Private message';
  end if;

  if exists (
    select 1 from public.reactions
    where message_id = p_message and user_id = v_me and emoji = p_emoji
  ) then
    delete from public.reactions
    where message_id = p_message and user_id = v_me and emoji = p_emoji;
    v_mine := false;
  else
    insert into public.reactions(message_id, user_id, emoji) values (p_message, v_me, p_emoji);
    v_mine := true;
  end if;

  select count(*) into v_count from public.reactions
  where message_id = p_message and emoji = p_emoji;

  return jsonb_build_object('message_id', p_message, 'emoji', p_emoji, 'mine', v_mine, 'count', v_count);
end $$;

create or replace function public.app_my_reactions(p_channel uuid default null, p_user uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('message_id', r.message_id, 'emoji', r.emoji)),
    '[]'::jsonb
  )
  from public.reactions r
  join public.messages m on m.id = r.message_id
  where r.user_id = auth.uid()
    and (
      (p_channel is not null and m.channel_id = p_channel)
      or (
        p_channel is null and p_user is not null and m.channel_id is null
        and (
          (m.sender = auth.uid() and m.recipient = p_user)
          or (m.sender = p_user and m.recipient = auth.uid())
        )
      )
    )
$$;

revoke all on function public.app_toggle_reaction(uuid, text) from public, anon;
grant execute on function public.app_toggle_reaction(uuid, text) to authenticated;
revoke all on function public.app_my_reactions(uuid, uuid) from public, anon;
grant execute on function public.app_my_reactions(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
