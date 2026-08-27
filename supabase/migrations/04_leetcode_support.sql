-- ─────────────────────────────────────────────────────
-- Migration: 04_leetcode_support
-- Enables LeetCode problem assignments, scraping, and progress tracking
-- ─────────────────────────────────────────────────────

-- 1. Add leetcode_id to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS leetcode_id text;

-- 2. Add platform column to contests ('hackerrank' or 'leetcode')
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'hackerrank';

-- 3. Add generic url column to questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS url text;

-- 4. Create table for comprehensive LeetCode user profile stats
CREATE TABLE IF NOT EXISTS public.leetcode_user_stats (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  ranking integer,
  contest_rating integer,
  solved_easy integer DEFAULT 0,
  solved_medium integer DEFAULT 0,
  solved_hard integer DEFAULT 0,
  solved_total integer DEFAULT 0,
  submission_calendar jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz DEFAULT now(),
  sync_status text DEFAULT 'ok',
  sync_error text
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.leetcode_user_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leetcode_user_stats' AND policyname = 'Authenticated users can read leetcode stats'
  ) THEN
    CREATE POLICY "Authenticated users can read leetcode stats"
      ON public.leetcode_user_stats FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leetcode_user_stats' AND policyname = 'Admins and managers can manage leetcode stats'
  ) THEN
    CREATE POLICY "Admins and managers can manage leetcode stats"
      ON public.leetcode_user_stats FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;
END $$;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contests_platform ON public.contests(platform);
CREATE INDEX IF NOT EXISTS idx_users_leetcode_id ON public.users(leetcode_id);
