-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 07_performance_indexes_and_rpc
-- High-Performance Composite Indexes & Internal Training Overview RPC
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. High-Performance Composite B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_progress_user_question ON public.progress(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_progress_contest_user ON public.progress(contest_id, user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_solved ON public.progress(user_id) WHERE status = 'solved' OR score > 0;

CREATE INDEX IF NOT EXISTS idx_it_completions_day_q_user ON public.it_question_completions(day_question_id, user_id);
CREATE INDEX IF NOT EXISTS idx_it_completions_user_id ON public.it_question_completions(user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_assignments_roadmap_group ON public.roadmap_assignments(roadmap_id, group_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_assignments_roadmap_user ON public.roadmap_assignments(roadmap_id, user_id);
CREATE INDEX IF NOT EXISTS idx_contest_assignments_contest_group ON public.contest_assignments(contest_id, group_id);
CREATE INDEX IF NOT EXISTS idx_it_day_questions_day_plan ON public.it_day_questions(day_plan_id);

-- 2. get_it_trainer_overview()
-- Computes real-time cohort progression, attendance days, backlog counts, and extensions for all IT trainers.
CREATE OR REPLACE FUNCTION public.get_it_trainer_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
  -- A. Active IT Roadmaps
  it_rms AS (
    SELECT id, title
    FROM public.roadmaps
    WHERE is_it_roadmap = true
  ),

  -- B. Resolve Assigned Non-Admin Trainers per IT Roadmap
  assigned_trainers AS (
    SELECT DISTINCT
      r.id AS roadmap_id,
      r.title AS roadmap_title,
      u.id AS user_id,
      u.full_name,
      u.emp_id,
      u.email,
      u.team,
      COALESCE(cfg.daily_question_count, 3) AS daily_question_count
    FROM it_rms r
    JOIN public.roadmap_assignments ra ON ra.roadmap_id = r.id
    LEFT JOIN public.group_members gm ON ra.group_id = gm.group_id
    JOIN public.users u ON u.id = COALESCE(ra.user_id, gm.user_id)
    LEFT JOIN public.it_roadmap_config cfg ON cfg.roadmap_id = r.id
    WHERE u.role != 'admin'
  ),

  -- C. Precompute Day Plans & Total Questions per Roadmap
  roadmap_day_plans AS (
    SELECT 
      dp.roadmap_id,
      dp.id AS day_plan_id,
      dp.day_number,
      COUNT(dq.id) AS day_q_count,
      array_agg(dq.id) AS day_q_ids,
      array_agg(dq.question_id) AS hr_q_ids
    FROM public.it_day_plans dp
    JOIN it_rms r ON r.id = dp.roadmap_id
    LEFT JOIN public.it_day_questions dq ON dq.day_plan_id = dp.id
    GROUP BY dp.roadmap_id, dp.id, dp.day_number
  ),

  roadmap_totals AS (
    SELECT 
      roadmap_id,
      COALESCE(SUM(day_q_count), 0)::bigint AS total_questions_count
    FROM roadmap_day_plans
    GROUP BY roadmap_id
  ),

  -- D. Precompute Trainer Progress & Extension Metadata
  trainer_meta AS (
    SELECT 
      p.roadmap_id,
      p.user_id,
      COALESCE(p.it_days_logged, 0) AS it_days_logged,
      COALESCE(p.extended_days, 0) AS extended_days,
      COALESCE(p.extension_count, 0) AS extension_count,
      p.last_check_in_date
    FROM public.it_trainer_progress p
    JOIN it_rms r ON r.id = p.roadmap_id
  ),

  -- E. Precompute Question Completions (Portal Clicks + HackerRank Solved / Manual Completed)
  completions_agg AS (
    SELECT 
      at.roadmap_id,
      at.user_id,
      -- Completed questions count
      COUNT(DISTINCT dq.id) FILTER (
        WHERE (c.is_completed = true OR p.status = 'solved' OR p.score > 0)
      ) AS completed_questions_count,
      -- Questions up to current day
      COUNT(DISTINCT dq.id) FILTER (
        WHERE rdp.day_number <= GREATEST(1, tm.it_days_logged)
      ) AS questions_due_count,
      -- Questions completed up to current day
      COUNT(DISTINCT dq.id) FILTER (
        WHERE rdp.day_number <= GREATEST(1, tm.it_days_logged)
          AND (c.is_completed = true OR p.status = 'solved' OR p.score > 0)
      ) AS questions_done_due_count
    FROM assigned_trainers at
    LEFT JOIN trainer_meta tm ON tm.roadmap_id = at.roadmap_id AND tm.user_id = at.user_id
    LEFT JOIN roadmap_day_plans rdp ON rdp.roadmap_id = at.roadmap_id
    LEFT JOIN public.it_day_questions dq ON dq.day_plan_id = rdp.day_plan_id
    LEFT JOIN public.it_question_completions c ON c.day_question_id = dq.id AND c.user_id = at.user_id
    LEFT JOIN public.progress p ON p.question_id = dq.question_id AND p.user_id = at.user_id
    GROUP BY at.roadmap_id, at.user_id
  )

  -- F. Build Final Item Objects
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', at.user_id,
      'full_name', COALESCE(at.full_name, 'Unknown Trainer'),
      'emp_id', COALESCE(at.emp_id, '—'),
      'email', at.email,
      'team', COALESCE(at.team, 'General'),
      'roadmap_id', at.roadmap_id,
      'roadmap_title', at.roadmap_title,
      'current_day', GREATEST(1, COALESCE(tm.it_days_logged, 1)),
      'completed_questions_count', COALESCE(ca.completed_questions_count, 0),
      'total_questions_count', COALESCE(rt.total_questions_count, 0),
      'pending_questions_count', GREATEST(0, COALESCE(ca.questions_due_count, 0) - COALESCE(ca.questions_done_due_count, 0)),
      'it_days_count', COALESCE(tm.it_days_logged, 0),
      'extended_days', COALESCE(tm.extended_days, 0),
      'extension_count', COALESCE(tm.extension_count, 0),
      'is_online', false
    )
  ) INTO result
  FROM assigned_trainers at
  LEFT JOIN trainer_meta tm ON tm.roadmap_id = at.roadmap_id AND tm.user_id = at.user_id
  LEFT JOIN roadmap_totals rt ON rt.roadmap_id = at.roadmap_id
  LEFT JOIN completions_agg ca ON ca.roadmap_id = at.roadmap_id AND ca.user_id = at.user_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_it_trainer_overview() TO authenticated, service_role, anon;
