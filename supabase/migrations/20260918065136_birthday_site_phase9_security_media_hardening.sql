-- Phase 9: harden birthday-site admin authentication and storage exposure.

create table if not exists public.site_admin_auth_limits (
  client_fingerprint text primary key,
  window_started timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.site_admin_auth_limits enable row level security;
revoke all on table public.site_admin_auth_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.site_admin_auth_limits to service_role;

update public.site_admin_security
set key_hash = 'bcrypt-sha256$' || extensions.crypt(
  key_hash,
  extensions.gen_salt('bf', 12)
),
updated_at = now()
where id = 'primary'
  and key_hash ~ '^[0-9a-f]{64}$';

create or replace function public.birthday_admin_authorize(
  p_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_fingerprint text := coalesce(nullif(trim(p_fingerprint), ''), 'unknown');
  v_limit public.site_admin_auth_limits%rowtype;
  v_stored text;
  v_hash_body text;
  v_prehash text;
  v_ok boolean := false;
  v_failures integer := 0;
  v_blocked_until timestamptz := null;
  v_retry integer := 0;
begin
  if p_key is null or length(p_key) = 0 then
    return jsonb_build_object('allowed', false, 'rate_limited', false);
  end if;

  select * into v_limit
  from public.site_admin_auth_limits
  where client_fingerprint = v_fingerprint
  for update;

  if found and v_limit.blocked_until is not null and v_limit.blocked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_limit.blocked_until - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'rate_limited', true, 'retry_after', v_retry);
  end if;

  select key_hash into v_stored
  from public.site_admin_security
  where id = 'primary';

  if v_stored is null then
    raise exception 'Admin security state is missing';
  end if;

  v_prehash := encode(extensions.digest(p_key, 'sha256'), 'hex');

  if v_stored like 'bcrypt-sha256$%' then
    v_hash_body := substring(v_stored from length('bcrypt-sha256$') + 1);
    v_ok := extensions.crypt(v_prehash, v_hash_body) = v_hash_body;
  elsif v_stored ~ '^[0-9a-f]{64}$' then
    v_ok := v_prehash = v_stored;
  end if;

  if v_ok then
    if v_stored ~ '^[0-9a-f]{64}$' then
      update public.site_admin_security
      set key_hash = 'bcrypt-sha256$' || extensions.crypt(
        v_prehash,
        extensions.gen_salt('bf', 12)
      ),
      updated_at = v_now
      where id = 'primary';
    end if;

    delete from public.site_admin_auth_limits
    where client_fingerprint = v_fingerprint;

    return jsonb_build_object('allowed', true, 'rate_limited', false, 'hash_scheme', 'bcrypt-sha256');
  end if;

  if not found
     or v_limit.window_started < v_now - interval '15 minutes'
     or (v_limit.blocked_until is not null and v_limit.blocked_until <= v_now) then
    v_failures := 1;
  else
    v_failures := v_limit.failed_attempts + 1;
  end if;

  if v_failures >= 8 then
    v_blocked_until := v_now + interval '15 minutes';
  end if;

  insert into public.site_admin_auth_limits(
    client_fingerprint, window_started, failed_attempts, blocked_until, updated_at
  )
  values(
    v_fingerprint,
    case
      when not found
        or v_limit.window_started < v_now - interval '15 minutes'
        or (v_limit.blocked_until is not null and v_limit.blocked_until <= v_now)
      then v_now
      else v_limit.window_started
    end,
    v_failures,
    v_blocked_until,
    v_now
  )
  on conflict (client_fingerprint) do update
  set window_started = excluded.window_started,
      failed_attempts = excluded.failed_attempts,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at;

  if v_blocked_until is not null then
    v_retry := greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer);
  end if;

  return jsonb_build_object(
    'allowed', false,
    'rate_limited', v_blocked_until is not null,
    'retry_after', case when v_retry > 0 then v_retry else null end,
    'remaining_before_block', greatest(0, 8 - v_failures)
  );
end;
$$;

create or replace function public.birthday_admin_change_key(p_new_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prehash text;
begin
  if p_new_key is null or length(p_new_key) < 8 or length(p_new_key) > 128 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_KEY_LENGTH');
  end if;

  v_prehash := encode(extensions.digest(p_new_key, 'sha256'), 'hex');

  update public.site_admin_security
  set key_hash = 'bcrypt-sha256$' || extensions.crypt(
    v_prehash,
    extensions.gen_salt('bf', 12)
  ),
  updated_at = now()
  where id = 'primary';

  return jsonb_build_object('ok', true, 'hash_scheme', 'bcrypt-sha256');
end;
$$;

revoke all on function public.birthday_admin_authorize(text,text) from public, anon, authenticated;
grant execute on function public.birthday_admin_authorize(text,text) to service_role;
revoke all on function public.birthday_admin_change_key(text) from public, anon, authenticated;
grant execute on function public.birthday_admin_change_key(text) to service_role;

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm',
      'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav'
    ]::text[]
where id = 'birthday-media';

update storage.buckets
set public = false
where id = 'birthday-site-web';
