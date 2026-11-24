-- Phase 2 additions. Run once in Supabase SQL Editor.

-- Sales dashboard: revenue by item and by hour, and units sold
alter table sales_days add column if not exists units int not null default 0;
alter table sales_days add column if not exists item_revenue jsonb not null default '{}'::jsonb;  -- { "Item": cents }
alter table sales_days add column if not exists hour_revenue jsonb not null default '{}'::jsonb;  -- { "14": cents }

-- Tasks for AJ to complete
create table if not exists aj_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  due_date date,
  status text not null default 'open' check (status in ('open','done')),
  aj_comment text,
  seen_by_patrice boolean not null default true,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table aj_todos enable row level security;
grant select, insert, update, delete on aj_todos to authenticated;
drop policy if exists "read_aj_todos" on aj_todos;
create policy "read_aj_todos" on aj_todos for select to authenticated using (app_role() is not null);
drop policy if exists "patrice_all_aj_todos" on aj_todos;
create policy "patrice_all_aj_todos" on aj_todos for all to authenticated using (app_role() = 'patrice') with check (app_role() = 'patrice');
drop policy if exists "aj_update_aj_todos" on aj_todos;
create policy "aj_update_aj_todos" on aj_todos for update to authenticated using (app_role() = 'aj') with check (app_role() = 'aj');

do $$ begin
  alter publication supabase_realtime add table aj_todos;
exception when duplicate_object then null; end $$;

grant all on all tables in schema public to service_role;
