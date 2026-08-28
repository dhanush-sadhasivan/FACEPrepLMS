-- ─────────────────────────────────────────────────────
-- Migration: 09_profile_change_tickets_and_unique_leetcode
-- Enforces unique LeetCode handles and adds support tickets table
-- ─────────────────────────────────────────────────────

-- 1. Create a unique partial index on lower(leetcode_id) so each LeetCode profile is unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_leetcode_id
  ON public.users (lower(trim(leetcode_id)))
  WHERE leetcode_id IS NOT NULL AND trim(leetcode_id) != '';

-- 2. Add audit trace columns to public.users to track who updated a user's profile
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Create support_tickets table for profile changes and support requests
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'profile_update', -- 'profile_update', 'contest_access', 'general'
  requested_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for support_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can view their own support tickets'
  ) THEN
    CREATE POLICY "Users can view their own support tickets"
      ON public.support_tickets FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can create their own support tickets'
  ) THEN
    CREATE POLICY "Users can create their own support tickets"
      ON public.support_tickets FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Admins and managers can view all support tickets'
  ) THEN
    CREATE POLICY "Admins and managers can view all support tickets"
      ON public.support_tickets FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Admins and managers can update support tickets'
  ) THEN
    CREATE POLICY "Admins and managers can update support tickets"
      ON public.support_tickets FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
      );
  END IF;
END $$;
