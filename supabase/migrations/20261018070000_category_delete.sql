-- Keep channels visible as uncategorized when their category is removed.
create or replace function public.attach_channel_category() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.category_id is null and old.category_id is not null
     and new.category is not distinct from old.category then
    return new;
  end if;
  if new.category_id is null or (tg_op='UPDATE' and new.category is distinct from old.category
      and not exists(select 1 from categories where id=new.category_id and server_id=new.server_id and name=new.category)) then
    insert into categories(server_id,name,position)
    values(new.server_id,coalesce(nullif(trim(new.category),''),'Channels'),
      coalesce((select max(position)+1 from categories where server_id=new.server_id),0))
    on conflict(server_id,name) do nothing;
    select id into new.category_id from categories where server_id=new.server_id and name=coalesce(nullif(trim(new.category),''),'Channels');
  end if;
  if tg_op='INSERT' then
    select coalesce(max(position)+1,0) into new.position from channels where category_id=new.category_id;
  end if;
  return new;
end $$;
revoke execute on function public.attach_channel_category() from public,anon,authenticated;
