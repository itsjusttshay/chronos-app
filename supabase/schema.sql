-- ═══════════════════════════════════════════════════════
--  CHRONOS — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension (usually already on)
create extension if not exists "uuid-ossp";

-- ── CLIENTS ──────────────────────────────────────────────
create table if not exists clients (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  contact     text,
  rate        numeric(10,2) default 0,
  notes       text,
  color       text default '#FF6B6B',
  year        integer not null default extract(year from now()),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── BLOCKS (time entries) ────────────────────────────────
create table if not exists blocks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references clients(id) on delete cascade not null,
  day         integer not null check (day >= 0 and day <= 6),  -- 0=Mon, 6=Sun
  start_hour  integer not null check (start_hour >= 0 and start_hour <= 23),
  end_hour    integer not null check (end_hour >= 1 and end_hour <= 24),
  task        text not null,
  recur       text default 'none',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────
-- Users can only see/edit their own data

alter table clients enable row level security;
alter table blocks  enable row level security;

-- Clients policies
create policy "Users can view own clients"
  on clients for select using (auth.uid() = user_id);

create policy "Users can insert own clients"
  on clients for insert with check (auth.uid() = user_id);

create policy "Users can update own clients"
  on clients for update using (auth.uid() = user_id);

create policy "Users can delete own clients"
  on clients for delete using (auth.uid() = user_id);

-- Blocks policies
create policy "Users can view own blocks"
  on blocks for select using (auth.uid() = user_id);

create policy "Users can insert own blocks"
  on blocks for insert with check (auth.uid() = user_id);

create policy "Users can update own blocks"
  on blocks for update using (auth.uid() = user_id);

create policy "Users can delete own blocks"
  on blocks for delete using (auth.uid() = user_id);

-- ── AUTO-UPDATE updated_at ───────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

create trigger blocks_updated_at
  before update on blocks
  for each row execute function update_updated_at();

-- ── INDEXES ──────────────────────────────────────────────
create index if not exists idx_clients_user_id on clients(user_id);
create index if not exists idx_clients_year    on clients(year);
create index if not exists idx_blocks_user_id  on blocks(user_id);
create index if not exists idx_blocks_client_id on blocks(client_id);
