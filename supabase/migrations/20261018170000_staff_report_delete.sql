-- Allow only platform admins to remove a report, without opening direct table
-- access. Keep the action visible in the immutable staff audit stream.
create or replace function public.staff_delete_report(
  p_report_id uuid,
  p_reason text default 'Report removed by platform administrator'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  deleted_id uuid;
begin
  if actor_id is null or not public.is_platform_admin() then
    raise exception 'Not found' using errcode = '42501';
  end if;

  delete from public.staff_reports
  where id = p_report_id
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Report not found';
  end if;

  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (
    actor_id,
    'report/delete',
    'report',
    deleted_id::text,
    left(trim(coalesce(p_reason, '')), 1000)
  );

  return jsonb_build_object('id', deleted_id, 'deleted', true);
end;
$$;

revoke all on function public.staff_delete_report(uuid, text) from public, anon;
grant execute on function public.staff_delete_report(uuid, text) to authenticated;
