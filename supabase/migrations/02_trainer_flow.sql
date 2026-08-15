-- ─────────────────────────────────────────────────────
-- Migration: 02_trainer_flow
-- Adds trainer-specific features: Topic Roadmaps, Courses, To-Do Notes
-- ─────────────────────────────────────────────────────

-- Enum types
create type todo_priority as enum ('high', 'medium', 'low');
create type roadmap_status as enum ('not_started', 'in_progress', 'completed');

-- ── Courses ───────────────────────────────────────────────────────────────
-- Stores course metadata (can be HackerRank contests or custom learning paths)
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'General',  -- e.g., Python, Data Structures, Web, Cloud
  level text not null default 'Beginner',     -- Beginner, Intermediate, Advanced
  duration_weeks integer default 4,
  syllabus jsonb default '[]'::jsonb,         -- Array of { week, topics[], resources[] }
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Assigns courses to individual users or groups
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

-- ── Topic Roadmaps ────────────────────────────────────────────────────────
-- Stores structured learning roadmaps (domain-based)
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  domain text not null default 'General',    -- e.g., DSA, System Design, Web Dev, Python, Cloud
  level text not null default 'Beginner',
  estimated_hours integer default 20,
  topics jsonb default '[]'::jsonb,           -- Array of { id, title, description, resources[], milestone? }
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Assigns roadmaps to users (similar to contests)
create table public.roadmap_assignments (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  assigned_by uuid references public.users(id),
  created_at timestamptz default now(),
  constraint roadmap_assignment_target check (user_id is not null or group_id is not null)
);

-- Tracks per-user progress on roadmap topics
create table public.user_roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  completed_topic_ids jsonb default '[]'::jsonb,  -- Array of topic IDs completed by user
  status roadmap_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, roadmap_id)
);

-- ── Trainer To-Do Notes ───────────────────────────────────────────────────
-- Personal notes/tasks for each trainer
create table public.trainer_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  is_completed boolean default false,
  priority todo_priority not null default 'medium',
  category text default 'General',                -- e.g., Study, Contest Prep, Admin
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_course_assignments_user_id on public.course_assignments(user_id);
create index if not exists idx_course_assignments_group_id on public.course_assignments(group_id);
create index if not exists idx_roadmap_assignments_user_id on public.roadmap_assignments(user_id);
create index if not exists idx_roadmap_assignments_group_id on public.roadmap_assignments(group_id);
create index if not exists idx_user_roadmap_progress_user_id on public.user_roadmap_progress(user_id);
create index if not exists idx_trainer_todos_user_id on public.trainer_todos(user_id);
create index if not exists idx_trainer_todos_due_date on public.trainer_todos(due_date);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.courses enable row level security;
alter table public.course_assignments enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_assignments enable row level security;
alter table public.user_roadmap_progress enable row level security;
alter table public.trainer_todos enable row level security;

-- Courses: all authenticated users can read; admin/manager can write
create policy "Authenticated can read courses" on public.courses
  for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage courses" on public.courses
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- Course assignments: users see their own; admin/manager see all
create policy "Users read own course assignments" on public.course_assignments
  for select using (
    auth.uid() = user_id or
    exists (select 1 from public.group_members gm where gm.group_id = course_assignments.group_id and gm.user_id = auth.uid()) or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );
create policy "Admin manager can manage course assignments" on public.course_assignments
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- Roadmaps: all authenticated users can read; admin/manager can write
create policy "Authenticated can read roadmaps" on public.roadmaps
  for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage roadmaps" on public.roadmaps
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- Roadmap assignments: users see their own; admin/manager see all
create policy "Users read own roadmap assignments" on public.roadmap_assignments
  for select using (
    auth.uid() = user_id or
    exists (select 1 from public.group_members gm where gm.group_id = roadmap_assignments.group_id and gm.user_id = auth.uid()) or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );
create policy "Admin manager can manage roadmap assignments" on public.roadmap_assignments
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- User roadmap progress: users see and write their own; admin/manager see all
create policy "Users manage own roadmap progress" on public.user_roadmap_progress
  for all using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- Trainer todos: users see and write their own only
create policy "Users manage own todos" on public.trainer_todos
  for all using (auth.uid() = user_id);
