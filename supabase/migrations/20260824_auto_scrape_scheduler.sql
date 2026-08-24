-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260824_auto_scrape_scheduler
-- Auto-Scrape Scheduler — Day-config + daily contest selection tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Global config: which weekdays auto-scrape is allowed (singleton row)
CREATE TABLE IF NOT EXISTS public.auto_scrape_config (
  id           uuid primary key default gen_random_uuid(),
  allowed_days integer[] not null default '{1,2,3,4,5}',  -- 0=Sun,1=Mon,...,6=Sat
  updated_by   uuid references public.users(id) on delete set null,
  updated_at   timestamptz default now()
);

-- Seed one row so GET always returns something
INSERT INTO public.auto_scrape_config (allowed_days)
VALUES ('{1,2,3,4,5}')
ON CONFLICT DO NOTHING;

-- 2. Daily per-contest schedule: which contests to scrape today
CREATE TABLE IF NOT EXISTS public.auto_scrape_schedules (
  id                  uuid primary key default gen_random_uuid(),
  contest_id          uuid not null references public.contests(id) on delete cascade,
  date                date not null default current_date,
  enabled_by          uuid references public.users(id) on delete set null,
  is_running          boolean not null default false,
  active_job_id       text,                   -- Railway jobId, stored for reference
  last_triggered_at   timestamptz,
  created_at          timestamptz default now(),
  unique(contest_id, date)
);

-- Index for fast daily lookups
CREATE INDEX IF NOT EXISTS idx_auto_scrape_schedules_date
  ON public.auto_scrape_schedules(date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.auto_scrape_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_scrape_schedules ENABLE ROW LEVEL SECURITY;

-- Only admin/manager can read or write config
CREATE POLICY "Admin manager can manage auto_scrape_config"
  ON public.auto_scrape_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Only admin/manager can read or write schedules
CREATE POLICY "Admin manager can manage auto_scrape_schedules"
  ON public.auto_scrape_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Service role bypass is implicit (RLS bypassed for service_role key).

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron setup (run MANUALLY in Supabase SQL Editor after deploy)
-- Replace YOUR_LMS_URL and YOUR_CRON_SECRET before running.
--
-- Runs every 30 minutes from 04:30 UTC to 12:30 UTC
-- = 10:00 AM to 6:00 PM IST (Asia/Kolkata, UTC+5:30)
--
-- SELECT cron.schedule(
--   'auto-scrape-30min',
--   '0,30 4-12 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'YOUR_LMS_URL/api/scrape/auto-cron',
--       headers := '{"Content-Type":"application/json","x-api-key":"YOUR_CRON_SECRET"}'::jsonb,
--       body    := '{}'::jsonb
--     );
--   $$
-- );
--
-- To view scheduled jobs:   SELECT * FROM cron.job;
-- To remove job:            SELECT cron.unschedule('auto-scrape-30min');
-- ─────────────────────────────────────────────────────────────────────────────
