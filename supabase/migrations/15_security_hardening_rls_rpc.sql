-- ==============================================================================
-- Migration 15: Security Hardening for Database RLS & RPC Stored Procedures
-- Milestone 3: Requirement R3 — Row-Level Security (RLS) & RPC Function Hardening
-- ==============================================================================

-- ── 1. Hardened Row-Level Security (RLS) Policies ─────────────────────────────

-- 1.1 public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Admins and managers can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own contact info" ON public.users;
DROP POLICY IF EXISTS "Admins and managers can manage users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- Admin and Manager can view all user records
CREATE POLICY "Admins and managers can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Standard authenticated users can only view their own user profile record
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Standard authenticated users can update only their own non-sensitive fields
-- Role self-escalation, employee ID tampering, and attendance count tampering are prevented
CREATE POLICY "Users can update own contact info"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()) AND
    emp_id = (SELECT u.emp_id FROM public.users u WHERE u.id = auth.uid()) AND
    it_days_count IS NOT DISTINCT FROM (SELECT u.it_days_count FROM public.users u WHERE u.id = auth.uid()) AND
    last_it_check_date IS NOT DISTINCT FROM (SELECT u.last_it_check_date FROM public.users u WHERE u.id = auth.uid())
  );

-- Admins and Managers have full management access to users table
CREATE POLICY "Admins and managers can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- 1.2 public.it_trainer_progress (Attendance Forgery Prevention)
ALTER TABLE public.it_trainer_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own it_trainer_progress" ON public.it_trainer_progress;
DROP POLICY IF EXISTS "Users read own it_trainer_progress" ON public.it_trainer_progress;
DROP POLICY IF EXISTS "Users read own it_trainer_progress or admin manager read all" ON public.it_trainer_progress;
DROP POLICY IF EXISTS "Admins and managers can manage it_trainer_progress" ON public.it_trainer_progress;

-- Trainers can view only their own progress; Admins and Managers can view all
CREATE POLICY "Users read own it_trainer_progress or admin manager read all"
  ON public.it_trainer_progress FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Direct mutation (INSERT/UPDATE/DELETE) restricted strictly to Admins and Managers (or service_role)
CREATE POLICY "Admins and managers can manage it_trainer_progress"
  ON public.it_trainer_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- 1.3 public.it_question_completions
ALTER TABLE public.it_question_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own it_question_completions" ON public.it_question_completions;
DROP POLICY IF EXISTS "Users read own it_question_completions or admin manager read all" ON public.it_question_completions;
DROP POLICY IF EXISTS "Admins and managers can manage it_question_completions" ON public.it_question_completions;

CREATE POLICY "Users read own it_question_completions or admin manager read all"
  ON public.it_question_completions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can manage it_question_completions"
  ON public.it_question_completions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- 1.4 public.user_roadmap_progress
ALTER TABLE public.user_roadmap_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own roadmap progress" ON public.user_roadmap_progress;
DROP POLICY IF EXISTS "Users read own roadmap progress or admin manager read all" ON public.user_roadmap_progress;
DROP POLICY IF EXISTS "Admins and managers can manage user_roadmap_progress" ON public.user_roadmap_progress;

CREATE POLICY "Users read own roadmap progress or admin manager read all"
  ON public.user_roadmap_progress FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can manage user_roadmap_progress"
  ON public.user_roadmap_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- 1.5 public.support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins and managers can view all support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins and managers can update support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users view own support tickets or admin manager view all" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create own support tickets" ON public.support_tickets;

CREATE POLICY "Users view own support tickets or admin manager view all"
  ON public.support_tickets FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create own support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update support tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- 1.6 public.it_attendance_disputes
ALTER TABLE public.it_attendance_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own disputes or admin/manager read all" ON public.it_attendance_disputes;
DROP POLICY IF EXISTS "Users can insert own IT disputes" ON public.it_attendance_disputes;
DROP POLICY IF EXISTS "Admins and managers can update IT disputes" ON public.it_attendance_disputes;
DROP POLICY IF EXISTS "Users read own IT disputes or admin manager read all" ON public.it_attendance_disputes;

CREATE POLICY "Users read own IT disputes or admin manager read all"
  ON public.it_attendance_disputes FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can insert own IT disputes"
  ON public.it_attendance_disputes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can update IT disputes"
  ON public.it_attendance_disputes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );


-- ── 2. Hardened Database RPC Stored Procedures ─────────────────────────────────

