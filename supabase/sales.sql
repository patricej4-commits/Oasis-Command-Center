-- Sales import (Square sync and Amazon JWO report upload)
-- Run once in Supabase SQL Editor after schema.sql.

create table if not exists sales_days (
  store text not null check (store in ('sugar','jwo')),
  sale_date date not null,
  total_cents bigint not null default 0,
  orders int not null default 0,
  items jsonb not null default '{}'::jsonb,   -- { "Item name": quantity }
  hours jsonb not null default '{}'::jsonb,   -- { "14": number of orders in the 2 PM hour (Central) }
  source text,
  synced_at timestamptz not null default now(),
  primary key (store, sale_date)
);

alter table sales_days enable row level security;
grant select, insert, update, delete on sales_days to authenticated;
drop policy if exists "read_sales_days" on sales_days;
create policy "read_sales_days" on sales_days for select to authenticated using (app_role() is not null);
drop policy if exists "patrice_all_sales_days" on sales_days;
create policy "patrice_all_sales_days" on sales_days for all to authenticated
  using (app_role() = 'patrice') with check (app_role() = 'patrice');
