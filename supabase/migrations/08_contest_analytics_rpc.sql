-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 08_contest_analytics_rpc
-- Stored Procedure for Fast Database-Level Contest Completion Analytics
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_contest_analytics();

CREATE OR REPLACE FUNCTION public.get_contest_analytics()
RETURNS TABLE (
  contest_id uuid,
  title text,
  slug text,
  question_count integer,
  assigned_trainers_count bigint,
  completed_trainers_count bigint,
  total_solved_sum bigint,
  completion_percentage numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH 
  contest_qs AS (
    SELECT 
      q.contest_id AS c_id,
      COUNT(q.id)::integer AS q_count
    FROM public.questions q
    WHERE q.is_enabled IS NOT FALSE
    GROUP BY q.contest_id
  ),
  assigned_users AS (
    SELECT DISTINCT
      ca.contest_id AS c_id,
      u.id AS user_id
    FROM public.contest_assignments ca
    LEFT JOIN public.group_members gm ON ca.group_id = gm.group_id
    LEFT JOIN public.users u ON (ca.group_id IS NOT NULL AND u.id = gm.user_id) OR (ca.team IS NOT NULL AND u.team = ca.team)
    WHERE u.id IS NOT NULL AND u.role != 'admin'
  ),
  user_contest_solved AS (
    SELECT 
      au.c_id,
      au.user_id,
      COALESCE(cq.q_count, 0) AS q_count,
      COUNT(DISTINCT p.question_id)::bigint AS solved_count
    FROM assigned_users au
    JOIN contest_qs cq ON cq.c_id = au.c_id
    LEFT JOIN public.progress p ON p.contest_id = au.c_id 
      AND p.user_id = au.user_id 
      AND (p.status = 'solved' OR p.score > 0)
    GROUP BY au.c_id, au.user_id, cq.q_count
  )
  SELECT 
    c.id AS contest_id,
    c.title,
    COALESCE(c.hackerrank_slug, '') AS slug,
    COALESCE(cq.q_count, 0) AS question_count,
    COUNT(DISTINCT au.user_id)::bigint AS assigned_trainers_count,
    COUNT(DISTINCT CASE WHEN ucs.solved_count >= ucs.q_count AND ucs.q_count > 0 THEN ucs.user_id END)::bigint AS completed_trainers_count,
    COALESCE(SUM(ucs.solved_count), 0)::bigint AS total_solved_sum,
    CASE 
      WHEN COUNT(DISTINCT au.user_id) > 0 AND COALESCE(cq.q_count, 0) > 0 
      THEN ROUND((COALESCE(SUM(ucs.solved_count), 0)::numeric / (cq.q_count * COUNT(DISTINCT au.user_id))) * 100, 1)
      ELSE 0 
    END AS completion_percentage
  FROM public.contests c
  LEFT JOIN contest_qs cq ON cq.c_id = c.id
  LEFT JOIN assigned_users au ON au.c_id = c.id
  LEFT JOIN user_contest_solved ucs ON ucs.c_id = c.id AND ucs.user_id = au.user_id
  GROUP BY c.id, c.title, c.hackerrank_slug, c.start_date, cq.q_count
  ORDER BY c.start_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contest_analytics() TO authenticated, service_role, anon;
