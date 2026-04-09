-- Trainers (looked up / created from Excel)
create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  created_at timestamptz not null default now ()
);

create unique index if not exists trainers_name_normalized_uidx on public.trainers (lower(trim(name)));

-- Companies: add uuid PK while keeping Nimble nimble_id
alter table public.companies add column if not exists id uuid default gen_random_uuid ();

update public.companies set id = gen_random_uuid () where id is null;

alter table public.companies drop constraint if exists companies_pkey;

alter table public.companies alter column id set not null;

alter table public.companies add primary key (id);

alter table public.companies alter column nimble_id drop not null;

create unique index if not exists companies_nimble_id_uidx on public.companies (nimble_id)
where
  nimble_id is not null;

-- Trainings: FKs and extra columns
alter table public.trainings add column if not exists company_id uuid references public.companies (id);

alter table public.trainings add column if not exists trainer_id uuid references public.trainers (id);

alter table public.trainings add column if not exists trainer_share_tl numeric;

alter table public.trainings add column if not exists invoice_date date;

alter table public.trainings add column if not exists year integer;

alter table public.trainings add column if not exists month integer;

-- Drop legacy denormalized columns when present (optional cleanup)
alter table public.trainings drop column if exists company_name;

alter table public.trainings drop column if exists trainer_name;
