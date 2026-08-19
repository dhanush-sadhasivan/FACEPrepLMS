-- ─────────────────────────────────────────────────────
-- Migration: 04_internal_training.sql
-- Adds Internal Training Dashboard schema:
-- Day-wise plans, date-specific topics, questions tracking,
-- trainer progress with extended days, and IT day tracking.
-- ─────────────────────────────────────────────────────

-- 1. Create Enum
do $$ begin
  create type question_link_type as enum ('hackerrank', 'custom');
exception
  when duplicate_object then null;
end $$;

-- 2. Add is_it_roadmap column to roadmaps
alter table public.roadmaps
  add column if not exists is_it_roadmap boolean default false;

-- 3. IT Roadmap Configuration
create table if not exists public.it_roadmap_config (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade unique,
  start_date_mode text default 'first_login',
  working_days jsonb default '[1,2,3,4,5]'::jsonb, -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  default_extension_days integer default 3,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. IT Day Plans (Per-day entry for a roadmap)
create table if not exists public.it_day_plans (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  day_number integer not null,
  topic_title text not null,
  description text,
  resources jsonb default '[]'::jsonb, -- [{ "title": "Resource Name", "url": "https://..." }]
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (roadmap_id, day_number)
);

-- 5. IT Day Questions (Questions mapped to a day plan)
create table if not exists public.it_day_questions (
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

-- 6. IT Trainer Progress (Per-trainer state on an IT roadmap)
create table if not exists public.it_trainer_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  started_at date,
  current_day integer default 1,
  extended_days integer default 0,
  extension_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, roadmap_id)
);

-- 7. IT Question Completions (Per-trainer click & completion tracking)
create table if not exists public.it_question_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  day_question_id uuid references public.it_day_questions(id) on delete cascade,
  clicked_at timestamptz,
  completed_at timestamptz,
  is_completed boolean default false,
  created_at timestamptz default now(),
  unique (user_id, day_question_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_it_roadmap_config_roadmap_id on public.it_roadmap_config(roadmap_id);
create index if not exists idx_it_day_plans_roadmap_id on public.it_day_plans(roadmap_id);
create index if not exists idx_it_day_plans_day_number on public.it_day_plans(roadmap_id, day_number);
create index if not exists idx_it_day_questions_day_plan_id on public.it_day_questions(day_plan_id);
create index if not exists idx_it_trainer_progress_user_id on public.it_trainer_progress(user_id);
create index if not exists idx_it_trainer_progress_roadmap_id on public.it_trainer_progress(roadmap_id);
create index if not exists idx_it_question_completions_user on public.it_question_completions(user_id);
create index if not exists idx_it_question_completions_dq on public.it_question_completions(day_question_id);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.it_roadmap_config enable row level security;
alter table public.it_day_plans enable row level security;
alter table public.it_day_questions enable row level security;
alter table public.it_trainer_progress enable row level security;
alter table public.it_question_completions enable row level security;

-- it_roadmap_config: authenticated read, admin/manager write
create policy "Authenticated can read it_roadmap_config" on public.it_roadmap_config
  for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_roadmap_config" on public.it_roadmap_config
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- it_day_plans: authenticated read, admin/manager write
create policy "Authenticated can read it_day_plans" on public.it_day_plans
  for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_plans" on public.it_day_plans
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- it_day_questions: authenticated read, admin/manager write
create policy "Authenticated can read it_day_questions" on public.it_day_questions
  for select using (auth.role() = 'authenticated');
create policy "Admin manager can manage it_day_questions" on public.it_day_questions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- it_trainer_progress: user read/write own, admin/manager read all
create policy "Users manage own it_trainer_progress" on public.it_trainer_progress
  for all using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- it_question_completions: user read/write own, admin/manager read all
create policy "Users manage own it_question_completions" on public.it_question_completions
  for all using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );
