-- Oasis Command Center schema
-- Paste this whole file into Supabase: SQL Editor > New query > Run.
-- Safe to run once on a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Users and roles
-- ---------------------------------------------------------------
create table if not exists allowed_users (
  email text primary key,
  role text not null check (role in ('patrice','aj')),
  display_name text not null
);

-- Role of the signed in user, or null if not allowed.
create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from allowed_users where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''));
$$;

-- Used by the login page before sending a magic link.
create or replace function is_allowed_email(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from allowed_users where lower(email) = lower(trim(p_email)));
$$;
grant execute on function is_allowed_email(text) to anon, authenticated;
grant execute on function app_role() to authenticated;

create or replace function ct_today() returns date
language sql stable as $$ select (now() at time zone 'America/Chicago')::date $$;

-- ---------------------------------------------------------------
-- Running list
-- ---------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  person_company text,
  what_i_need text,
  current_state text,
  next_action text,
  waiting_on text,
  status text not null default 'In Progress' check (status in (
    'In Progress','Follow-up Needed','Waiting for Reply','Information Needed',
    'Waiting for Approval','Scheduled','On-Hold','On Hold - Waiting on AJ to confirm',
    'Final Review','Done','Cancelled')),
  priority text not null default 'Medium' check (priority in ('Critical','High','Medium','Low')),
  category text,
  next_follow_up date,
  last_update timestamptz not null default now(),
  source_request_id uuid,
  monday_item_id text,
  created_at timestamptz not null default now()
);

-- Rule: Done is only allowed from Final Review.
create or replace function tasks_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'Done' then
    if tg_op = 'INSERT' or old.status <> 'Final Review' then
      raise exception 'Move the item to Final Review before marking it Done.';
    end if;
  end if;
  new.last_update := now();
  return new;
end $$;
drop trigger if exists tasks_guard on tasks;
create trigger tasks_guard before insert or update on tasks
for each row execute function tasks_guard();

create table if not exists task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_role text not null default 'patrice',
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Task requests from AJ
-- ---------------------------------------------------------------
create table if not exists task_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  links text[] not null default '{}',
  priority text check (priority in ('Critical','High','Medium','Low')),
  due_date date,
  status text not null default 'new' check (status in ('new','accepted','dismissed')),
  task_id uuid references tasks(id) on delete set null,
  created_by text not null default 'aj',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Decisions for AJ
-- ---------------------------------------------------------------
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  context text,
  waiting_on text,
  status text not null default 'waiting' check (status in ('waiting','approved','declined','discuss')),
  decided_at timestamptz,
  seen_by_patrice boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists decision_replies (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  author_role text not null,
  action text,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  nudge_date date not null default ct_today(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Attachments (voice notes, images, files) stored in bucket oasis-files
-- ---------------------------------------------------------------
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('request','decision','reply','report','task')),
  owner_id uuid not null,
  path text not null,
  file_name text,
  mime text,
  kind text not null check (kind in ('voice','image','file')),
  created_at timestamptz not null default now()
);
create index if not exists attachments_owner on attachments(owner_type, owner_id);

-- ---------------------------------------------------------------
-- Reports (morning and end of day)
-- ---------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('morning','eod')),
  report_date date not null default ct_today(),
  status text not null default 'draft' check (status in ('draft','published')),
  data jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (kind, report_date)
);

-- ---------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  location text,
  patrice_needed boolean,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Team check-ins
-- ---------------------------------------------------------------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  checkin_time text,
  sort int not null default 0
);

create table if not exists checkin_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references team_members(id) on delete cascade,
  note_date date not null default ct_today(),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (member_id, note_date)
);

-- ---------------------------------------------------------------
-- API access (row level security below decides what each user sees)
-- ---------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['allowed_users','tasks','task_updates','task_requests','decisions',
    'decision_replies','nudges','attachments','reports','meetings','team_members','checkin_notes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read_%s" on %I', t, t);
    execute format('create policy "read_%s" on %I for select to authenticated using (app_role() is not null)', t, t);
  end loop;

  -- Patrice has full edit on everything
  foreach t in array array['tasks','task_updates','task_requests','decisions','decision_replies',
    'nudges','attachments','reports','meetings','team_members','checkin_notes']
  loop
    execute format('drop policy if exists "patrice_all_%s" on %I', t, t);
    execute format('create policy "patrice_all_%s" on %I for all to authenticated using (app_role() = ''patrice'') with check (app_role() = ''patrice'')', t, t);
  end loop;
end $$;

-- AJ: submit tasks, act on decisions, comment, attach files, answer meetings
drop policy if exists "aj_insert_requests" on task_requests;
create policy "aj_insert_requests" on task_requests for insert to authenticated with check (app_role() = 'aj');
drop policy if exists "aj_update_decisions" on decisions;
create policy "aj_update_decisions" on decisions for update to authenticated using (app_role() = 'aj') with check (app_role() = 'aj');
drop policy if exists "aj_insert_replies" on decision_replies;
create policy "aj_insert_replies" on decision_replies for insert to authenticated with check (app_role() = 'aj');
drop policy if exists "aj_insert_attachments" on attachments;
create policy "aj_insert_attachments" on attachments for insert to authenticated with check (app_role() = 'aj');
drop policy if exists "aj_update_meetings" on meetings;
create policy "aj_update_meetings" on meetings for update to authenticated using (app_role() = 'aj') with check (app_role() = 'aj');

-- ---------------------------------------------------------------
-- Storage: private bucket
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('oasis-files','oasis-files', false)
on conflict (id) do nothing;

drop policy if exists "oasis_read" on storage.objects;
create policy "oasis_read" on storage.objects for select to authenticated
  using (bucket_id = 'oasis-files' and app_role() is not null);
drop policy if exists "oasis_write" on storage.objects;
create policy "oasis_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'oasis-files' and app_role() is not null);
drop policy if exists "oasis_delete" on storage.objects;
create policy "oasis_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'oasis-files' and app_role() = 'patrice');

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['task_requests','decisions','decision_replies','reports','meetings','tasks']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
