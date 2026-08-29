-- Migration: 11_user_performance_profile_rpc.sql
-- Creates a stored procedure to fetch a user's full performance profile
-- including all contest progress, problem statuses, and LeetCode stats.

CREATE OR REPLACE FUNCTION get_user_performance_profile(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user           JSON;
  v_summary        JSON;
  v_leetcode       JSON;
  v_heatmap        JSON;
  v_contests       JSON;
  v_batch_start    TIMESTAMPTZ;
BEGIN
  -- 1. User Metadata
  SELECT row_to_json(u) INTO v_user
  FROM (
    SELECT
      id, emp_id, full_name, email, emp_email,
      team, manager, hackerrank_id, leetcode_id, role, created_at
    FROM public.users
    WHERE id = target_user_id
  ) u;

  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- 2. Batch start date (earliest assigned contest start_date)
  SELECT COALESCE(MIN(c.start_date), NOW() - INTERVAL '6 months')
  INTO v_batch_start
  FROM public.contests c
  INNER JOIN public.contest_assignments ca ON ca.contest_id = c.id
  LEFT JOIN public.group_members gm ON gm.group_id = ca.group_id
  WHERE gm.user_id = target_user_id OR ca.user_id = target_user_id;

  -- 3. Summary Stats
  SELECT row_to_json(s) INTO v_summary
  FROM (
    SELECT
      COUNT(DISTINCT CASE WHEN p.status = 'solved' AND p.score >= COALESCE(q.max_score, p.max_score, 1) AND COALESCE(q.max_score, p.max_score, 1) > 0 THEN p.question_id END) AS total_solved,
      COALESCE(SUM(p.score), 0) AS total_score,
      COUNT(DISTINCT p.contest_id) AS contests_participated,
      COUNT(DISTINCT CASE WHEN p.status IN ('solved', 'attempted') THEN p.question_id END) AS problems_attempted
    FROM public.progress p
    LEFT JOIN public.questions q ON q.id = p.question_id
    WHERE p.user_id = target_user_id
  ) s;

  -- 4. LeetCode Stats
  SELECT row_to_json(lc) INTO v_leetcode
  FROM (
    SELECT
      solved_easy, solved_medium, solved_hard, solved_total,
      ranking, contest_rating, submission_calendar, last_synced_at
    FROM public.leetcode_user_stats
    WHERE user_id = target_user_id
    ORDER BY last_synced_at DESC
    LIMIT 1
  ) lc;

  -- 5. Heatmap bounded to batch start
  SELECT json_agg(h ORDER BY h.day) INTO v_heatmap
  FROM (
    SELECT
      DATE(p.last_submission_at AT TIME ZONE 'Asia/Kolkata') AS day,
      COUNT(DISTINCT CASE
        WHEN p.status = 'solved'
          AND p.score >= COALESCE(q.max_score, p.max_score, 1)
          AND COALESCE(q.max_score, p.max_score, 1) > 0
        THEN p.question_id
      END) AS solve_count
    FROM public.progress p
    LEFT JOIN public.questions q ON q.id = p.question_id
    WHERE
      p.user_id = target_user_id
      AND p.last_submission_at IS NOT NULL
      AND p.last_submission_at >= v_batch_start
    GROUP BY 1
    HAVING COUNT(DISTINCT CASE
        WHEN p.status = 'solved'
          AND p.score >= COALESCE(q.max_score, p.max_score, 1)
          AND COALESCE(q.max_score, p.max_score, 1) > 0
        THEN p.question_id
      END) > 0
  ) h;

  -- 6. Contests with per-question progress
  SELECT json_agg(contest_data ORDER BY contest_data.start_date DESC) INTO v_contests
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
          AND p.score >= COALESCE(q.max_score, p.max_score, 1)
          AND COALESCE(q.max_score, p.max_score, 1) > 0
        THEN q.id
      END) AS solved_count,
      COALESCE(SUM(p.score), 0) AS score,
      COALESCE(SUM(COALESCE(q.max_score, p.max_score, 10)), 0) AS max_score,
      json_agg(
        json_build_object(
          'id',              q.id,
          'title',           q.title,
          'domain',          COALESCE(q.domain, 'General'),
          'difficulty',      COALESCE(q.difficulty, 'Medium'),
          'hackerrank_url',  COALESCE(q.hackerrank_url, q.url, ''),
          'max_score',       COALESCE(q.max_score, p.max_score, 10),
          'status',          CASE
                               WHEN p.status = 'solved'
                                 AND p.score >= COALESCE(q.max_score, p.max_score, 1)
                                 AND COALESCE(q.max_score, p.max_score, 1) > 0
                               THEN 'solved'
                               WHEN p.status = 'attempted' OR (p.score > 0)
                               THEN 'attempted'
                               ELSE 'unattempted'
                             END,
          'score',           COALESCE(p.score, 0),
          'last_submission_at', p.last_submission_at
        ) ORDER BY q.order_index ASC NULLS LAST, q.title ASC
      ) AS questions
    FROM public.contests c
    INNER JOIN public.questions q ON q.contest_id = c.id AND (q.is_enabled IS NOT FALSE)
    INNER JOIN (
      SELECT DISTINCT contest_id FROM public.progress WHERE user_id = target_user_id
      UNION
      SELECT DISTINCT ca.contest_id
      FROM public.contest_assignments ca
      LEFT JOIN public.group_members gm ON gm.group_id = ca.group_id
      WHERE gm.user_id = target_user_id OR ca.user_id = target_user_id
    ) assigned ON assigned.contest_id = c.id
    LEFT JOIN public.progress p ON p.question_id = q.id AND p.user_id = target_user_id
    GROUP BY c.id, c.title, c.platform, c.start_date, c.end_date, c.hackerrank_slug
  ) contest_data;

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

REVOKE ALL ON FUNCTION get_user_performance_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_performance_profile(UUID) TO authenticated;
