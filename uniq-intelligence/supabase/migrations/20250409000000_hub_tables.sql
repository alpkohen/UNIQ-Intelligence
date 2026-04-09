-- Run in Supabase SQL editor or via CLI if you use Supabase migrations.

create table if not exists public.pipeline (
  nimble_deal_id text primary key,
  title text,
  value numeric,
  stage text,
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  nimble_id text primary key,
  name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid (),
  company_name text,
  training_name text,
  start_date date,
  end_date date,
  training_days numeric,
  location text,
  participant_count integer,
  trainer_name text,
  training_fee_tl numeric,
  invoice_status text,
  invoice_number text,
  status text,
  import_signature text not null unique,
  updated_at timestamptz not null default now()
);

create index if not exists trainings_company_name_idx on public.trainings (company_name);
