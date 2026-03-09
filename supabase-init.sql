-- Run this in Supabase SQL Editor
create table if not exists public.wbs_storage (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Optional: update timestamp on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wbs_storage_updated_at on public.wbs_storage;
create trigger trg_wbs_storage_updated_at
before update on public.wbs_storage
for each row
execute function public.set_updated_at();
