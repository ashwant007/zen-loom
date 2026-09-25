-- Run this once in Supabase → SQL Editor → New query → Run.
-- It creates the memory ZEN needs.

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  loom_no text default '',
  weaver text default '',
  design_code text default '',
  columns jsonb default '[]',
  rows jsonb default '[]',
  doubts jsonb default '[]',
  status text default 'draft',
  updated_at timestamptz default now()
);

-- Log of every edit to an already-saved card (old value, new value, time).
create table if not exists edit_log (
  id uuid primary key default gen_random_uuid(),
  card_id uuid,
  field text,
  old_value text,
  new_value text,
  changed_at timestamptz default now()
);
