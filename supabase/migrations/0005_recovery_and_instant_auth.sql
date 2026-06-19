-- مُلكي — مصادقة بلا اعتماد على البريد:
-- (1) رموز استعادة احتياطية  (2) تسجيل فوري يتجاوز «تأكيد البريد»

-- ============ رموز الاستعادة ============
create table if not exists public.recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_recovery_codes_user on public.recovery_codes(user_id);

alter table public.recovery_codes enable row level security;
drop policy if exists recovery_codes_own on public.recovery_codes;
create policy recovery_codes_own on public.recovery_codes for select using (user_id = auth.uid());

create or replace function public.generate_recovery_codes()
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); codes text[] := array[]::text[]; c text; i int;
begin
  if uid is null then raise exception 'auth required'; end if;
  delete from public.recovery_codes where user_id = uid;
  for i in 1..8 loop
    c := upper(substr(encode(gen_random_bytes(4),'hex'),1,4) || '-' || substr(encode(gen_random_bytes(4),'hex'),1,4));
    codes := array_append(codes, c);
    insert into public.recovery_codes(user_id, code_hash) values (uid, encode(digest(c,'sha256'),'hex'));
  end loop;
  return codes;
end; $$;

create or replace function public.reset_password_with_code(p_email text, p_code text, p_new_password text)
returns json language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_user uuid; v_hash text; v_rec uuid;
begin
  if length(coalesce(p_new_password,'')) < 6 then return json_build_object('ok',false,'reason','weak_password'); end if;
  select id into v_user from auth.users where email = lower(trim(p_email)) limit 1;
  if v_user is null then return json_build_object('ok',false,'reason','invalid'); end if;
  v_hash := encode(digest(upper(trim(p_code)),'sha256'),'hex');
  select id into v_rec from public.recovery_codes where user_id=v_user and code_hash=v_hash and used_at is null limit 1;
  if v_rec is null then return json_build_object('ok',false,'reason','invalid'); end if;
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() where id = v_user;
  update public.recovery_codes set used_at = now() where id = v_rec;
  return json_build_object('ok', true);
end; $$;

revoke all on function public.generate_recovery_codes() from public, anon;
grant execute on function public.generate_recovery_codes() to authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;

-- ============ تسجيل فوري (يتجاوز تأكيد البريد) ============
create or replace function public.instant_signup(p_email text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_email text := lower(trim(p_email)); v_id uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 then return json_build_object('ok',false,'reason','bad_email'); end if;
  if length(coalesce(p_password,'')) < 6 then return json_build_object('ok',false,'reason','weak'); end if;
  if exists (select 1 from auth.users where email = v_email) then return json_build_object('ok',false,'reason','exists'); end if;
  v_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());
  return json_build_object('ok', true, 'created', true);
end; $$;

grant execute on function public.instant_signup(text, text) to anon, authenticated;
