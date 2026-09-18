-- Phase 9: server-side media reference guard used by deletion/orphan scans.

create or replace function public.birthday_media_reference_status(
  p_url text,
  p_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live boolean := false;
  v_history_count bigint := 0;
begin
  if coalesce(p_url,'') = '' and coalesce(p_path,'') = '' then
    return jsonb_build_object('referenced', false, 'live', false, 'history_count', 0);
  end if;

  select exists(
    select 1
    from public.site_state
    where id = 'live'
      and (
        (coalesce(p_url,'') <> '' and position(p_url in data::text) > 0)
        or
        (coalesce(p_path,'') <> '' and position(p_path in data::text) > 0)
      )
  ) into v_live;

  select count(*)
  into v_history_count
  from public.site_state_history
  where state_id = 'live'
    and (
      (coalesce(p_url,'') <> '' and position(p_url in data::text) > 0)
      or
      (coalesce(p_path,'') <> '' and position(p_path in data::text) > 0)
    );

  return jsonb_build_object(
    'referenced', v_live or v_history_count > 0,
    'live', v_live,
    'history_count', v_history_count
  );
end;
$$;

revoke all on function public.birthday_media_reference_status(text,text) from public, anon, authenticated;
grant execute on function public.birthday_media_reference_status(text,text) to service_role;
