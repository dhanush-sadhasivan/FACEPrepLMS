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

-- Indexes
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

-- Courses policies
create policy "Authenticated can read courses" on public.courses for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage courses" on public.courses for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Course assignments policies
create policy "Users read own course assignments" on public.course_assignments for select using (
  auth.uid() = user_id or
  exists (select 1 from public.group_members gm where gm.group_id = course_assignments.group_id and gm.user_id = auth.uid()) or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage course assignments" on public.course_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Roadmaps policies
create policy "Authenticated can read roadmaps" on public.roadmaps for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage roadmaps" on public.roadmaps for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Roadmap assignments policies
create policy "Users read own roadmap assignments" on public.roadmap_assignments for select using (
  auth.uid() = user_id or
  exists (select 1 from public.group_members gm where gm.group_id = roadmap_assignments.group_id and gm.user_id = auth.uid()) or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admin manager can manage roadmap assignments" on public.roadmap_assignments for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- User roadmap progress policies
create policy "Users manage own roadmap progress" on public.user_roadmap_progress for all using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Trainer todos policies
create policy "Users manage own todos" on public.trainer_todos for all using (auth.uid() = user_id);

-- IT Roadmap config policies
create policy "Authenticated can read it_roadmap_config" on public.it_roadmap_config for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_roadmap_config" on public.it_roadmap_config for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- IT Day plans policies
create policy "Authenticated can read it_day_plans" on public.it_day_plans for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_plans" on public.it_day_plans for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- IT Day questions policies
create policy "Authenticated can read it_day_questions" on public.it_day_questions for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_questions" on public.it_day_questions for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- IT Trainer progress policies
create policy "Users manage own it_trainer_progress" on public.it_trainer_progress for all using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- IT Question completions policies
create policy "Users manage own it_question_completions" on public.it_question_completions for all using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- IT Attendance disputes policies
create policy "Authenticated users can read own disputes or admin/manager read all" on public.it_attendance_disputes for select using (
  auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Users can insert own IT disputes" on public.it_attendance_disputes for insert with check (auth.uid() = user_id);
create policy "Admins and managers can update IT disputes" on public.it_attendance_disputes for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- LeetCode user stats policies
create policy "Authenticated users can read leetcode stats" on public.leetcode_user_stats for select using (auth.role() = 'authenticated');
create policy "Admins and managers can manage leetcode stats" on public.leetcode_user_stats for all using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- Support tickets policies
create policy "Users can view their own support tickets" on public.support_tickets for select using (auth.uid() = user_id);
create policy "Users can create their own support tickets" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "Admins and managers can view all support tickets" on public.support_tickets for select using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Admins and managers can update support tickets" on public.support_tickets for update using (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
);

-- ── RPC: get_it_trainer_overview() ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_it_trainer_overview();

CREATE OR REPLACE FUNCTION public.get_it_trainer_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
  it_rms AS (
    SELECT id, title
    FROM public.roadmaps
    WHERE is_it_roadmap = true
  ),
  assigned_trainers AS (
    SELECT DISTINCT
      r.id AS roadmap_id,
      r.title AS roadmap_title,
      u.id AS user_id,
      u.full_name,
      u.emp_id,
      u.email,
      u.team,
      u.last_it_check_date AS user_last_check_date,
      u.it_days_count AS user_it_days_count
    FROM it_rms r
    JOIN (
      SELECT ra.roadmap_id, ra.user_id FROM public.roadmap_assignments ra WHERE ra.user_id IS NOT NULL
      UNION
      SELECT ra.roadmap_id, gm.user_id FROM public.roadmap_assignments ra JOIN public.group_members gm ON gm.group_id = ra.group_id WHERE ra.group_id IS NOT NULL
    ) a ON a.roadmap_id = r.id
    JOIN public.users u ON u.id = a.user_id
    WHERE u.role != 'admin'
  ),
  roadmap_day_plans AS (
    SELECT 
      dp.roadmap_id,
      dp.id AS day_plan_id,
      dp.day_number,
      COUNT(dq.id) AS day_q_count
    FROM public.it_day_plans dp
    JOIN it_rms r ON r.id = dp.roadmap_id
    LEFT JOIN public.it_day_questions dq ON dq.day_plan_id = dp.id
    GROUP BY dp.roadmap_id, dp.id, dp.day_number
  ),
  roadmap_totals AS (
    SELECT 
      roadmap_id,
      COUNT(DISTINCT day_plan_id)::integer AS total_days,
      COALESCE(SUM(day_q_count), 0)::integer AS total_questions_count
    FROM roadmap_day_plans
    GROUP BY roadmap_id
  ),
  trainer_meta AS (
    SELECT 
      p.roadmap_id,
      p.user_id,
      COALESCE(p.it_days_logged, 0) AS it_days_logged,
      COALESCE(p.extended_days, 0) AS extended_days,
      COALESCE(p.extension_count, 0) AS extension_count,
      p.started_at,
      p.last_check_in_date,
      p.location
    FROM public.it_trainer_progress p
    JOIN it_rms r ON r.id = p.roadmap_id
  ),
  completions_agg AS (
    SELECT 
      at.roadmap_id,
      at.user_id,
      COUNT(DISTINCT dq.id) FILTER (
        WHERE c.clicked_at IS NOT NULL 
          AND (
            c.is_completed = true 
            OR (
              p.status = 'solved' 
              AND (CASE WHEN COALESCE(p.max_score, 0) > 0 THEN p.score >= p.max_score ELSE p.score > 0 END)
            )
          )
      ) AS completed_questions_count,
      COUNT(DISTINCT dq.id) FILTER (
        WHERE rdp.day_number <= LEAST(COALESCE(tm.it_days_logged, 0), COALESCE(rt.total_days, 1))
      ) AS questions_due_count,
      COUNT(DISTINCT dq.id) FILTER (
        WHERE rdp.day_number <= LEAST(COALESCE(tm.it_days_logged, 0), COALESCE(rt.total_days, 1))
          AND c.clicked_at IS NOT NULL 
          AND (
            c.is_completed = true 
            OR (
              p.status = 'solved' 
              AND (CASE WHEN COALESCE(p.max_score, 0) > 0 THEN p.score >= p.max_score ELSE p.score > 0 END)
            )
          )
      ) AS questions_done_due_count
    FROM assigned_trainers at
    LEFT JOIN trainer_meta tm ON tm.roadmap_id = at.roadmap_id AND tm.user_id = at.user_id
    LEFT JOIN roadmap_totals rt ON rt.roadmap_id = at.roadmap_id
    LEFT JOIN public.it_day_plans rdp ON rdp.roadmap_id = at.roadmap_id
    LEFT JOIN public.it_day_questions dq ON dq.day_plan_id = rdp.id
    LEFT JOIN public.it_question_completions c ON c.day_question_id = dq.id AND c.user_id = at.user_id
    LEFT JOIN public.progress p ON p.question_id = dq.question_id AND p.user_id = at.user_id
    GROUP BY at.roadmap_id, at.user_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', at.user_id,
      'full_name', COALESCE(at.full_name, 'Unknown Trainer'),
      'emp_id', COALESCE(at.emp_id, '—'),
      'email', at.email,
      'team', COALESCE(at.team, 'General'),
      'roadmap_id', at.roadmap_id,
      'roadmap_title', at.roadmap_title,
      'started_at', tm.started_at,
      'current_day', LEAST(COALESCE(tm.it_days_logged, 0), COALESCE(rt.total_days, 1)),
      'total_days', COALESCE(rt.total_days, 0),
      'completed_questions_count', COALESCE(ca.completed_questions_count, 0),
      'total_questions_count', COALESCE(rt.total_questions_count, 0),
      'pending_questions_count', GREATEST(0, COALESCE(ca.questions_due_count, 0) - COALESCE(ca.questions_done_due_count, 0)),
      'it_days_count', COALESCE(tm.it_days_logged, 0),
      'extended_days', COALESCE(tm.extended_days, 0),
      'extension_count', COALESCE(tm.extension_count, 0),
      'location', CASE WHEN tm.last_check_in_date = CURRENT_DATE THEN tm.location ELSE NULL END,
      'is_online', false,
      'last_it_check_date', tm.last_check_in_date,
      'is_it_counted_today', (tm.last_check_in_date = CURRENT_DATE)
    )
    ORDER BY GREATEST(0, COALESCE(ca.questions_due_count, 0) - COALESCE(ca.questions_done_due_count, 0)) DESC, at.full_name ASC
  ) INTO result
  FROM assigned_trainers at
  LEFT JOIN trainer_meta tm ON tm.roadmap_id = at.roadmap_id AND tm.user_id = at.user_id
  LEFT JOIN roadmap_totals rt ON rt.roadmap_id = at.roadmap_id
  LEFT JOIN completions_agg ca ON ca.roadmap_id = at.roadmap_id AND ca.user_id = at.user_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_it_trainer_overview() TO authenticated, service_role, anon;

