-- The public staff_action wrapper handles badge/save itself, so it must also
-- write the audit row that the original implementation recorded.
create or replace function public.staff_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(p_payload->>'server_id', '')::uuid; flag text := upper(trim(coalesce(p_payload->>'flag', '')));
begin
  -- Only the intercepted actions need the gate here: everything else is checked
  -- by the delegated implementation, and report/create stays open to members.
  if p_action = 'server/features' then
    if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
    if sid is null then raise exception 'Choose a server'; end if;
    if flag !~ '^[A-Z][A-Z0-9_]{2,40}$' then raise exception 'Choose a valid feature flag'; end if;
    update servers
      set features = case
        when coalesce((p_payload->>'enabled')::boolean, false)
          then features || jsonb_build_object(flag, true)
        else features - flag
      end
      where id = sid;
    if not found then raise exception 'Server not found'; end if;
    perform app_sync_server_badges(sid);
    return jsonb_build_object('features', (select features from servers where id = sid));
  end if;

  if p_action = 'badge/save' then
    if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
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
    insert into staff_audit(actor, action, target_type, target_id, reason)
    values (auth.uid(), p_action, 'badge', lower(trim(p_payload->>'id')), coalesce(nullif(p_payload->>'reason',''), 'No reason supplied'));
    return coalesce((select jsonb_agg(to_jsonb(b) order by b.position, b.id) from staff_badges b where b.id = lower(trim(p_payload->>'id'))), '[]'::jsonb);
  end if;

  return staff_action_before_server_features(p_action, p_payload);
end $$;
revoke all on function public.staff_action(text, jsonb) from public, anon;
grant execute on function public.staff_action(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
