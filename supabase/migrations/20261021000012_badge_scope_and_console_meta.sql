-- Badge presentation metadata editable from the staff console.
alter function public.staff_action(text, jsonb) rename to staff_action_before_badge_meta;
create or replace function public.staff_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_action = 'badge/save' then
    if coalesce(p_payload->>'id','') !~ '^[a-z0-9_-]{2,40}$' or nullif(trim(p_payload->>'name'),'') is null then
      raise exception 'Badge name and ID are required';
    end if;
    if coalesce(p_payload->>'display_scope','everywhere') not in ('everywhere','profile','owned_servers','hidden') then
      raise exception 'Choose a valid display scope';
    end if;
    if coalesce(p_payload->>'assignment','manual') not in ('manual','automatic','both') then
      raise exception 'Choose a valid assignment';
    end if;
    insert into staff_badges(id, name, icon_url, position, description, category, assignment, display_scope, hidden_from_picker, accent)
    values (
      lower(trim(p_payload->>'id')),
      left(trim(p_payload->>'name'), 60),
      left(coalesce(p_payload->>'icon_url',''), 20000),
      coalesce((p_payload->>'position')::integer, 0),
      left(coalesce(p_payload->>'description',''), 500),
      left(coalesce(nullif(p_payload->>'category',''),'achievement'), 24),
      coalesce(p_payload->>'assignment','manual'),
      coalesce(p_payload->>'display_scope','everywhere'),
      coalesce((p_payload->>'hidden_from_picker')::boolean, false),
      left(coalesce(nullif(p_payload->>'accent',''),'#5bb8fa'), 9)
    )
    on conflict(id) do update set
      name = excluded.name, icon_url = excluded.icon_url, position = excluded.position,
      description = excluded.description, category = excluded.category,
      assignment = excluded.assignment, display_scope = excluded.display_scope,
      hidden_from_picker = excluded.hidden_from_picker, accent = excluded.accent;
    select coalesce(jsonb_agg(to_jsonb(b) order by b.position, b.id), '[]'::jsonb)
      into result from staff_badges b where b.id = lower(trim(p_payload->>'id'));
    return result;
  end if;
  return public.staff_action_before_badge_meta(p_action, p_payload);
end $$;
revoke all on function public.staff_action(text, jsonb) from public, anon;
grant execute on function public.staff_action(text, jsonb) to authenticated;

-- Synced badges now carry the presentation fields the client needs to place them.
create or replace function public.app_sync_badges(p_user uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(p_user, auth.uid());
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if target is null then raise exception 'Choose a user'; end if;
  if target <> auth.uid() and not public.is_platform_staff() then raise exception 'Not found'; end if;

  insert into profile_badges(user_id, badge, source, granted_at)
  select target, b.id, 'auto', now()
  from staff_badges b
  where b.assignment in ('automatic','both')
    and exists (select 1 from badge_requirements r where r.badge = b.id and r.enabled)
    and not exists (
      select 1 from badge_requirements r
      where r.badge = b.id and r.enabled
        and not public.badge_requirement_met(target, r.kind, r.config)
    )
  on conflict (user_id, badge) do nothing;

  delete from profile_badges pb
  where pb.user_id = target
    and pb.source = 'auto'
    and exists (select 1 from badge_requirements r where r.badge = pb.badge and r.enabled)
    and exists (
      select 1 from badge_requirements r
      where r.badge = pb.badge and r.enabled
        and not public.badge_requirement_met(target, r.kind, r.config)
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id, 'name', b.name, 'description', b.description,
      'icon_url', b.icon_url, 'category', b.category, 'source', pb.source,
      'display_scope', b.display_scope, 'accent', b.accent, 'position', b.position
    ) order by b.position, b.id
  ), '[]'::jsonb)
  into result
  from profile_badges pb
  join staff_badges b on b.id = pb.badge
  where pb.user_id = target;

  return result;
end $$;
revoke all on function public.app_sync_badges(uuid) from public, anon;
grant execute on function public.app_sync_badges(uuid) to authenticated;

-- Lazy scheduler: clients already call this on load, so the 2027 rollover needs
-- no cron job on the Supabase plan.
create or replace function public.app_must_rename()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  perform public.apply_username_rollover(now());
  return coalesce((select must_rename from profiles where id = auth.uid()), false);
end $$;
revoke all on function public.app_must_rename() from public, anon;
grant execute on function public.app_must_rename() to authenticated;

notify pgrst, 'reload schema';
