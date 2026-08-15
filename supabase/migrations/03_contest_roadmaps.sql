-- ─────────────────────────────────────────────────────
-- Migration: 03_contest_roadmaps
-- Connects Roadmaps to Contests and adds topic completion timestamps
-- ─────────────────────────────────────────────────────

-- Add contest_id to roadmaps table
alter table public.roadmaps
  add column if not exists contest_id uuid references public.contests(id) on delete set null;

-- Add topic_completion_dates to user_roadmap_progress table
alter table public.user_roadmap_progress
  add column if not exists topic_completion_dates jsonb default '{}'::jsonb;

-- Index for contest_id on roadmaps
create index if not exists idx_roadmaps_contest_id on public.roadmaps(contest_id);

-- Ensure RLS policies for Admin/Manager management
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'roadmaps' and policyname = 'Admin manager can manage roadmaps'
  ) then
    create policy "Admin manager can manage roadmaps" on public.roadmaps
      for all using (
        exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
      );
  end if;
end $$;
