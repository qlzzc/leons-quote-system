begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Ensure bigint business-table ids have a safe local default where older tables exist
-- projects
create table if not exists public.projects (
  id bigserial primary key,
  client_id bigint,
  project_code text,
  title text,
  project_title text,
  summary text,
  internal_notes text,
  status text default 'proposal_sent',
  phase_label text,
  service_area text,
  location text,
  service_address text,
  city text,
  province text,
  postal_code text,
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists id bigint,
  add column if not exists client_id bigint,
  add column if not exists project_code text,
  add column if not exists title text,
  add column if not exists project_title text,
  add column if not exists summary text,
  add column if not exists internal_notes text,
  add column if not exists status text default 'proposal_sent',
  add column if not exists phase_label text,
  add column if not exists service_area text,
  add column if not exists location text,
  add column if not exists service_address text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists start_date date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create sequence if not exists public.projects_id_seq;

alter table public.projects
  alter column id set default nextval('public.projects_id_seq');

select setval('public.projects_id_seq', coalesce((select max(id) from public.projects), 0) + 1, false);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'project_title'
  ) then
    update public.projects
    set title = project_title
    where title is null and project_title is not null;

    execute 'alter table public.projects alter column project_title drop not null';
  end if;
end $$;

update public.projects
set status = 'proposal_sent'
where status is null;

alter table public.projects
  alter column client_id drop not null,
  alter column project_code drop not null,
  alter column title drop not null;

create unique index if not exists idx_projects_project_code_unique
  on public.projects (project_code)
  where project_code is not null;

create index if not exists idx_projects_client_id
  on public.projects (client_id);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- quotes
create table if not exists public.quotes (
  id bigserial primary key,
  project_id bigint,
  version_number integer,
  quote_number text,
  title text,
  intro text,
  currency text default 'CAD',
  status text default 'sent',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  content jsonb not null default '{}'::jsonb,
  pdf_file_path text,
  pdf_file_name text,
  is_current boolean not null default false,
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes
  add column if not exists id bigint,
  add column if not exists project_id bigint,
  add column if not exists version_number integer,
  add column if not exists quote_number text,
  add column if not exists title text,
  add column if not exists intro text,
  add column if not exists currency text default 'CAD',
  add column if not exists status text default 'sent',
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists tax numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0,
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists pdf_file_path text,
  add column if not exists pdf_file_name text,
  add column if not exists is_current boolean not null default false,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create sequence if not exists public.quotes_id_seq;

alter table public.quotes
  alter column id set default nextval('public.quotes_id_seq');

select setval('public.quotes_id_seq', coalesce((select max(id) from public.quotes), 0) + 1, false);

update public.quotes
set status = 'sent'
where status is null;

update public.quotes
set is_current = false
where is_current is null;

update public.quotes
set version_number = 1
where version_number is null;

alter table public.quotes
  alter column project_id drop not null,
  alter column quote_number drop not null,
  alter column title drop not null;

drop index if exists public.idx_quotes_project_id_unique;
drop index if exists public.idx_quotes_quote_number_unique;

create index if not exists idx_quotes_project_version
  on public.quotes (project_id, version_number desc);

create index if not exists idx_quotes_project_current
  on public.quotes (project_id, is_current);

create index if not exists idx_quotes_quote_number
  on public.quotes (quote_number);

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

-- quote_items
create table if not exists public.quote_items (
  id bigserial primary key,
  quote_id bigint,
  sort_order integer not null default 0,
  category text,
  description text,
  room text,
  quantity numeric(12,2),
  unit text,
  unit_price numeric(12,2),
  total_price numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.quote_items
  add column if not exists id bigint,
  add column if not exists quote_id bigint,
  add column if not exists sort_order integer not null default 0,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists room text,
  add column if not exists quantity numeric(12,2),
  add column if not exists unit text,
  add column if not exists unit_price numeric(12,2),
  add column if not exists total_price numeric(12,2) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create sequence if not exists public.quote_items_id_seq;

alter table public.quote_items
  alter column id set default nextval('public.quote_items_id_seq');

select setval('public.quote_items_id_seq', coalesce((select max(id) from public.quote_items), 0) + 1, false);

create index if not exists idx_quote_items_quote_id_sort
  on public.quote_items (quote_id, sort_order);

-- whitelists
alter table public.whitelists
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists client_id bigint,
  add column if not exists project_id bigint,
  add column if not exists access_role text not null default 'client',
  add column if not exists is_active boolean not null default true,
  add column if not exists notes text,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_whitelists_phone_project_unique
  on public.whitelists (phone, project_id);

create index if not exists idx_whitelists_phone_active
  on public.whitelists (phone, is_active);

drop trigger if exists trg_whitelists_updated_at on public.whitelists;
create trigger trg_whitelists_updated_at
before update on public.whitelists
for each row execute function public.set_updated_at();

commit;
