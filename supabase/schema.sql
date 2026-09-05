-- ==============================================================================
-- FACEPrep LMS & HackerRank Scraper Database Schema (Consolidated Baseline)
-- Includes all extensions, types, tables, indexes, RLS policies, and hardened RPCs
-- ==============================================================================

-- Enable extensions
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- Enum types
create type user_role as enum ('admin', 'manager', 'trainer');
create type access_request_status as enum ('pending', 'approved', 'denied');
create type question_status as enum ('solved', 'attempted', 'unattempted');
create type notification_type as enum ('access_request', 'contest_assigned', 'access_approved', 'access_denied', 'system', 'announcement');
create type todo_priority as enum ('high', 'medium', 'low');
create type roadmap_status as enum ('not_started', 'in_progress', 'completed');
create type question_link_type as enum ('hackerrank', 'custom');

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
  leetcode_id text,
  role user_role not null default 'trainer',
  it_days_count integer default 0,
  last_it_check_date date default null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now(),
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
  platform text not null default 'hackerrank',
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
  topic text,
  domain text not null default 'General',
  hackerrank_url text not null,
  url text,
  max_score integer default 10,
  difficulty text default 'Unknown',
  order_index integer default 0,
  is_enabled boolean not null default true,
  unique (contest_id, slug)
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

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'General',
  level text not null default 'Beginner',
  duration_weeks integer default 4,
  syllabus jsonb default '[]'::jsonb,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Course assignments
create table public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  assigned_by uuid references public.users(id),
  due_date timestamptz,
  created_at timestamptz default now(),
  constraint course_assignment_target check (user_id is not null or group_id is not null)
);

-- Roadmaps
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  domain text not null default 'General',
  level text not null default 'Beginner',
  estimated_hours integer default 20,
  topics jsonb default '[]'::jsonb,
  contest_id uuid references public.contests(id) on delete set null,
  is_it_roadmap boolean default false,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Roadmap assignments
create table public.roadmap_assignments (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  assigned_by uuid references public.users(id),
  created_at timestamptz default now(),
  constraint roadmap_assignment_target check (user_id is not null or group_id is not null)
);

-- User roadmap progress
create table public.user_roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  completed_topic_ids jsonb default '[]'::jsonb,
  topic_completion_dates jsonb default '{}'::jsonb,
  status roadmap_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, roadmap_id)
);

-- Trainer todos
create table public.trainer_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  is_completed boolean default false,
  priority todo_priority not null default 'medium',
  category text default 'General',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- IT Roadmap config
create table public.it_roadmap_config (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade unique,
  start_date_mode text default 'first_login',
  working_days jsonb default '[1,2,3,4,5]'::jsonb,
  default_extension_days integer default 3,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- IT Day plans
create table public.it_day_plans (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  day_number integer not null,
  topic_title text not null,
  description text,
  resources jsonb default '[]'::jsonb,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (roadmap_id, day_number)
);

-- IT Day questions
create table public.it_day_questions (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid references public.it_day_plans(id) on delete cascade,
  question_type question_link_type not null default 'hackerrank',
  question_id uuid references public.questions(id) on delete set null,
  title text not null,
  description text,
  url text not null,
  order_index integer default 0,
  created_at timestamptz default now()
);

-- IT Trainer progress
create table public.it_trainer_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  started_at date,
  current_day integer default 1,
  extended_days integer default 0,
  extension_count integer default 0,
  it_days_logged integer default 0,
  last_check_in_date date default null,
  location jsonb default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, roadmap_id)
);

-- IT Question completions
create table public.it_question_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  day_question_id uuid references public.it_day_questions(id) on delete cascade,
  clicked_at timestamptz,
  completed_at timestamptz,
  is_completed boolean default false,
  created_at timestamptz default now(),
  unique (user_id, day_question_id)
);

-- IT Attendance disputes
create table public.it_attendance_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  roadmap_id uuid references public.roadmaps(id) on delete cascade not null,
  check_in_date date not null default current_date,
  reason text not null,
  location_at_check_in jsonb default null,
  status text not null default 'pending',
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LeetCode user stats
create table public.leetcode_user_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  username text not null,
  ranking integer,
  contest_rating integer,
  solved_easy integer default 0,
  solved_medium integer default 0,
  solved_hard integer default 0,
  solved_total integer default 0,
  submission_calendar jsonb default '{}'::jsonb,
  last_synced_at timestamptz default now(),
  sync_status text default 'ok',
  sync_error text
);

-- Support tickets
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null default 'profile_update',
  requested_changes jsonb not null default '{}'::jsonb,
  current_values jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto Scrape Scheduler Config
create table if not exists public.auto_scrape_config (
  id uuid primary key default gen_random_uuid(),
  allowed_days integer[] not null default '{1,2,3,4,5}',
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now()
);

