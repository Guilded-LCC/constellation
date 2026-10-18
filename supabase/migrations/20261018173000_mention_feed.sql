begin;

create or replace function public.app_mention_feed()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mention_name text;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  select username into mention_name from public.profiles where id = auth.uid();
  if mention_name is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'message_id', m.id,
      'body', m.body,
      'created_at', m.created_at,
      'channel_id', c.id,
      'channel_name', c.name,
      'server_id', s.id,
      'server_name', s.name,
      'author', public.app_public_profile(m.sender)
    ) as item,
    m.created_at
    from public.messages m
    join public.channels c on c.id = m.channel_id
    join public.servers s on s.id = c.server_id
    where m.sender <> auth.uid()
      and public.app_access(c.id)
      and position('@' || lower(mention_name) in lower(m.body)) > 0
    order by m.created_at desc
    limit 50
  ) mentions;

  return result;
end;
$$;

revoke all on function public.app_mention_feed() from public, anon;
grant execute on function public.app_mention_feed() to authenticated;
notify pgrst, 'reload schema';

commit;
