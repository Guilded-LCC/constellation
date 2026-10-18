do $$
declare
  definition text := pg_get_functiondef('public.app_roles_save(uuid,jsonb)'::regprocedure);
  before_permissions text := '''manage_messages'',''manage_channels'',''upload_media''';
begin
  if position('private_replies' in definition) > 0 then return; end if;
  if position(before_permissions in definition) = 0 then
    raise exception 'Could not locate the role permission allowlist';
  end if;
  definition := replace(definition, before_permissions, '''manage_messages'',''manage_channels'',''private_replies'',''upload_media''');
  execute definition;
end;
$$;
