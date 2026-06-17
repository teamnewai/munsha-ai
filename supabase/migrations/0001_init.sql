-- ============================================================
-- مُلكي — النواة التقنية (المصدر الواحد للحقيقة)
-- مرجع: وثيقة «الشجرة» — المرحلة الأولى (النواة)
-- PostgreSQL عبر Supabase · عزل بمعرّف المنشأة (org_id) + أمان مستوى الصف (RLS)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1) الملفات الشخصية (مرتبطة بمستخدمي Supabase Auth)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2) جذع المنشأة
-- ============================================================
create table if not exists organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique,
  owner_id          uuid references auth.users(id) on delete set null,
  plan              text not null default 'free',     -- free | growth | professional | business | enterprise
  currency          text not null default 'SAR',
  country           text default 'SA',
  city              text,
  national_address  text,
  activity_code     text,                              -- ISIC4
  logo_url          text,
  settings          jsonb not null default '{}'::jsonb,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists memberships (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'viewer',         -- owner | manager | accountant | maintenance_supervisor | leasing_agent | viewer
  permissions  jsonb not null default '[]'::jsonb,
  seniority    text default 'member',                  -- member | head | gm | owner
  invited_by   uuid references auth.users(id),
  joined_at    timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists office_departments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  dept_key        text not null,
  name            text not null,
  parent_id       uuid references office_departments(id) on delete set null,
  head_member_id  uuid references memberships(id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists employees (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  department_id uuid references office_departments(id) on delete set null,
  job_title     text,
  seniority     text default 'member',
  status        text not null default 'active',         -- active | suspended | terminated
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 3) الأغصان التشغيلية
-- ============================================================
create table if not exists properties (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  address     text,
  city        text,
  country     text default 'SA',
  type        text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists units (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  property_id  uuid references properties(id) on delete cascade,
  unit_number  text,
  type         text,                                    -- apartment | room | studio | villa | shop | office | land | warehouse
  floor        int,
  area_sqm     numeric,
  rent_amount  numeric,
  status       text not null default 'vacant',          -- vacant | occupied | maintenance
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists parties (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  type          text not null default 'tenant',         -- tenant | owner
  phone         text,
  email         text,
  id_number     text,
  portal_access boolean not null default false,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists contracts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  unit_id     uuid references units(id) on delete set null,
  tenant_id   uuid references parties(id) on delete set null,
  owner_id    uuid references parties(id) on delete set null,
  start_date  date,
  end_date    date,
  amount      numeric,
  status      text not null default 'active',           -- draft | active | expired | terminated
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists invoices (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  contract_id  uuid references contracts(id) on delete set null,
  amount       numeric not null default 0,
  vat          numeric generated always as (amount * 0.15) stored,
  due_date     date,
  paid_date    date,
  status       text not null default 'pending',         -- pending | paid | overdue | cancelled
  type         text default 'rent',
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  invoice_id  uuid references invoices(id) on delete set null,
  amount      numeric not null default 0,
  method      text,
  provider    text,                                     -- stripe | moyasar | tap | hyperpay
  reference   text,
  paid_at     timestamptz,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text,
  phone       text,
  email       text,
  source      text,
  status      text not null default 'new',
  city        text,
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists maintenance_requests (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  category       text,
  description    text,
  amount_estimate numeric default 0,
  approval_level text generated always as (
    case when amount_estimate <= 500 then 'auto'
         when amount_estimate <= 2000 then 'manager'
         else 'owner' end
  ) stored,
  status         text not null default 'open',
  requested_by   uuid references auth.users(id),
  assigned_to    uuid,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  title        text not null,
  description  text,
  assignee_id  uuid references auth.users(id),
  department_id uuid references office_departments(id) on delete set null,
  due_date     date,
  priority     text default 'normal',
  status       text not null default 'todo',            -- todo | in_progress | done | overdue
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists employee_leaves (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  type        text default 'annual',
  start_date  date,
  end_date    date,
  status      text not null default 'pending',          -- pending | approved | rejected
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4) السوق البيني (قاعة الخدمات)
-- ============================================================
create table if not exists service_catalog (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  category    text,
  active      boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists service_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  service_key   text,
  title         text,
  description   text,
  country       text, region text, city text, district text,
  budget        numeric,
  status        text not null default 'open',
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 5) أوعية التغذية (الإشعارات، الذكاء، التدقيق، الفوترة)
-- ============================================================
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  body        text,
  level       text default 'info',                      -- info | warning | critical
  read        boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists ai_briefings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  period      text default 'daily',
  data        jsonb not null default '{}'::jsonb,
  narrative   text,
  created_at  timestamptz not null default now()
);

create table if not exists ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  agent       text default 'noor',
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete set null,
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text,
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table if not exists billing_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  tier                  text not null default 'free',
  status                text not null default 'trialing',
  provider              text,
  provider_subscription_id text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create table if not exists plan_limits (
  tier        text primary key,
  price_sar   numeric not null default 0,
  unit_quota  jsonb not null default '{}'::jsonb,
  features    jsonb not null default '[]'::jsonb
);

create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer',
  code        text unique,
  status      text not null default 'pending',
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 6) دوال الأمان (RLS helpers)
-- ============================================================
create or replace function current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid();
$$;

create or replace function is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships where org_id = org and user_id = auth.uid()
  );
$$;

create or replace function has_org_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where org_id = org and user_id = auth.uid() and role = any(roles)
  );
$$;

-- ============================================================
-- 7) تفعيل RLS + سياسات معزولة بالمنشأة
-- ============================================================
do $$
declare t text;
  org_tables text[] := array[
    'organizations','memberships','office_departments','employees','properties','units',
    'parties','contracts','invoices','payments','leads','maintenance_requests','tasks',
    'employee_leaves','service_requests','notifications','ai_briefings','ai_conversations',
    'audit_logs','billing_subscriptions','invitations'
  ];
begin
  -- profiles: المستخدم يرى/يعدّل ملفه فقط
  execute 'alter table profiles enable row level security';
  execute 'drop policy if exists profiles_self on profiles';
  execute 'create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid())';

  -- service_catalog: قراءة عامة للمسجّلين
  execute 'alter table service_catalog enable row level security';
  execute 'drop policy if exists catalog_read on service_catalog';
  execute 'create policy catalog_read on service_catalog for select using (auth.role() = ''authenticated'')';

  -- plan_limits: قراءة عامة
  execute 'alter table plan_limits enable row level security';
  execute 'drop policy if exists limits_read on plan_limits';
  execute 'create policy limits_read on plan_limits for select using (true)';

  foreach t in array org_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_org_isolation on %I', t, t);
    if t = 'organizations' then
      execute format(
        'create policy %I_org_isolation on %I for all using (id in (select current_user_org_ids())) with check (owner_id = auth.uid() or id in (select current_user_org_ids()))',
        t, t);
    else
      execute format(
        'create policy %I_org_isolation on %I for all using (org_id in (select current_user_org_ids())) with check (org_id in (select current_user_org_ids()))',
        t, t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 8) فهارس أساسية
-- ============================================================
create index if not exists idx_memberships_user on memberships(user_id);
create index if not exists idx_memberships_org on memberships(org_id);
create index if not exists idx_units_org on units(org_id);
create index if not exists idx_contracts_org on contracts(org_id);
create index if not exists idx_invoices_org on invoices(org_id);
create index if not exists idx_maintenance_org on maintenance_requests(org_id);
create index if not exists idx_tasks_org on tasks(org_id);
create index if not exists idx_audit_org on audit_logs(org_id);