-- Auto Scrape Schedules (Daily per-contest)
create table if not exists public.auto_scrape_schedules (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  date date not null default current_date,
  enabled_by uuid references public.users(id) on delete set null,
  is_running boolean not null default false,
  active_job_id text,
  last_triggered_at timestamptz,
  created_at timestamptz default now(),
  unique (contest_id, date)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_users_leetcode_id on public.users(leetcode_id);
create unique index if not exists idx_users_unique_leetcode_id on public.users (lower(trim(leetcode_id))) where leetcode_id is not null and trim(leetcode_id) != '';
create index if not exists idx_contests_platform on public.contests(platform);
create index if not exists idx_questions_contest_id on public.questions(contest_id);
create index if not exists idx_questions_contest_enabled on public.questions(contest_id, is_enabled);
create index if not exists idx_progress_contest_id on public.progress(contest_id);
create index if not exists idx_progress_user_id on public.progress(user_id);
create index if not exists idx_progress_contest_status on public.progress(contest_id, status);
create index if not exists idx_progress_user_question_status on public.progress(user_id, question_id, status);
create index if not exists idx_progress_contest_user_score on public.progress(contest_id, user_id, score);
create index if not exists idx_course_assignments_user_id on public.course_assignments(user_id);
create index if not exists idx_course_assignments_group_id on public.course_assignments(group_id);
create index if not exists idx_roadmaps_contest_id on public.roadmaps(contest_id);
create index if not exists idx_roadmap_assignments_user_id on public.roadmap_assignments(user_id);
create index if not exists idx_roadmap_assignments_group_id on public.roadmap_assignments(group_id);
create index if not exists idx_user_roadmap_progress_user_id on public.user_roadmap_progress(user_id);
create index if not exists idx_trainer_todos_user_id on public.trainer_todos(user_id);
create index if not exists idx_trainer_todos_due_date on public.trainer_todos(due_date);
create index if not exists idx_it_roadmap_config_roadmap_id on public.it_roadmap_config(roadmap_id);
create index if not exists idx_it_day_plans_roadmap_id on public.it_day_plans(roadmap_id);
create index if not exists idx_it_day_plans_day_number on public.it_day_plans(roadmap_id, day_number);
create index if not exists idx_it_day_questions_day_plan_id on public.it_day_questions(day_plan_id);
create index if not exists idx_it_trainer_progress_user_id on public.it_trainer_progress(user_id);
create index if not exists idx_it_trainer_progress_roadmap_id on public.it_trainer_progress(roadmap_id);
create index if not exists idx_it_trainer_progress_user_rm on public.it_trainer_progress(user_id, roadmap_id);
create index if not exists idx_it_question_completions_user on public.it_question_completions(user_id);
create index if not exists idx_it_question_completions_dq on public.it_question_completions(day_question_id);
create index if not exists idx_it_completions_user_clicked on public.it_question_completions(user_id, day_question_id, clicked_at);
create index if not exists idx_it_attendance_disputes_user_id on public.it_attendance_disputes(user_id);
create index if not exists idx_it_attendance_disputes_roadmap_id on public.it_attendance_disputes(roadmap_id);
create index if not exists idx_it_attendance_disputes_status on public.it_attendance_disputes(status);
create index if not exists idx_it_attendance_disputes_date on public.it_attendance_disputes(check_in_date);
create index if not exists idx_support_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_created_at on public.support_tickets(created_at desc);
create index if not exists idx_auto_scrape_schedules_date on public.auto_scrape_schedules(date);


-- ── Row Level Security (RLS) Policies ─────────────────────────────────────────

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.contests enable row level security;
alter table public.contest_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.progress enable row level security;
alter table public.access_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.courses enable row level security;
alter table public.course_assignments enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_assignments enable row level security;
alter table public.user_roadmap_progress enable row level security;
alter table public.trainer_todos enable row level security;
alter table public.it_roadmap_config enable row level security;
alter table public.it_day_plans enable row level security;
alter table public.it_day_questions enable row level security;
alter table public.it_trainer_progress enable row level security;
alter table public.it_question_completions enable row level security;
alter table public.it_attendance_disputes enable row level security;
alter table public.leetcode_user_stats enable row level security;
alter table public.support_tickets enable row level security;
alter table public.auto_scrape_config enable row level security;
alter table public.auto_scrape_schedules enable row level security;

-- 1. Users Policies (Hardened)
create policy "Admins and managers can read all users" on public.users for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'manager'))
);

create policy "Users can read own profile" on public.users for select using (
  auth.uid() = id
);

create policy "Users can update own contact info" on public.users for update using (
  auth.uid() = id
) with check (
  auth.uid() = id and
  role = (select u.role from public.users u where u.id = auth.uid()) and
  emp_id = (select u.emp_id from public.users u where u.id = auth.uid()) and
  it_days_count is not distinct from (select u.it_days_count from public.users u where u.id = auth.uid()) and
  last_it_check_date is not distinct from (select u.last_it_check_date from public.users u where u.id = auth.uid())
);

create policy "Admins and managers can manage users" on public.users for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'manager'))
);

