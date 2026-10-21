-- `sender` and `recipient` shadowed the messages columns, so the lookup query
-- failed with "column reference is ambiguous" for every bookmark attempt.
create or replace function public.app_bookmark_toggle(p_message uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_channel uuid;
  v_sender uuid;
  v_recipient uuid;
begin
  if v_me is null then raise exception 'Please sign in'; end if;
  select m.channel_id, m.sender, m.recipient
    into v_channel, v_sender, v_recipient
    from messages m where m.id = p_message;
  if not found then raise exception 'Message not found'; end if;
  if v_channel is not null then
    if not public.app_access(v_channel) then raise exception 'Cannot view this channel'; end if;
  elsif v_me not in (v_sender, v_recipient) then
    raise exception 'Private message';
  end if;
  if exists (select 1 from message_bookmarks b where b.user_id = v_me and b.message_id = p_message) then
    delete from message_bookmarks b where b.user_id = v_me and b.message_id = p_message;
    return false;
  end if;
  insert into message_bookmarks(user_id, message_id) values (v_me, p_message);
  return true;
end $$;
revoke all on function public.app_bookmark_toggle(uuid) from public, anon;
grant execute on function public.app_bookmark_toggle(uuid) to authenticated;
