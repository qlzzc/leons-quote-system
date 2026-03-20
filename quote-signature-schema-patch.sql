begin;

create extension if not exists pgcrypto;

create table if not exists public.quote_signatures (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_version_number integer not null,
  quote_number text,
  signer_name text not null,
  signer_phone text,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  status text not null default 'signed' check (status in ('signed', 'archived')),
  source_pdf_path text,
  quote_snapshot jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_quote_signatures_quote_unique
  on public.quote_signatures (quote_id);

create index if not exists idx_quote_signatures_project
  on public.quote_signatures (project_id, signed_at desc);

create index if not exists idx_quote_signatures_client
  on public.quote_signatures (client_id, signed_at desc);

commit;