-- 2. Groups
create policy "Authenticated can read groups" on public.groups for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage groups" on public.groups for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 3. Group members
create policy "Authenticated can read group_members" on public.group_members for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage group_members" on public.group_members for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 4. Contests
create policy "Authenticated can read contests" on public.contests for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage contests" on public.contests for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 5. Contest Assignments
create policy "Authenticated can read assignments" on public.contest_assignments for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage assignments" on public.contest_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 6. Questions
create policy "Authenticated can read questions" on public.questions for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage questions" on public.questions for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 7. Progress
create policy "Users read own progress" on public.progress for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage progress" on public.progress for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 8. Access requests
create policy "Trainers can create access requests" on public.access_requests for insert with check (auth.uid() = user_id);
create policy "Users read own requests, admin manager read all" on public.access_requests for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can update access requests" on public.access_requests for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 9. Notifications
create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users mark own notifications read" on public.notifications for update using (auth.uid() = user_id);
create policy "Authenticated can create notifications" on public.notifications for insert with check (auth.role() = 'authenticated');

-- 10. Courses
create policy "Authenticated can read courses" on public.courses for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage courses" on public.courses for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 11. Course assignments
create policy "Users read own course assignments" on public.course_assignments for select using (
  auth.uid() = user_id or
  exists (select 1 from public.group_members gm where gm.group_id = course_assignments.group_id and gm.user_id = auth.uid()) or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage course assignments" on public.course_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 12. Roadmaps
create policy "Authenticated can read roadmaps" on public.roadmaps for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage roadmaps" on public.roadmaps for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 13. Roadmap assignments
create policy "Users read own roadmap assignments" on public.roadmap_assignments for select using (
  auth.uid() = user_id or
  exists (select 1 from public.group_members gm where gm.group_id = roadmap_assignments.group_id and gm.user_id = auth.uid()) or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage roadmap assignments" on public.roadmap_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 14. User roadmap progress
create policy "Users read own roadmap progress or admin manager read all" on public.user_roadmap_progress for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admins and managers can manage user_roadmap_progress" on public.user_roadmap_progress for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 15. Trainer todos
create policy "Users manage own todos" on public.trainer_todos for all using (auth.uid() = user_id);

-- 16. IT Roadmap config
create policy "Authenticated can read it_roadmap_config" on public.it_roadmap_config for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_roadmap_config" on public.it_roadmap_config for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 17. IT Day plans
create policy "Authenticated can read it_day_plans" on public.it_day_plans for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_plans" on public.it_day_plans for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 18. IT Day questions
create policy "Authenticated can read it_day_questions" on public.it_day_questions for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_questions" on public.it_day_questions for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 19. IT Trainer progress (Hardened against attendance forgery)
create policy "Users read own it_trainer_progress or admin manager read all" on public.it_trainer_progress for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admins and managers can manage it_trainer_progress" on public.it_trainer_progress for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 20. IT Question completions
create policy "Users read own it_question_completions or admin manager read all" on public.it_question_completions for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admins and managers can manage it_question_completions" on public.it_question_completions for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 21. IT Attendance disputes
create policy "Users read own IT disputes or admin manager read all" on public.it_attendance_disputes for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Users can insert own IT disputes" on public.it_attendance_disputes for insert with check (auth.uid() = user_id);
create policy "Admins and managers can update IT disputes" on public.it_attendance_disputes for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 22. LeetCode user stats
create policy "Authenticated users can read leetcode stats" on public.leetcode_user_stats for select using (auth.role() = 'authenticated');
create policy "Admins and managers can manage leetcode stats" on public.leetcode_user_stats for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 23. Support tickets
create policy "Users view own support tickets or admin manager view all" on public.support_tickets for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Users can create own support tickets" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "Admins and managers can update support tickets" on public.support_tickets for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- 24. Auto Scrape Config & Schedules
create policy "Admin manager can manage auto_scrape_config" on public.auto_scrape_config for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage auto_scrape_schedules" on public.auto_scrape_schedules for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);


-- ── Storage Bucket Security (`api-cache`) ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('api-cache', 'api-cache', true, 5242880, array['application/json'])
on conflict (id) do update set public = true, allowed_mime_types = array['application/json'];

drop policy if exists "Public Read Cache" on storage.objects;
drop policy if exists "Service Role Manage Cache" on storage.objects;

create policy "Public Read Cache" on storage.objects for select using (bucket_id = 'api-cache');
create policy "Service Role Manage Cache" on storage.objects for all to service_role using (bucket_id = 'api-cache') with check (bucket_id = 'api-cache');


-- ── Hardened Database RPC Stored Procedures ───────────────────────────────────

-- 1. RPC: get_contest_analytics()
drop function if exists public.get_contest_analytics();

create or replace function public.get_contest_analytics()
returns table (
  contest_id uuid,
  title text,
  slug text,
  question_count integer,
  assigned_trainers_count bigint,
  completed_trainers_count bigint,
  total_solved_sum bigint,
  completion_percentage numeric
) 
language plpgsql 
security definer 
set search_path = public, pg_temp
as $$
begin
  return query
  with 
  contest_qs as (
    select 
      q.contest_id as c_id,
      count(q.id)::integer as q_count
    from public.questions q
    where q.is_enabled is not false
    group by q.contest_id
  ),
  assigned_users as (
    select 
      ca.contest_id as c_id, 
      gm.user_id
    from public.contest_assignments ca
    join public.group_members gm on ca.group_id = gm.group_id
    join public.users u on u.id = gm.user_id
    where ca.group_id is not null and u.role != 'admin'
    union
    select 
      ca.contest_id as c_id, 
      u.id as user_id
    from public.contest_assignments ca
    join public.users u on u.team = ca.team
    where ca.team is not null and trim(ca.team) != '' and u.role != 'admin'
  ),
  user_contest_solved as (
    select 
      au.c_id,
      au.user_id,
      coalesce(cq.q_count, 0) as q_count,
      count(distinct p.question_id)::bigint as solved_count
    from assigned_users au
    left join contest_qs cq on cq.c_id = au.c_id
    left join public.questions q on q.contest_id = au.c_id and q.is_enabled is not false
    left join public.progress p on p.contest_id = au.c_id 
      and p.user_id = au.user_id 
      and p.question_id = q.id
      and p.status = 'solved'
      and (
        case 
          when coalesce(p.max_score, q.max_score, 0) > 0 then p.score >= coalesce(p.max_score, q.max_score, 0)
          else p.score > 0 
        end
      )
    group by au.c_id, au.user_id, cq.q_count
  )
  select 
    c.id as contest_id,
    c.title,
    coalesce(c.hackerrank_slug, '') as slug,
    coalesce(cq.q_count, 0) as question_count,
    count(distinct au.user_id)::bigint as assigned_trainers_count,
    count(distinct case when ucs.solved_count >= ucs.q_count and ucs.q_count > 0 then ucs.user_id end)::bigint as completed_trainers_count,
    coalesce(sum(ucs.solved_count), 0)::bigint as total_solved_sum,
    case 
      when count(distinct au.user_id) > 0 and coalesce(cq.q_count, 0) > 0 
      then least(100.0, round((coalesce(sum(ucs.solved_count), 0)::numeric / (cq.q_count * count(distinct au.user_id))) * 100, 1))
      else 0 
    end as completion_percentage
  from public.contests c
  left join contest_qs cq on cq.c_id = c.id
  left join assigned_users au on au.c_id = c.id
  left join user_contest_solved ucs on ucs.c_id = c.id and ucs.user_id = au.user_id
  group by c.id, c.title, c.hackerrank_slug, c.start_date, cq.q_count
  order by c.start_date desc;
end;
$$;

revoke all on function public.get_contest_analytics() from public, anon;
grant execute on function public.get_contest_analytics() to authenticated, service_role;


-- 2. RPC: get_roadmap_analytics()
drop function if exists public.get_roadmap_analytics();

create or replace function public.get_roadmap_analytics()
returns table (
  roadmap_id uuid,
  title text,
  domain text,
  level text,
  total_questions integer,
  assigned_trainers_count bigint,
  completed_trainers_count bigint,
  total_solved_sum bigint,
  completion_percentage numeric
) 
language plpgsql 
security definer 
set search_path = public, pg_temp
as $$
begin
  return query
  with 
  roadmap_questions as (
    select 
      r.id as r_id,
      r.title,
      coalesce(r.domain, 'General') as domain,
      coalesce(r.level, 'Intermediate') as level,
      coalesce(
        (
          select jsonb_agg(distinct (coalesce(q->>'id', q->>'question_id'))::text)
          from jsonb_array_elements(r.topics) as topic
          cross join lateral jsonb_array_elements(
            case 
              when jsonb_typeof(topic->'questions') = 'array' then topic->'questions' 
              else '[]'::jsonb 
            end
          ) as q
          where coalesce(q->>'id', q->>'question_id') is not null
        ),
        (
          select jsonb_agg(distinct (coalesce(t->>'id', t->>'question_id'))::text)
          from jsonb_array_elements(r.topics) as t
          where coalesce(t->>'id', t->>'question_id') is not null
        ),
        '[]'::jsonb
      ) as q_ids
    from public.roadmaps r
  ),
  assigned_cohort as (
    select 
      ra.roadmap_id as r_id,
      ra.user_id as user_id
    from public.roadmap_assignments ra
    join public.users u on u.id = ra.user_id
    where ra.user_id is not null 
      and u.role != 'admin'
    
    union
    
    select 
      ra.roadmap_id as r_id,
      gm.user_id as user_id
    from public.roadmap_assignments ra
    join public.group_members gm on gm.group_id = ra.group_id
    join public.users u on u.id = gm.user_id
    where ra.group_id is not null 
      and u.role != 'admin'
  ),
  user_stats as (
    select 
      ac.r_id,
      ac.user_id,
      jsonb_array_length(rq.q_ids)::integer as total_q,
      count(distinct p.question_id)::bigint as solved_count
    from assigned_cohort ac
    join roadmap_questions rq on rq.r_id = ac.r_id
    left join public.progress p on p.user_id = ac.user_id 
      and rq.q_ids ? (p.question_id)::text
      and p.status = 'solved'
      and (
        case 
          when coalesce(p.max_score, 0) > 0 then p.score >= p.max_score 
          else p.score > 0 
        end
      )
    group by ac.r_id, ac.user_id, rq.q_ids
  )
  select 
    rq.r_id as roadmap_id,
    rq.title,
    rq.domain,
    rq.level,
    jsonb_array_length(rq.q_ids)::integer as total_questions,
    count(distinct ac.user_id)::bigint as assigned_trainers_count,
    count(distinct case when us.solved_count >= us.total_q and us.total_q > 0 then us.user_id end)::bigint as completed_trainers_count,
    coalesce(sum(us.solved_count), 0)::bigint as total_solved_sum,
    case 
      when count(distinct ac.user_id) > 0 and jsonb_array_length(rq.q_ids) > 0 
      then least(100.0, round((coalesce(sum(us.solved_count), 0)::numeric / (jsonb_array_length(rq.q_ids) * count(distinct ac.user_id))) * 100, 1))
      else 0 
    end as completion_percentage
  from roadmap_questions rq
  left join assigned_cohort ac on ac.r_id = rq.r_id
  left join user_stats us on us.r_id = rq.r_id and us.user_id = ac.user_id
  group by rq.r_id, rq.title, rq.domain, rq.level, rq.q_ids;
end;
$$;

revoke all on function public.get_roadmap_analytics() from public, anon;
grant execute on function public.get_roadmap_analytics() to authenticated, service_role;


-- 3. RPC: get_it_trainer_overview() (Restricted to Admins, Managers & Service Role)
drop function if exists public.get_it_trainer_overview();

create or replace function public.get_it_trainer_overview()
returns jsonb 
language plpgsql 
security definer 
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
  result jsonb;
begin
  -- Caller authorization check: must be admin/manager or service_role
  if auth.uid() is not null then
    select role into v_caller_role from public.users where id = auth.uid();
    if v_caller_role not in ('admin', 'manager') then
      raise exception 'Forbidden: Only Admins and Managers can access the IT Trainer Overview';
    end if;
  elsif current_user != 'service_role' and current_user != 'postgres' and current_user != 'supabase_admin' then
    raise exception 'Unauthorized: Authentication required';
  end if;

  with
  it_rms as (
    select id, title
    from public.roadmaps
    where is_it_roadmap = true
  ),
  assigned_trainers as (
    select distinct
      r.id as roadmap_id,
      r.title as roadmap_title,
      u.id as user_id,
      u.full_name,
      u.emp_id,
      u.email,
      u.team,
      u.last_it_check_date as user_last_check_date,
      u.it_days_count as user_it_days_count
    from it_rms r
    join (
      select ra.roadmap_id, ra.user_id from public.roadmap_assignments ra where ra.user_id is not null
      union
      select ra.roadmap_id, gm.user_id from public.roadmap_assignments ra join public.group_members gm on gm.group_id = ra.group_id where ra.group_id is not null
      union
      select itp.roadmap_id, itp.user_id from public.it_trainer_progress itp
    ) a on a.roadmap_id = r.id
    join public.users u on u.id = a.user_id
    where u.role != 'admin'
  ),
  roadmap_day_plans as (
    select 
      dp.roadmap_id,
      dp.id as day_plan_id,
      dp.day_number,
      count(dq.id) as day_q_count
    from public.it_day_plans dp
    join it_rms r on r.id = dp.roadmap_id
    left join public.it_day_questions dq on dq.day_plan_id = dp.id
    group by dp.roadmap_id, dp.id, dp.day_number
  ),
  roadmap_totals as (
    select 
      roadmap_id,
      count(distinct day_plan_id)::integer as total_days,
      coalesce(sum(day_q_count), 0)::integer as total_questions_count
    from roadmap_day_plans
    group by roadmap_id
  ),
  trainer_meta as (
    select 
      p.roadmap_id,
      p.user_id,
      coalesce(p.it_days_logged, 0) as it_days_logged,
      coalesce(p.extended_days, 0) as extended_days,
      coalesce(p.extension_count, 0) as extension_count,
      p.started_at,
      p.last_check_in_date,
      p.location
    from public.it_trainer_progress p
    join it_rms r on r.id = p.roadmap_id
  ),
  completions_agg as (
    select 
      at.roadmap_id,
      at.user_id,
      count(distinct dq.id) filter (
        where c.clicked_at is not null 
          and (
            c.is_completed = true 
            or (
              p.status = 'solved' 
              and (case when coalesce(p.max_score, 0) > 0 then p.score >= p.max_score else p.score > 0 end)
            )
          )
      ) as completed_questions_count,
      count(distinct dq.id) filter (
        where rdp.day_number <= least(coalesce(tm.it_days_logged, 0), coalesce(rt.total_days, 1))
      ) as questions_due_count,
      count(distinct dq.id) filter (
        where rdp.day_number <= least(coalesce(tm.it_days_logged, 0), coalesce(rt.total_days, 1))
          and c.clicked_at is not null 
          and (
            c.is_completed = true 
            or (
              p.status = 'solved' 
              and (case when coalesce(p.max_score, 0) > 0 then p.score >= p.max_score else p.score > 0 end)
            )
          )
      ) as questions_done_due_count
    from assigned_trainers at
    left join trainer_meta tm on tm.roadmap_id = at.roadmap_id and tm.user_id = at.user_id
    left join roadmap_totals rt on rt.roadmap_id = at.roadmap_id
    left join public.it_day_plans rdp on rdp.roadmap_id = at.roadmap_id
    left join public.it_day_questions dq on dq.day_plan_id = rdp.id
    left join public.it_question_completions c on c.day_question_id = dq.id and c.user_id = at.user_id
    left join public.progress p on p.question_id = dq.question_id and p.user_id = at.user_id
    group by at.roadmap_id, at.user_id
  )
  select jsonb_agg(
    jsonb_build_object(
      'user_id', at.user_id,
      'full_name', coalesce(at.full_name, 'Unknown Trainer'),
      'emp_id', coalesce(at.emp_id, '—'),
      'email', at.email,
      'team', coalesce(at.team, 'General'),
      'roadmap_id', at.roadmap_id,
      'roadmap_title', at.roadmap_title,
      'started_at', tm.started_at,
      'current_day', least(coalesce(tm.it_days_logged, 0), coalesce(rt.total_days, 1)),
      'total_days', coalesce(rt.total_days, 0),
      'completed_questions_count', coalesce(ca.completed_questions_count, 0),
      'total_questions_count', coalesce(rt.total_questions_count, 0),
      'pending_questions_count', greatest(0, coalesce(ca.questions_due_count, 0) - coalesce(ca.questions_done_due_count, 0)),
      'it_days_count', coalesce(tm.it_days_logged, at.user_it_days_count, 0),
      'extended_days', coalesce(tm.extended_days, 0),
      'extension_count', coalesce(tm.extension_count, 0),
      'location', tm.location,
      'is_online', false,
      'last_it_check_date', coalesce(tm.last_check_in_date, at.user_last_check_date),
      'is_it_counted_today', (coalesce(tm.last_check_in_date, at.user_last_check_date) is not null and left(coalesce(tm.last_check_in_date, at.user_last_check_date)::text, 10) = current_date::text)
    )
    order by greatest(0, coalesce(ca.questions_due_count, 0) - coalesce(ca.questions_done_due_count, 0)) desc, at.full_name asc
  ) into result
  from assigned_trainers at
  left join trainer_meta tm on tm.roadmap_id = at.roadmap_id and tm.user_id = at.user_id
  left join roadmap_totals rt on rt.roadmap_id = at.roadmap_id
  left join completions_agg ca on ca.roadmap_id = at.roadmap_id and ca.user_id = at.user_id;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.get_it_trainer_overview() from public, anon;
grant execute on function public.get_it_trainer_overview() to authenticated, service_role;


-- 4. RPC: get_user_performance_profile() (Restricted to Self, Admins, Managers & Service Role)
drop function if exists public.get_user_performance_profile(UUID);

create or replace function public.get_user_performance_profile(target_user_id UUID)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
  v_user        json;
  v_summary     json;
  v_leetcode    json;
  v_heatmap     json;
  v_contests    json;
  v_batch_start timestamptz;
begin
  -- Caller authorization check: caller must be self, admin/manager, or service_role
  if auth.uid() is not null then
    select role into v_caller_role from public.users where id = auth.uid();
    if auth.uid() != target_user_id and (v_caller_role is null or v_caller_role not in ('admin', 'manager')) then
      return json_build_object('error', 'Forbidden: You can only view your own performance profile');
    end if;
  elsif current_user != 'service_role' and current_user != 'postgres' and current_user != 'supabase_admin' then
    return json_build_object('error', 'Unauthorized: Authentication required');
  end if;

  -- 1. User Metadata (Safe projection)
  select row_to_json(u) into v_user
  from (
    select id, emp_id, full_name, email, emp_email,
           team, manager, hackerrank_id, leetcode_id, role, created_at
    from public.users
    where id = target_user_id
  ) u;

  if v_user is null then
    return json_build_object('error', 'User not found');
  end if;

  -- 2. Batch start date — earliest contest assigned or participated
  select coalesce(
    min(c.start_date),
    now() - interval '6 months'
  )
  into v_batch_start
  from public.contests c
  where c.id in (
    select ca.contest_id from public.contest_assignments ca join public.group_members gm on gm.group_id = ca.group_id where gm.user_id = target_user_id
    union
    select ca.contest_id from public.contest_assignments ca join public.users u on u.team = ca.team where u.id = target_user_id and ca.team is not null and ca.team != ''
    union
    select p.contest_id from public.progress p where p.user_id = target_user_id
  );

  -- 3. Summary Stats (Deduplicated MAX score per question)
  with dedup_q as (
    select
      p.question_id,
      max(coalesce(p.score, 0)) as max_achieved_score,
      bool_or(
        p.status = 'solved'
        and (
          case 
            when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
            else coalesce(p.score, 0) > 0 
          end
        )
      ) as is_solved,
      bool_or(p.status in ('solved', 'attempted') or coalesce(p.score, 0) > 0) as is_attempted
    from public.progress p
    left join public.questions q on q.id = p.question_id
    where p.user_id = target_user_id and q.is_enabled is not false
    group by p.question_id
  )
  select row_to_json(s) into v_summary
  from (
    select
      count(distinct question_id) filter (where is_solved) as total_solved,
      coalesce(sum(max_achieved_score), 0) as total_score,
      (
        select count(distinct p2.contest_id)
        from public.progress p2
        where p2.user_id = target_user_id
          and (p2.status in ('solved', 'attempted') or coalesce(p2.score, 0) > 0)
      ) as contests_participated,
      count(distinct question_id) filter (where is_attempted) as problems_attempted
    from dedup_q
  ) s;

  -- 4. LeetCode Stats
  select row_to_json(lc) into v_leetcode
  from (
    select
      solved_easy, solved_medium, solved_hard, solved_total,
      ranking, contest_rating, submission_calendar, last_synced_at
    from public.leetcode_user_stats
    where user_id = target_user_id
    limit 1
  ) lc;

  -- 5. Activity Heatmap (Asia/Kolkata timezone, strict solves only)
  select json_agg(h order by h.day) into v_heatmap
  from (
    select
      to_char(p.last_submission_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day,
      count(distinct case
        when p.status = 'solved'
          and (
            case 
              when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
              else coalesce(p.score, 0) > 0 
            end
          )
        then p.question_id
      end) as solve_count
    from public.progress p
    left join public.questions q on q.id = p.question_id
    where
      p.user_id = target_user_id
      and p.last_submission_at is not null
      and p.last_submission_at >= v_batch_start
      and q.is_enabled is not false
    group by to_char(p.last_submission_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD')
    having count(distinct case
      when p.status = 'solved'
        and (
          case 
            when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
            else coalesce(p.score, 0) > 0 
          end
        )
      then p.question_id
    end) > 0
  ) h;

  -- 6. Per-contest breakdown
  select json_agg(cd order by cd.start_date desc) into v_contests
  from (
    select
      c.id,
      c.title,
      coalesce(c.platform, 'hackerrank') as platform,
      c.start_date,
      c.end_date,
      c.hackerrank_slug,
      count(distinct q.id) as total_questions,
      count(distinct case
        when p.status = 'solved'
          and (
            case 
              when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
              else coalesce(p.score, 0) > 0 
            end
          )
        then q.id
      end) as solved_count,
      coalesce(sum(p.score), 0) as score,
      coalesce(sum(coalesce(q.max_score, p.max_score, 10)), 0) as max_score,
      json_agg(
        json_build_object(
          'id',                 q.id,
          'title',              q.title,
          'domain',             coalesce(q.domain, 'General'),
          'difficulty',         coalesce(q.difficulty, 'Medium'),
          'hackerrank_url',     coalesce(q.hackerrank_url, q.url, ''),
          'max_score',          coalesce(q.max_score, p.max_score, 10),
          'status',             case
                                  when p.status = 'solved'
                                    and (
                                      case 
                                        when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
                                        else coalesce(p.score, 0) > 0 
                                      end
                                    )
                                  then 'solved'
                                  when p.status = 'attempted' or coalesce(p.score, 0) > 0
                                  then 'attempted'
                                  else 'unattempted'
                                end,
          'score',              coalesce(p.score, 0),
          'last_submission_at', p.last_submission_at
        ) order by q.order_index asc nulls last, q.title asc
      ) as questions
    from public.contests c
    inner join public.questions q on q.contest_id = c.id and q.is_enabled is not false
    left join public.progress p on p.question_id = q.id and p.user_id = target_user_id and p.contest_id = c.id
    where c.id in (
      select ca.contest_id from public.contest_assignments ca join public.group_members gm on gm.group_id = ca.group_id where gm.user_id = target_user_id
      union
      select ca.contest_id from public.contest_assignments ca join public.users u on u.team = ca.team where u.id = target_user_id and ca.team is not null and ca.team != ''
      union
      select p.contest_id from public.progress p where p.user_id = target_user_id
    )
    group by c.id, c.title, c.platform, c.start_date, c.end_date, c.hackerrank_slug
  ) cd;

  return json_build_object(
    'user',        v_user,
    'summary',     v_summary,
    'leetcode',    v_leetcode,
    'heatmap',     coalesce(v_heatmap, '[]'::json),
    'contests',    coalesce(v_contests, '[]'::json),
    'batch_start', v_batch_start
  );
end;
$$;

revoke all on function public.get_user_performance_profile(UUID) from public, anon;
grant execute on function public.get_user_performance_profile(UUID) to authenticated, service_role;


-- 5. RPC: get_global_leaderboard()
drop function if exists public.get_global_leaderboard();

create or replace function public.get_global_leaderboard()
returns table (
  id uuid,
  user_id uuid,
  name text,
  emp_id text,
  team text,
  score bigint,
  solved bigint
) 
language plpgsql 
security definer 
set search_path = public, pg_temp
as $$
begin
  return query
  with 
  dedup_progress as (
    select
      p.user_id,
      p.question_id,
      max(coalesce(p.score, 0)) as max_score,
      bool_or(
        p.status = 'solved'
        and (
          case 
            when coalesce(p.max_score, q.max_score, 0) > 0 then coalesce(p.score, 0) >= coalesce(p.max_score, q.max_score, 0)
            else coalesce(p.score, 0) > 0 
          end
        )
      ) as is_solved
    from public.progress p
    left join public.questions q on q.id = p.question_id
    where q.is_enabled is not false
    group by p.user_id, p.question_id
  ),
  user_aggregates as (
    select
      dp.user_id,
      coalesce(sum(dp.max_score), 0)::bigint as total_score,
      count(distinct dp.question_id) filter (where dp.is_solved)::bigint as total_solved
    from dedup_progress dp
    group by dp.user_id
  )
  select
    u.id,
    u.id as user_id,
    u.full_name as name,
    coalesce(u.emp_id, '—') as emp_id,
    coalesce(u.team, 'N/A') as team,
    coalesce(ua.total_score, 0)::bigint as score,
    coalesce(ua.total_solved, 0)::bigint as solved
  from public.users u
  left join user_aggregates ua on ua.user_id = u.id
  where u.role != 'admin'
  order by score desc, solved desc, name asc;
end;
$$;

revoke all on function public.get_global_leaderboard() from public, anon;
grant execute on function public.get_global_leaderboard() to authenticated, service_role;


-- 6. RPC: get_contest_leaderboard_rpc()
drop function if exists public.get_contest_leaderboard_rpc(UUID);

create or replace function public.get_contest_leaderboard_rpc(p_contest_id UUID)
returns jsonb 
language plpgsql 
security definer 
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  with
  enabled_questions as (
    select
      q.id,
      q.contest_id,
      q.slug,
      q.title,
      coalesce(q.domain, 'General') as domain,
      coalesce(q.difficulty, 'Medium') as difficulty,
      coalesce(q.hackerrank_url, q.url, '') as hackerrank_url,
      coalesce(q.max_score, 10) as max_score,
      q.order_index
    from public.questions q
    where q.contest_id = p_contest_id
      and q.is_enabled is not false
  ),
  contest_summary as (
    select
      count(id)::integer as total_questions_count,
      coalesce(sum(max_score), 0)::integer as total_max_score
    from enabled_questions
  ),
  assigned_users as (
    select distinct gm.user_id
    from public.contest_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
    join public.users u on u.id = gm.user_id
    where ca.contest_id = p_contest_id
      and ca.group_id is not null
      and u.role != 'admin'
    
    union
    
    select distinct u.id as user_id
    from public.contest_assignments ca
    join public.users u on u.team = ca.team
    where ca.contest_id = p_contest_id
      and ca.team is not null
      and ca.team != ''
      and u.role != 'admin'
  ),
  effective_users as (
    select user_id from assigned_users
    union
    select distinct p.user_id
    from public.progress p
    join public.users u on u.id = p.user_id
    where p.contest_id = p_contest_id
      and u.role != 'admin'
      and not exists (select 1 from assigned_users)
  ),
  user_progress as (
    select
      eu.user_id,
      u.full_name as name,
      coalesce(u.emp_id, '—') as emp_id,
      coalesce(u.team, 'N/A') as team,
      u.hackerrank_id,
      u.leetcode_id,
      coalesce(
        count(distinct eq.id) filter (
          where p.status = 'solved'
            and (case when eq.max_score > 0 then coalesce(p.score, 0) >= eq.max_score else coalesce(p.score, 0) > 0 end)
        ), 0
      )::integer as solved,
      (select total_questions_count from contest_summary) as total,
      coalesce(sum(coalesce(p.score, 0)), 0)::integer as score,
      (select total_max_score from contest_summary) as max_score,
      max(
        case
          when (p.status = 'solved' or p.status = 'attempted' or coalesce(p.score, 0) > 0)
          then coalesce(p.last_submission_at, p.updated_at)
          else null
        end
      ) as last_active,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'question_id', eq.id,
            'status', case
                        when p.status = 'solved' and (case when eq.max_score > 0 then coalesce(p.score, 0) >= eq.max_score else coalesce(p.score, 0) > 0 end) then 'solved'
                        when p.status = 'attempted' or coalesce(p.score, 0) > 0 then 'attempted'
                        else coalesce(p.status, 'unattempted')
                      end,
            'score', coalesce(p.score, 0),
            'max_score', eq.max_score,
            'last_submission_at', p.last_submission_at,
            'updated_at', p.updated_at
          ) order by eq.order_index asc nulls last, eq.title asc
        ) filter (where eq.id is not null),
        '[]'::jsonb
      ) as progress
    from effective_users eu
    join public.users u on u.id = eu.user_id
    cross join enabled_questions eq
    left join public.progress p on p.contest_id = p_contest_id
      and p.user_id = eu.user_id
      and p.question_id = eq.id
    group by eu.user_id, u.full_name, u.emp_id, u.team, u.hackerrank_id, u.leetcode_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', up.user_id,
        'name', up.name,
        'emp_id', up.emp_id,
        'team', up.team,
        'hackerrank_id', up.hackerrank_id,
        'leetcode_id', up.leetcode_id,
        'solved', up.solved,
        'total', up.total,
        'score', up.score,
        'maxScore', up.max_score,
        'lastActive', up.last_active,
        'progress', up.progress
      )
      order by up.score desc, up.solved desc, up.name asc
    ),
    '[]'::jsonb
  ) into v_result
  from user_progress up;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.get_contest_leaderboard_rpc(UUID) from public, anon;
grant execute on function public.get_contest_leaderboard_rpc(UUID) to authenticated, service_role;
