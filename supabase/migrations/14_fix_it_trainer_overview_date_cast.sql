-- Migration 14: Fix get_it_trainer_overview RPC Date Casting and Location Exposure
-- 1. Eliminates date casting type mismatch (operator does not exist: text = date) by using LEFT(..., 10) = CURRENT_DATE::text
-- 2. Fully exposes tm.location for all records (so check-in location is always accessible in overview and reports)
-- 3. Coalesces tm.last_check_in_date with user_last_check_date for complete user record consistency
-- 4. Ensures strict parity with in-app calculation in trainer-overview and reports route

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
      UNION
      SELECT itp.roadmap_id, itp.user_id FROM public.it_trainer_progress itp
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
      'it_days_count', COALESCE(tm.it_days_logged, at.user_it_days_count, 0),
      'extended_days', COALESCE(tm.extended_days, 0),
      'extension_count', COALESCE(tm.extension_count, 0),
      'location', tm.location,
      'is_online', false,
      'last_it_check_date', COALESCE(tm.last_check_in_date, at.user_last_check_date),
      'is_it_counted_today', (COALESCE(tm.last_check_in_date, at.user_last_check_date) IS NOT NULL AND LEFT(COALESCE(tm.last_check_in_date, at.user_last_check_date)::text, 10) = CURRENT_DATE::text)
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
