-- Phase 2: revisioned birthday-site state publishing and history.
alter table public.site_state
  add column if not exists revision bigint not null default 1;

create table if not exists public.site_state_history (
  state_id text not null,
  revision bigint not null,
  data jsonb not null,
  source_updated_at timestamptz not null,
  snapshot_at timestamptz not null default now(),
  reason text not null default 'publish',
  primary key (state_id, revision)
);

alter table public.site_state_history enable row level security;
revoke all on table public.site_state_history from anon, authenticated;
grant select, insert, update, delete on table public.site_state_history to service_role;

insert into public.site_state_history(state_id,revision,data,source_updated_at,reason)
select 'live',0,data,updated_at,'phase0-baseline'
from public.site_state
where id='baseline-phase-0-c8b7ade8'
on conflict (state_id,revision) do nothing;

do $$
declare
  current_data jsonb;
  page_name text;
  page_patches jsonb;
  cleaned jsonb;
  cleaned_patches jsonb := '{}'::jsonb;
begin
  select data into current_data from public.site_state where id='live' for update;
  if current_data is not null and jsonb_typeof(coalesce(current_data->'patches','{}'::jsonb))='object' then
    for page_name,page_patches in select key,value from jsonb_each(coalesce(current_data->'patches','{}'::jsonb))
    loop
      if jsonb_typeof(page_patches)='array' then
        select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into cleaned
        from jsonb_array_elements(page_patches) with ordinality as x(item,ord)
        where coalesce(item->>'selector','') !~ '(bday-added-media|bday-added-photo|data-bday-inserted|data-bday-group)';
        cleaned_patches := cleaned_patches || jsonb_build_object(page_name,cleaned);
      else
        cleaned_patches := cleaned_patches || jsonb_build_object(page_name,page_patches);
      end if;
    end loop;
    current_data := jsonb_set(current_data,'{patches}',cleaned_patches,true);
    update public.site_state set data=current_data,revision=1,updated_at=now() where id='live';
  end if;
end
$$;

insert into public.site_state_history(state_id,revision,data,source_updated_at,reason)
select id,revision,data,updated_at,'phase2-normalized'
from public.site_state where id='live'
on conflict (state_id,revision) do update
set data=excluded.data,source_updated_at=excluded.source_updated_at,snapshot_at=now(),reason=excluded.reason;

create or replace function public.publish_site_state(p_expected_revision bigint,p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  current_revision bigint;
  current_updated_at timestamptz;
  new_revision bigint;
  new_updated_at timestamptz;
begin
  if p_expected_revision is null then
    return jsonb_build_object('ok',false,'conflict',true,'error','MISSING_REVISION');
  end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then
    return jsonb_build_object('ok',false,'conflict',false,'error','INVALID_STATE');
  end if;

  select s.revision,s.updated_at into current_revision,current_updated_at
  from public.site_state s where s.id='live' for update;

  if current_revision is null then
    return jsonb_build_object('ok',false,'conflict',false,'error','LIVE_STATE_MISSING');
  end if;
  if current_revision<>p_expected_revision then
    return jsonb_build_object('ok',false,'conflict',true,'error','STALE_STATE','current_revision',current_revision,'updated_at',current_updated_at);
  end if;

  update public.site_state
  set data=p_data,revision=current_revision+1,updated_at=now()
  where id='live'
  returning revision,updated_at into new_revision,new_updated_at;

  insert into public.site_state_history(state_id,revision,data,source_updated_at,reason)
  values('live',new_revision,p_data,new_updated_at,'publish')
  on conflict (state_id,revision) do nothing;

  return jsonb_build_object('ok',true,'conflict',false,'revision',new_revision,'updated_at',new_updated_at);
end;
$$;

revoke all on function public.publish_site_state(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.publish_site_state(bigint,jsonb) to service_role;
