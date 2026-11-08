-- Migration 001: Core organisation, identity and system tables
-- Creates organisations, profiles, departments, organisation_members, system_settings, activity_logs
-- All tenant-scoped tables carry organisation_id and have Row Level Security enabled.

-- 1. Organisations
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website text,
  address text,
  phone text,
  email text,
  logo_url text,
  timezone text not null default 'Africa/Lagos',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed IRIAD organisation
insert into public.organisations (id, name, slug, website, address, phone, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'Initiative for Research, Innovation, and Advocacy in Development (IRIAD)',
  'iriad',
  'https://iriadng.org/',
  '9B Omolara Adeyemi Street, Kings Park IV Estate, Kukwaba, Abuja',
  '+234 704 740 2288',
  'iriadev2020@gmail.com'
) on conflict (slug) do nothing;

-- 2. Departments (within an organisation)
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

-- 3. Profiles (extends Supabase Auth users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('super_admin','staff_admin','ceo','staff')),
  avatar_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Organisation members (many-to-many profile <-> organisation for multi-org future-proofing)
create table if not exists public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('super_admin','staff_admin','ceo','staff')),
  created_at timestamptz not null default now(),
  unique (organisation_id, profile_id)
);

-- 5. System settings (key-value, organisation-scoped)
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, key)
);

-- 6. Activity logs (audit trail)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_org on public.profiles(organisation_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_departments_org on public.departments(organisation_id);
create index if not exists idx_org_members_org on public.organisation_members(organisation_id);
create index if not exists idx_org_members_profile on public.organisation_members(profile_id);
create index if not exists idx_system_settings_org on public.system_settings(organisation_id);
create index if not exists idx_activity_logs_org on public.activity_logs(organisation_id);
create index if not exists idx_activity_logs_actor on public.activity_logs(actor_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at);

-- Enable RLS
alter table public.organisations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_members enable row level security;
alter table public.system_settings enable row level security;
alter table public.activity_logs enable row level security;

-- RLS: Organisations — users can read their own organisation
create policy orgs_select_own on public.organisations
  for select using (
    id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    or id in (
      select organisation_id from public.organisation_members where profile_id = (
        select id from public.profiles where id = auth.uid()
      )
    )
  );

-- RLS: Departments — read within own organisation
create policy depts_select_own on public.departments
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

-- RLS: Profiles — read within own organisation; admins manage
create policy profiles_select_own on public.profiles
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
create policy profiles_manage_admin on public.profiles
  for all using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: Organisation members
create policy org_members_select_own on public.organisation_members
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

-- RLS: System settings — read within org; admins manage
create policy settings_select_own on public.system_settings
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
create policy settings_manage_admin on public.system_settings
  for all using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: Activity logs — read within org; insert allowed for actors
create policy activity_logs_select_own on public.activity_logs
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
create policy activity_logs_insert_own on public.activity_logs
  for insert with check (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and actor_id = auth.uid()
  );