-- 2.1 RPC: get_contest_analytics()
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
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
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
    SELECT 
      ca.contest_id AS c_id, 
      gm.user_id
    FROM public.contest_assignments ca
    JOIN public.group_members gm ON ca.group_id = gm.group_id
    JOIN public.users u ON u.id = gm.user_id
    WHERE ca.group_id IS NOT NULL AND u.role != 'admin'
    UNION
    SELECT 
      ca.contest_id AS c_id, 
      u.id AS user_id
    FROM public.contest_assignments ca
    JOIN public.users u ON u.team = ca.team
    WHERE ca.team IS NOT NULL AND TRIM(ca.team) != '' AND u.role != 'admin'
  ),
  user_contest_solved AS (
    SELECT 
      au.c_id,
      au.user_id,
      COALESCE(cq.q_count, 0) AS q_count,
      COUNT(DISTINCT p.question_id)::bigint AS solved_count
    FROM assigned_users au
    LEFT JOIN contest_qs cq ON cq.c_id = au.c_id
    LEFT JOIN public.questions q ON q.contest_id = au.c_id AND q.is_enabled IS NOT FALSE
    LEFT JOIN public.progress p ON p.contest_id = au.c_id 
      AND p.user_id = au.user_id 
      AND p.question_id = q.id
      AND p.status = 'solved'
      AND (
        CASE 
          WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN p.score >= COALESCE(p.max_score, q.max_score, 0)
          ELSE p.score > 0 
        END
      )
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
      THEN LEAST(100.0, ROUND((COALESCE(SUM(ucs.solved_count), 0)::numeric / (cq.q_count * COUNT(DISTINCT au.user_id))) * 100, 1))
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

REVOKE ALL ON FUNCTION public.get_contest_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contest_analytics() TO authenticated, service_role;


-- 2.2 RPC: get_roadmap_analytics()
DROP FUNCTION IF EXISTS public.get_roadmap_analytics();

CREATE OR REPLACE FUNCTION public.get_roadmap_analytics()
RETURNS TABLE (
  roadmap_id uuid,
  title text,
  domain text,
  level text,
  total_questions integer,
  assigned_trainers_count bigint,
  completed_trainers_count bigint,
  total_solved_sum bigint,
  completion_percentage numeric
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH 
  roadmap_questions AS (
    SELECT 
      r.id AS r_id,
      r.title,
      COALESCE(r.domain, 'General') AS domain,
      COALESCE(r.level, 'Intermediate') AS level,
      COALESCE(
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
        (
          SELECT jsonb_agg(DISTINCT (COALESCE(t->>'id', t->>'question_id'))::text)
          FROM jsonb_array_elements(r.topics) AS t
          WHERE COALESCE(t->>'id', t->>'question_id') IS NOT NULL
        ),
        '[]'::jsonb
      ) AS q_ids
    FROM public.roadmaps r
  ),
  assigned_cohort AS (
    SELECT 
      ra.roadmap_id AS r_id,
      ra.user_id AS user_id
    FROM public.roadmap_assignments ra
    JOIN public.users u ON u.id = ra.user_id
    WHERE ra.user_id IS NOT NULL 
      AND u.role != 'admin'
    
    UNION
    
    SELECT 
      ra.roadmap_id AS r_id,
      gm.user_id AS user_id
    FROM public.roadmap_assignments ra
    JOIN public.group_members gm ON gm.group_id = ra.group_id
    JOIN public.users u ON u.id = gm.user_id
    WHERE ra.group_id IS NOT NULL 
      AND u.role != 'admin'
  ),
  user_stats AS (
    SELECT 
      ac.r_id,
      ac.user_id,
      jsonb_array_length(rq.q_ids)::integer AS total_q,
      COUNT(DISTINCT p.question_id)::bigint AS solved_count
    FROM assigned_cohort ac
    JOIN roadmap_questions rq ON rq.r_id = ac.r_id
    LEFT JOIN public.progress p ON p.user_id = ac.user_id 
      AND rq.q_ids ? (p.question_id)::text
      AND p.status = 'solved'
      AND (
        CASE 
          WHEN COALESCE(p.max_score, 0) > 0 THEN p.score >= p.max_score 
          ELSE p.score > 0 
        END
      )
    GROUP BY ac.r_id, ac.user_id, rq.q_ids
  )
  SELECT 
    rq.r_id AS roadmap_id,
    rq.title,
    rq.domain,
    rq.level,
    jsonb_array_length(rq.q_ids)::integer AS total_questions,
    COUNT(DISTINCT ac.user_id)::bigint AS assigned_trainers_count,
    COUNT(DISTINCT CASE WHEN us.solved_count >= us.total_q AND us.total_q > 0 THEN us.user_id END)::bigint AS completed_trainers_count,
    COALESCE(SUM(us.solved_count), 0)::bigint AS total_solved_sum,
    CASE 
      WHEN COUNT(DISTINCT ac.user_id) > 0 AND jsonb_array_length(rq.q_ids) > 0 
      THEN LEAST(100.0, ROUND((COALESCE(SUM(us.solved_count), 0)::numeric / (jsonb_array_length(rq.q_ids) * COUNT(DISTINCT ac.user_id))) * 100, 1))
      ELSE 0 
    END AS completion_percentage
  FROM roadmap_questions rq
  LEFT JOIN assigned_cohort ac ON ac.r_id = rq.r_id
  LEFT JOIN user_stats us ON us.r_id = rq.r_id AND us.user_id = ac.user_id
  GROUP BY rq.r_id, rq.title, rq.domain, rq.level, rq.q_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.get_roadmap_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_roadmap_analytics() TO authenticated, service_role;


-- 2.3 RPC: get_it_trainer_overview() (Restricted to Admins, Managers & Service Role)
DROP FUNCTION IF EXISTS public.get_it_trainer_overview();

CREATE OR REPLACE FUNCTION public.get_it_trainer_overview()
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  result jsonb;
BEGIN
  -- Caller authorization check: must be admin/manager or service_role
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Forbidden: Only Admins and Managers can access the IT Trainer Overview';
    END IF;
  ELSIF current_user != 'service_role' AND current_user != 'postgres' AND current_user != 'supabase_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required';
  END IF;

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

REVOKE ALL ON FUNCTION public.get_it_trainer_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_it_trainer_overview() TO authenticated, service_role;


-- 2.4 RPC: get_user_performance_profile() (Restricted to Self, Admins, Managers & Service Role)
DROP FUNCTION IF EXISTS public.get_user_performance_profile(UUID);

CREATE OR REPLACE FUNCTION public.get_user_performance_profile(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_user        JSON;
  v_summary     JSON;
  v_leetcode    JSON;
  v_heatmap     JSON;
  v_contests    JSON;
  v_batch_start TIMESTAMPTZ;
BEGIN
  -- Caller authorization check: caller must be self, admin/manager, or service_role
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF auth.uid() != target_user_id AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager')) THEN
      RETURN json_build_object('error', 'Forbidden: You can only view your own performance profile');
    END IF;
  ELSIF current_user != 'service_role' AND current_user != 'postgres' AND current_user != 'supabase_admin' THEN
    RETURN json_build_object('error', 'Unauthorized: Authentication required');
  END IF;

  -- 1. User Metadata (Safe projection)
  SELECT row_to_json(u) INTO v_user
  FROM (
    SELECT id, emp_id, full_name, email, emp_email,
           team, manager, hackerrank_id, leetcode_id, role, created_at
    FROM public.users
    WHERE id = target_user_id
  ) u;

  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- 2. Batch start date — earliest contest assigned or participated
  SELECT COALESCE(
    MIN(c.start_date),
    NOW() - INTERVAL '6 months'
  )
  INTO v_batch_start
  FROM public.contests c
  WHERE c.id IN (
    SELECT ca.contest_id FROM public.contest_assignments ca JOIN public.group_members gm ON gm.group_id = ca.group_id WHERE gm.user_id = target_user_id
    UNION
    SELECT ca.contest_id FROM public.contest_assignments ca JOIN public.users u ON u.team = ca.team WHERE u.id = target_user_id AND ca.team IS NOT NULL AND ca.team != ''
    UNION
    SELECT p.contest_id FROM public.progress p WHERE p.user_id = target_user_id
  );

  -- 3. Summary Stats (Deduplicated MAX score per question)
  WITH dedup_q AS (
    SELECT
      p.question_id,
      MAX(COALESCE(p.score, 0)) AS max_achieved_score,
      BOOL_OR(
        p.status = 'solved'
        AND (
          CASE 
            WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
            ELSE COALESCE(p.score, 0) > 0 
          END
        )
      ) AS is_solved,
      BOOL_OR(p.status IN ('solved', 'attempted') OR COALESCE(p.score, 0) > 0) AS is_attempted
    FROM public.progress p
    LEFT JOIN public.questions q ON q.id = p.question_id
    WHERE p.user_id = target_user_id AND q.is_enabled IS NOT FALSE
    GROUP BY p.question_id
  )
  SELECT row_to_json(s) INTO v_summary
  FROM (
    SELECT
      COUNT(DISTINCT question_id) FILTER (WHERE is_solved) AS total_solved,
      COALESCE(SUM(max_achieved_score), 0) AS total_score,
      (
        SELECT COUNT(DISTINCT p2.contest_id)
        FROM public.progress p2
        WHERE p2.user_id = target_user_id
          AND (p2.status IN ('solved', 'attempted') OR COALESCE(p2.score, 0) > 0)
      ) AS contests_participated,
      COUNT(DISTINCT question_id) FILTER (WHERE is_attempted) AS problems_attempted
    FROM dedup_q
  ) s;

  -- 4. LeetCode Stats
  SELECT row_to_json(lc) INTO v_leetcode
  FROM (
    SELECT
      solved_easy, solved_medium, solved_hard, solved_total,
      ranking, contest_rating, submission_calendar, last_synced_at
    FROM public.leetcode_user_stats
    WHERE user_id = target_user_id
    LIMIT 1
  ) lc;

  -- 5. Activity Heatmap (Asia/Kolkata timezone, strict solves only)
  SELECT json_agg(h ORDER BY h.day) INTO v_heatmap
  FROM (
    SELECT
      TO_CHAR(p.last_submission_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT CASE
        WHEN p.status = 'solved'
          AND (
            CASE 
              WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
              ELSE COALESCE(p.score, 0) > 0 
            END
          )
        THEN p.question_id
      END) AS solve_count
    FROM public.progress p
    LEFT JOIN public.questions q ON q.id = p.question_id
    WHERE
      p.user_id = target_user_id
      AND p.last_submission_at IS NOT NULL
      AND p.last_submission_at >= v_batch_start
      AND q.is_enabled IS NOT FALSE
    GROUP BY TO_CHAR(p.last_submission_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')
    HAVING COUNT(DISTINCT CASE
      WHEN p.status = 'solved'
        AND (
          CASE 
            WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
            ELSE COALESCE(p.score, 0) > 0 
          END
        )
      THEN p.question_id
    END) > 0
  ) h;

  -- 6. Per-contest breakdown
  SELECT json_agg(cd ORDER BY cd.start_date DESC) INTO v_contests
  FROM (
    SELECT
      c.id,
      c.title,
      COALESCE(c.platform, 'hackerrank') AS platform,
      c.start_date,
      c.end_date,
      c.hackerrank_slug,
      COUNT(DISTINCT q.id) AS total_questions,
      COUNT(DISTINCT CASE
        WHEN p.status = 'solved'
          AND (
            CASE 
              WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
              ELSE COALESCE(p.score, 0) > 0 
            END
          )
        THEN q.id
      END) AS solved_count,
      COALESCE(SUM(p.score), 0) AS score,
      COALESCE(SUM(COALESCE(q.max_score, p.max_score, 10)), 0) AS max_score,
      json_agg(
        json_build_object(
          'id',                 q.id,
          'title',              q.title,
          'domain',             COALESCE(q.domain, 'General'),
          'difficulty',         COALESCE(q.difficulty, 'Medium'),
          'hackerrank_url',     COALESCE(q.hackerrank_url, q.url, ''),
          'max_score',          COALESCE(q.max_score, p.max_score, 10),
          'status',             CASE
                                  WHEN p.status = 'solved'
                                    AND (
                                      CASE 
                                        WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
                                        ELSE COALESCE(p.score, 0) > 0 
                                      END
                                    )
                                  THEN 'solved'
                                  WHEN p.status = 'attempted' OR COALESCE(p.score, 0) > 0
                                  THEN 'attempted'
                                  ELSE 'unattempted'
                                END,
          'score',              COALESCE(p.score, 0),
          'last_submission_at', p.last_submission_at
        ) ORDER BY q.order_index ASC NULLS LAST, q.title ASC
      ) AS questions
    FROM public.contests c
    INNER JOIN public.questions q ON q.contest_id = c.id AND q.is_enabled IS NOT FALSE
    LEFT JOIN public.progress p ON p.question_id = q.id AND p.user_id = target_user_id AND p.contest_id = c.id
    WHERE c.id IN (
      SELECT ca.contest_id FROM public.contest_assignments ca JOIN public.group_members gm ON gm.group_id = ca.group_id WHERE gm.user_id = target_user_id
      UNION
      SELECT ca.contest_id FROM public.contest_assignments ca JOIN public.users u ON u.team = ca.team WHERE u.id = target_user_id AND ca.team IS NOT NULL AND ca.team != ''
      UNION
      SELECT p.contest_id FROM public.progress p WHERE p.user_id = target_user_id
    )
    GROUP BY c.id, c.title, c.platform, c.start_date, c.end_date, c.hackerrank_slug
  ) cd;

  RETURN json_build_object(
    'user',        v_user,
    'summary',     v_summary,
    'leetcode',    v_leetcode,
    'heatmap',     COALESCE(v_heatmap, '[]'::json),
    'contests',    COALESCE(v_contests, '[]'::json),
    'batch_start', v_batch_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_performance_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_performance_profile(UUID) TO authenticated, service_role;


-- 2.5 RPC: get_global_leaderboard()
DROP FUNCTION IF EXISTS public.get_global_leaderboard();

CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  emp_id text,
  team text,
  score bigint,
  solved bigint
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH 
  dedup_progress AS (
    SELECT
      p.user_id,
      p.question_id,
      MAX(COALESCE(p.score, 0)) AS max_score,
      BOOL_OR(
        p.status = 'solved'
        AND (
          CASE 
            WHEN COALESCE(p.max_score, q.max_score, 0) > 0 THEN COALESCE(p.score, 0) >= COALESCE(p.max_score, q.max_score, 0)
            ELSE COALESCE(p.score, 0) > 0 
          END
        )
      ) AS is_solved
    FROM public.progress p
    LEFT JOIN public.questions q ON q.id = p.question_id
    WHERE q.is_enabled IS NOT FALSE
    GROUP BY p.user_id, p.question_id
  ),
  user_aggregates AS (
    SELECT
      dp.user_id,
      COALESCE(SUM(dp.max_score), 0)::bigint AS total_score,
      COUNT(DISTINCT dp.question_id) FILTER (WHERE dp.is_solved)::bigint AS total_solved
    FROM dedup_progress dp
    GROUP BY dp.user_id
  )
  SELECT
    u.id,
    u.id AS user_id,
    u.full_name AS name,
    COALESCE(u.emp_id, '—') AS emp_id,
    COALESCE(u.team, 'N/A') AS team,
    COALESCE(ua.total_score, 0)::bigint AS score,
    COALESCE(ua.total_solved, 0)::bigint AS solved
  FROM public.users u
  LEFT JOIN user_aggregates ua ON ua.user_id = u.id
  WHERE u.role != 'admin'
  ORDER BY score DESC, solved DESC, name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard() TO authenticated, service_role;


-- 2.6 RPC: get_contest_leaderboard_rpc()
DROP FUNCTION IF EXISTS public.get_contest_leaderboard_rpc(UUID);

CREATE OR REPLACE FUNCTION public.get_contest_leaderboard_rpc(p_contest_id UUID)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  enabled_questions AS (
    SELECT
      q.id,
      q.contest_id,
      q.slug,
      q.title,
      COALESCE(q.domain, 'General') AS domain,
      COALESCE(q.difficulty, 'Medium') AS difficulty,
      COALESCE(q.hackerrank_url, q.url, '') AS hackerrank_url,
      COALESCE(q.max_score, 10) AS max_score,
      q.order_index
    FROM public.questions q
    WHERE q.contest_id = p_contest_id
      AND q.is_enabled IS NOT FALSE
  ),
  contest_summary AS (
    SELECT
      COUNT(id)::integer AS total_questions_count,
      COALESCE(SUM(max_score), 0)::integer AS total_max_score
    FROM enabled_questions
  ),
  assigned_users AS (
    SELECT DISTINCT gm.user_id
    FROM public.contest_assignments ca
    JOIN public.group_members gm ON gm.group_id = ca.group_id
    JOIN public.users u ON u.id = gm.user_id
    WHERE ca.contest_id = p_contest_id
      AND ca.group_id IS NOT NULL
      AND u.role != 'admin'
    
    UNION
    
    SELECT DISTINCT u.id AS user_id
    FROM public.contest_assignments ca
    JOIN public.users u ON u.team = ca.team
    WHERE ca.contest_id = p_contest_id
      AND ca.team IS NOT NULL
      AND ca.team != ''
      AND u.role != 'admin'
  ),
  effective_users AS (
    SELECT user_id FROM assigned_users
    UNION
    SELECT DISTINCT p.user_id
    FROM public.progress p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.contest_id = p_contest_id
      AND u.role != 'admin'
      AND NOT EXISTS (SELECT 1 FROM assigned_users)
  ),
  user_progress AS (
    SELECT
      eu.user_id,
      u.full_name AS name,
      COALESCE(u.emp_id, '—') AS emp_id,
      COALESCE(u.team, 'N/A') AS team,
      u.hackerrank_id,
      u.leetcode_id,
      COALESCE(
        COUNT(DISTINCT eq.id) FILTER (
          WHERE p.status = 'solved'
            AND (CASE WHEN eq.max_score > 0 THEN COALESCE(p.score, 0) >= eq.max_score ELSE COALESCE(p.score, 0) > 0 END)
        ), 0
      )::integer AS solved,
      (SELECT total_questions_count FROM contest_summary) AS total,
      COALESCE(SUM(COALESCE(p.score, 0)), 0)::integer AS score,
      (SELECT total_max_score FROM contest_summary) AS max_score,
      MAX(
        CASE
          WHEN (p.status = 'solved' OR p.status = 'attempted' OR COALESCE(p.score, 0) > 0)
          THEN COALESCE(p.last_submission_at, p.updated_at)
          ELSE NULL
        END
      ) AS last_active,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'question_id', eq.id,
            'status', CASE
                        WHEN p.status = 'solved' AND (CASE WHEN eq.max_score > 0 THEN COALESCE(p.score, 0) >= eq.max_score ELSE COALESCE(p.score, 0) > 0 END) THEN 'solved'
                        WHEN p.status = 'attempted' OR COALESCE(p.score, 0) > 0 THEN 'attempted'
                        ELSE COALESCE(p.status, 'unattempted')
                      END,
            'score', COALESCE(p.score, 0),
            'max_score', eq.max_score,
            'last_submission_at', p.last_submission_at,
            'updated_at', p.updated_at
          ) ORDER BY eq.order_index ASC NULLS LAST, eq.title ASC
        ) FILTER (WHERE eq.id IS NOT NULL),
        '[]'::jsonb
      ) AS progress
    FROM effective_users eu
    JOIN public.users u ON u.id = eu.user_id
    CROSS JOIN enabled_questions eq
    LEFT JOIN public.progress p ON p.contest_id = p_contest_id
      AND p.user_id = eu.user_id
      AND p.question_id = eq.id
    GROUP BY eu.user_id, u.full_name, u.emp_id, u.team, u.hackerrank_id, u.leetcode_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', up.user_id,
        'name', up.name,
        'emp_id', up.emp_id,
        'team', up.team,
        'hackerrank_id', up.hackerrank_id,
        'leetcode_id', up.leetcode_id,
        'solved', up.solved,
        'total', up.total,
        'score', up.score,
        'maxScore', up.max_score,
        'lastActive', up.last_active,
        'progress', up.progress
      )
      ORDER BY up.score DESC, up.solved DESC, up.name ASC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM user_progress up;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_leaderboard_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard_rpc(UUID) TO authenticated, service_role;


-- ── 3. Supabase Storage `api-cache` Bucket Security Hardening ──────────────────

-- 1. Ensure storage bucket exists with size and mime constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'api-cache',
  'api-cache',
  true,
  5242880, -- 5 MB limit
  ARRAY['application/json']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    allowed_mime_types = ARRAY['application/json'];

-- 2. Drop existing policies to prevent conflicts or permissive leakages
DROP POLICY IF EXISTS "Public Read Cache" ON storage.objects;
DROP POLICY IF EXISTS "Service Role Manage Cache" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role write" ON storage.objects;

-- 3. Policy: Public/authenticated users can SELECT/READ JSON snapshots only from 'api-cache'
CREATE POLICY "Public Read Cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'api-cache');

-- 4. Policy: Only service_role can INSERT, UPDATE, DELETE objects in 'api-cache'
CREATE POLICY "Service Role Manage Cache"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'api-cache')
WITH CHECK (bucket_id = 'api-cache');
