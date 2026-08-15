-- Enable extensions
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- Enum types
create type user_role as enum ('admin', 'manager', 'trainer');
create type access_request_status as enum ('pending', 'approved', 'denied');
create type question_status as enum ('solved', 'attempted', 'unattempted');
create type notification_type as enum ('access_request', 'contest_assigned', 'access_approved', 'access_denied', 'system');

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  emp_id text unique not null,
  full_name text not null,
  email text unique not null,
  emp_email text,
  team text,
  manager text,
  hackerrank_id text,
  role user_role not null default 'trainer',
  created_at timestamptz default now()
);

-- Groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Group members
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- Contests
create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hackerrank_slug text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  created_by uuid references public.users(id),
  last_scraped_at timestamptz,
  created_at timestamptz default now()
);

-- Contest assignments (to group or team)
create table public.contest_assignments (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  team text,
  constraint assignment_target check (group_id is not null or team is not null)
);

-- Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests(id) on delete cascade,
  slug text not null,
  title text not null,
  domain text not null default 'General',
  hackerrank_url text not null,
  max_score integer default 10,
  difficulty text default 'Unknown',
  order_index integer default 0
);

-- Progress
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  status question_status default 'unattempted',
  score integer default 0,
  max_score integer default 10,
  last_submission_at timestamptz,
  updated_at timestamptz default now(),
  unique (contest_id, user_id, question_id)
);

-- Progress performance indexes
create index if not exists idx_progress_contest_id on public.progress(contest_id);
create index if not exists idx_progress_user_id on public.progress(user_id);
create index if not exists idx_progress_contest_status on public.progress(contest_id, status);

-- Access requests
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  message text,
  status access_request_status default 'pending',
  resolved_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  related_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.contests enable row level security;
alter table public.contest_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.progress enable row level security;
alter table public.access_requests enable row level security;
alter table public.notifications enable row level security;

-- Users: everyone can read, only service role can insert/update/delete (done via API routes)
create policy "Users can read all users" on public.users for select using (true);
create policy "Users can update own record" on public.users for update using (auth.uid() = id);

-- Groups: authenticated users can read, admin/manager can write
create policy "Authenticated can read groups" on public.groups for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage groups" on public.groups for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Group members
create policy "Authenticated can read group_members" on public.group_members for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage group_members" on public.group_members for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Contests: authenticated can read; admin/manager can write
create policy "Authenticated can read contests" on public.contests for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage contests" on public.contests for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Assignments
create policy "Authenticated can read assignments" on public.contest_assignments for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage assignments" on public.contest_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Questions
create policy "Authenticated can read questions" on public.questions for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage questions" on public.questions for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Progress: users can read own, admin/manager can read all
create policy "Users read own progress" on public.progress for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Access requests: trainer can insert own, admin/manager can read all
create policy "Trainers can create access requests" on public.access_requests for insert with check (auth.uid() = user_id);
create policy "Users read own requests, admin manager read all" on public.access_requests for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can update access requests" on public.access_requests for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Notifications: users can only see their own
create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users mark own notifications read" on public.notifications for update using (auth.uid() = user_id);

-- Service role bypass (for API routes using service role key)
-- All policies above allow service role implicitly due to RLS bypass.

-- Run after deploying: sets up the 30-minute progress scrape cron job
-- Replace YOUR_RAILWAY_URL and YOUR_API_KEY before running
/*
SELECT cron.schedule(
  'lms-progress-scrape',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'YOUR_RAILWAY_URL/scrape/progress',
      headers := '{"Content-Type": "application/json", "x-api-key": "YOUR_API_KEY"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    );
  $$
);
*/
