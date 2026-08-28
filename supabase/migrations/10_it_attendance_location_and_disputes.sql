-- ─────────────────────────────────────────────────────
-- Migration: 10_it_attendance_location_and_disputes.sql
-- Adds location tracking to it_trainer_progress
-- and creates it_attendance_disputes table for IT toggle
-- dispute ticket workflow.
-- ─────────────────────────────────────────────────────

-- 1. Add location column to it_trainer_progress
alter table public.it_trainer_progress
  add column if not exists location jsonb default null;

-- 2. Create IT Attendance Disputes table
create table if not exists public.it_attendance_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  roadmap_id uuid references public.roadmaps(id) on delete cascade not null,
  check_in_date date not null default current_date,
  reason text not null,
  location_at_check_in jsonb default null,
  status text not null default 'pending', -- 'pending' | 'resolved' | 'rejected'
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Create Indexes
create index if not exists idx_it_attendance_disputes_user_id on public.it_attendance_disputes(user_id);
create index if not exists idx_it_attendance_disputes_roadmap_id on public.it_attendance_disputes(roadmap_id);
create index if not exists idx_it_attendance_disputes_status on public.it_attendance_disputes(status);
create index if not exists idx_it_attendance_disputes_date on public.it_attendance_disputes(check_in_date);

-- 4. Enable Row-Level Security
alter table public.it_attendance_disputes enable row level security;

-- 5. RLS Policies
create policy "Authenticated users can read own disputes or admin/manager read all" on public.it_attendance_disputes
  for select using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Users can insert own IT disputes" on public.it_attendance_disputes
  for insert with check (
    auth.uid() = user_id
  );

create policy "Admins and managers can update IT disputes" on public.it_attendance_disputes
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );
