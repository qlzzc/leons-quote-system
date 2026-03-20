-- Leon's Venetian Plaster
-- Client Portal MVP schema
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  primary_phone text,
  status text not null default 'active' check (status in ('active', 'lead', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_phones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  phone text not null,
  label text default 'primary',
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, phone)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_code text not null unique,
  title text not null,
  location text,
  summary text,
  internal_notes text,
  status text not null default 'proposal_sent' check (
    status in ('draft', 'proposal_sent', 'under_review', 'approved', 'contract_sent', 'signed', 'in_progress', 'completed', 'archived')
  ),
  phase_label text,
  service_area text,
  service_address text,
  city text,
  province text,
  postal_code text,
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version_number integer not null default 1,
  quote_number text,
  title text not null,
  intro text,
  currency text not null default 'CAD',
  status text not null default 'sent' check (status in ('draft', 'sent', 'viewed', 'approved', 'superseded', 'signed')),
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

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  sort_order integer not null default 0,
  category text,
  description text not null,
  room text,
  quantity numeric(12,2),
  unit text,
  unit_price numeric(12,2),
  total_price numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  asset_type text not null check (asset_type in ('render', 'reference', 'photo', 'document', 'attachment')),
  title text not null,
  description text,
  file_url text not null,
  thumbnail_url text,
  sort_order integer not null default 0,
  is_client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  version integer not null default 1,
  title text not null,
  body_markdown text,
  body_html text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'signed', 'archived')),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create table if not exists contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  signer_role text not null check (signer_role in ('client', 'studio')),
  signer_name text not null,
  signer_phone text,
  signature_data text not null,
  consent_text text,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create table if not exists whitelists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  phone text not null,
  access_role text not null default 'client' check (access_role in ('client', 'admin')),
  is_active boolean not null default true,
  notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone, project_id)
);

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  context_key text not null default 'portal',
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  unique (phone, context_key)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  client_id uuid references clients(id) on delete set null,
  access_role text not null default 'client' check (access_role in ('client', 'admin')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists access_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  phone text,
  action text not null,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  timestamp timestamptz not null default now()
);

create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  identifier_type text not null check (identifier_type in ('ip', 'phone')),
  context_key text not null default 'portal',
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  unique (identifier, identifier_type, context_key)
);

create index if not exists idx_clients_phone on clients(primary_phone);
create index if not exists idx_client_phones_phone on client_phones(phone);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_quotes_project on quotes(project_id, version_number desc);
create index if not exists idx_quotes_project_current on quotes(project_id, is_current);
create index if not exists idx_quote_items_quote on quote_items(quote_id, sort_order);
create index if not exists idx_project_assets_project on project_assets(project_id, sort_order);
create index if not exists idx_contracts_project on contracts(project_id, version desc);
create index if not exists idx_signatures_contract on contract_signatures(contract_id);
create index if not exists idx_whitelists_phone on whitelists(phone, is_active);
create index if not exists idx_sessions_token on sessions(token_hash);
create index if not exists idx_access_logs_timestamp on access_logs(timestamp desc);
create index if not exists idx_access_logs_phone on access_logs(phone);
create index if not exists idx_rate_limits_lookup on rate_limits(identifier, identifier_type, context_key);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients
for each row execute function set_updated_at();

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects
for each row execute function set_updated_at();

drop trigger if exists trg_quotes_updated_at on quotes;
create trigger trg_quotes_updated_at before update on quotes
for each row execute function set_updated_at();

drop trigger if exists trg_contracts_updated_at on contracts;
create trigger trg_contracts_updated_at before update on contracts
for each row execute function set_updated_at();

drop trigger if exists trg_whitelists_updated_at on whitelists;
create trigger trg_whitelists_updated_at before update on whitelists
for each row execute function set_updated_at();

insert into clients (id, full_name, email, primary_phone, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Ude',
  'ude@example.com',
  '+17801234567',
  'active'
)
on conflict (id) do nothing;

insert into client_phones (client_id, phone, label, is_primary)
values (
  '11111111-1111-1111-1111-111111111111',
  '+17801234567',
  'mobile',
  true
)
on conflict (client_id, phone) do nothing;

insert into projects (id, client_id, project_code, title, location, summary, status, phase_label, service_area, service_address, city, province, postal_code)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'LVP-2026-0042',
  'Three-Room Crown Moulding Upgrade',
  'Edmonton, Alberta',
  'A residential trim and finish proposal covering the dining room, den, and primary suite.',
  'proposal_sent',
  'Proposal review',
  'Edmonton',
  '123 Example Crescent',
  'Edmonton',
  'AB',
  'T5A 0A1'
)
on conflict (id) do nothing;

insert into quotes (id, project_id, version_number, quote_number, title, intro, status, subtotal, tax, total, is_current, sent_at)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  1,
  'Q2026-0042',
  'Crown Moulding Proposal',
  'A finish-led proposal prepared for review, approval, and contract progression.',
  'sent',
  4193.56,
  209.68,
  4403.24,
  true,
  now()
)
on conflict (id) do nothing;

insert into quote_items (quote_id, sort_order, category, description, room, quantity, unit, unit_price, total_price)
values
  ('33333333-3333-3333-3333-333333333333', 1, 'Materials', 'Alexandria Colonial MDF Crown Moulding 144"', 'All Rooms', 17, 'pcs', 77.68, 1320.56),
  ('33333333-3333-3333-3333-333333333333', 2, 'Materials', 'Caulk, adhesive, fasteners, primer, paint', 'All Rooms', 1, 'lot', 193.00, 193.00),
  ('33333333-3333-3333-3333-333333333333', 3, 'Labour', 'Crown moulding installation', 'Dining + Den + Primary Suite', 163, 'lf', 10.00, 1630.00),
  ('33333333-3333-3333-3333-333333333333', 4, 'Labour', 'On-site spray painting', 'Dining Room', 1, 'room', 300.00, 300.00),
  ('33333333-3333-3333-3333-333333333333', 5, 'Labour', 'On-site spray painting', 'Den', 1, 'room', 300.00, 300.00),
  ('33333333-3333-3333-3333-333333333333', 6, 'Labour', 'On-site spray painting with vaulted ceiling setup', 'Primary Suite', 1, 'room', 450.00, 450.00)
on conflict do nothing;

insert into project_assets (project_id, quote_id, asset_type, title, description, file_url, sort_order)
values
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'render', 'Render 01', 'Primary concept view.', 'https://raw.githubusercontent.com/qlzzc/leons-quote-system/main/01.png', 1),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'render', 'Render 02', 'Secondary concept view.', 'https://raw.githubusercontent.com/qlzzc/leons-quote-system/main/02.png', 2),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'render', 'Render 03', 'Detail concept view.', 'https://raw.githubusercontent.com/qlzzc/leons-quote-system/main/03.png', 3)
on conflict do nothing;

insert into contracts (id, project_id, quote_id, version, title, body_markdown, status, sent_at)
values (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  1,
  'Residential Finish Agreement',
  'This contract records the approved scope, payment terms, and execution agreement for the project.',
  'sent',
  now()
)
on conflict (id) do nothing;

insert into whitelists (client_id, project_id, phone, access_role, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '+17801234567',
  'client',
  true
)
on conflict (phone, project_id) do nothing;
