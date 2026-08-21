-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 06_analytics_functions
-- Database-level Analytics Functions for Topic Roadmaps and Contests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_roadmap_analytics()
RETURNS TABLE (
  roadmap_id uuid,
  title text,
  domain text,
  level text,
  total_questions bigint,
  assigned_trainers_count bigint,
  completed_trainers_count bigint,
  total_solved_sum bigint,
  completion_percentage numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- A. Extract and flatten question UUIDs from roadmap JSON topics (supporting both nested & flat structures)
  roadmap_questions AS (
    SELECT 
      r.id AS r_id,
      r.title,
      COALESCE(r.domain, 'General') AS domain,
      COALESCE(r.level, 'Intermediate') AS level,
      COALESCE(
        -- Nested topics: topic.questions array
        (
          SELECT jsonb_agg(DISTINCT (COALESCE(q->>'id', q->>'question_id'))::text)
          FROM jsonb_array_elements(r.topics) AS topic
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
              WHEN jsonb_typeof(topic->'questions') = 'array' THEN topic->'questions' 
              ELSE '[]'::jsonb 
            END
          ) AS q
          WHERE COALESCE(q->>'id', q->>'question_id') IS NOT NULL
        ),
        -- Flat topics: topic.id / topic.question_id directly
        (
          SELECT jsonb_agg(DISTINCT (COALESCE(t->>'id', t->>'question_id'))::text)
          FROM jsonb_array_elements(r.topics) AS t
          WHERE COALESCE(t->>'id', t->>'question_id') IS NOT NULL
        ),
        '[]'::jsonb
      ) AS q_ids
    FROM public.roadmaps r
  ),
  
  -- B. Resolve unique assigned non-admin trainers (combining direct user assignments and group cohort members)
  assigned_cohort AS (
    SELECT DISTINCT
      ra.roadmap_id AS r_id,
      u.id AS user_id
    FROM public.roadmap_assignments ra
    LEFT JOIN public.group_members gm ON ra.group_id = gm.group_id
    JOIN public.users u ON u.id = COALESCE(ra.user_id, gm.user_id)
    WHERE u.role != 'admin'
  ),

  -- C. Compute per-user per-roadmap solved question count from live progress and roadmap check-offs
  user_stats AS (
    SELECT 
      ac.r_id,
      ac.user_id,
      jsonb_array_length(rq.q_ids)::bigint AS total_q,
      COUNT(DISTINCT p.question_id)::bigint AS solved_count
    FROM assigned_cohort ac
    JOIN roadmap_questions rq ON rq.r_id = ac.r_id
    LEFT JOIN public.progress p ON p.user_id = ac.user_id 
      AND (p.status = 'solved' OR p.score > 0)
      AND rq.q_ids ? (p.question_id)::text
    GROUP BY ac.r_id, ac.user_id, rq.q_ids
  )

  -- D. Final aggregation per roadmap
  SELECT 
    rq.r_id AS roadmap_id,
    rq.title,
    rq.domain,
    rq.level,
    jsonb_array_length(rq.q_ids)::bigint AS total_questions,
    COUNT(DISTINCT ac.user_id)::bigint AS assigned_trainers_count,
    COUNT(DISTINCT CASE WHEN us.solved_count >= us.total_q AND us.total_q > 0 THEN us.user_id END)::bigint AS completed_trainers_count,
    COALESCE(SUM(us.solved_count), 0)::bigint AS total_solved_sum,
    CASE 
      WHEN COUNT(DISTINCT ac.user_id) > 0 AND jsonb_array_length(rq.q_ids) > 0 
      THEN ROUND((COALESCE(SUM(us.solved_count), 0)::numeric / (jsonb_array_length(rq.q_ids) * COUNT(DISTINCT ac.user_id))) * 100, 1)
      ELSE 0 
    END AS completion_percentage
  FROM roadmap_questions rq
  LEFT JOIN assigned_cohort ac ON ac.r_id = rq.r_id
  LEFT JOIN user_stats us ON us.r_id = rq.r_id AND us.user_id = ac.user_id
  GROUP BY rq.r_id, rq.title, rq.domain, rq.level, rq.q_ids;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_roadmap_analytics() TO authenticated, service_role, anon;
