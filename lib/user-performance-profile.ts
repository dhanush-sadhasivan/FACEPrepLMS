import { getAdminClient } from '@/lib/supabase/admin';
import { isRecordSolved } from '@/lib/utils';

export interface UserPerformanceProfileData {
  user: {
    id: string;
    emp_id?: string | null;
    full_name: string;
    email: string;
    emp_email?: string | null;
    team?: string | null;
    manager?: string | null;
    hackerrank_id?: string | null;
    leetcode_id?: string | null;
    role: string;
    created_at: string;
  };
  summary: {
    total_solved: number;
    total_score: number;
    contests_participated: number;
    problems_attempted: number;
  };
  leetcode: {
    solved_easy: number;
    solved_medium: number;
    solved_hard: number;
    solved_total: number;
    ranking?: number | null;
    contest_rating?: number | null;
    submission_calendar?: any;
    last_synced_at?: string | null;
  } | null;
  heatmap: Array<{ day: string; solve_count: number }>;
  contests: Array<{
    id: string;
    title: string;
    platform: string;
    start_date: string;
    end_date: string;
    hackerrank_slug?: string | null;
    total_questions: number;
    solved_count: number;
    score: number;
    max_score: number;
    questions: Array<{
      id: string;
      title: string;
      domain: string;
      difficulty: string;
      hackerrank_url: string;
      max_score: number;
      status: string;
      score: number;
      last_submission_at?: string | null;
    }>;
  }>;
  batch_start: string;
}

/**
 * Fetches the user performance profile.
 * Attempts fast single-roundtrip Postgres RPC first,
 * falling back gracefully to direct queries if RPC is not yet created in Supabase.
 */
export async function getUserPerformanceProfile(
  targetUserId: string
): Promise<{ success: boolean; data?: UserPerformanceProfileData; error?: string }> {
  const dbAdmin = getAdminClient();

  // 1. Try DB RPC first
  try {
    const { data: rpcData, error: rpcError } = await dbAdmin.rpc('get_user_performance_profile', {
      target_user_id: targetUserId,
    });

    if (!rpcError && rpcData && !(rpcData as any).error && (rpcData as any).user) {
      return { success: true, data: rpcData as UserPerformanceProfileData };
    }
    if (rpcError) {
      console.warn('[getUserPerformanceProfile] RPC error, using fallback:', rpcError.message);
    }
  } catch (err: any) {
    console.warn('[getUserPerformanceProfile] RPC exception, using fallback:', err?.message || err);
  }

  // 2. Direct Query Fallback
  try {
    // a. Fetch User
    const { data: targetUser, error: userError } = await dbAdmin
      .from('users')
      .select('id, emp_id, full_name, email, emp_email, team, manager, hackerrank_id, leetcode_id, role, created_at')
      .eq('id', targetUserId)
      .maybeSingle();

    if (userError || !targetUser) {
      return { success: false, error: 'User not found' };
    }

    // b. Fetch LeetCode Stats
    const { data: leetcode } = await dbAdmin
      .from('leetcode_user_stats')
      .select('solved_easy, solved_medium, solved_hard, solved_total, ranking, contest_rating, submission_calendar, last_synced_at')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // c. Fetch Progress
    const { data: progressList } = await dbAdmin
      .from('progress')
      .select('id, contest_id, question_id, status, score, max_score, last_submission_at')
      .eq('user_id', targetUserId);

    const progressRows = progressList || [];

    // d. Find assigned and participating contests
    const { data: userGroups } = await dbAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', targetUserId);

    const groupIds = new Set((userGroups || []).map((g: any) => g.group_id));

    const { data: allAssignments } = await dbAdmin
      .from('contest_assignments')
      .select('contest_id, group_id, team');

    const relevantContestIds = new Set<string>();
    (allAssignments || []).forEach((ca: any) => {
      if (ca.group_id && groupIds.has(ca.group_id)) {
        relevantContestIds.add(ca.contest_id);
      }
      if (ca.team && targetUser.team && ca.team.toLowerCase().trim() === targetUser.team.toLowerCase().trim()) {
        relevantContestIds.add(ca.contest_id);
      }
    });
    progressRows.forEach((p: any) => {
      if (p.contest_id) relevantContestIds.add(p.contest_id);
    });

    const contestIds = Array.from(relevantContestIds);
    let contestsData: any[] = [];
    let questionsData: any[] = [];

    if (contestIds.length > 0) {
      const [contestsRes, questionsRes] = await Promise.all([
        dbAdmin.from('contests').select('*').in('id', contestIds).order('start_date', { ascending: false }),
        dbAdmin.from('questions').select('*').in('contest_id', contestIds),
      ]);
      contestsData = contestsRes.data || [];
      questionsData = questionsRes.data || [];
    }

    // e. Build Questions and Progress mappings
    const progressByQuestion = new Map<string, any>();
    progressRows.forEach((p: any) => {
      progressByQuestion.set(p.question_id, p);
    });

    const questionsByContest = new Map<string, any[]>();
    questionsData.forEach((q: any) => {
      if (!questionsByContest.has(q.contest_id)) questionsByContest.set(q.contest_id, []);
      questionsByContest.get(q.contest_id)!.push(q);
    });

    let totalSolved = 0;
    let totalScore = 0;
    const participatedContests = new Set<string>();
    let problemsAttempted = 0;

    const formattedContests = contestsData.map((c: any) => {
      const qList = questionsByContest.get(c.id) || [];
      qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      let contestSolvedCount = 0;
      let contestScore = 0;
      let contestMaxScore = 0;

      const formattedQuestions = qList.map((q: any) => {
        const p = progressByQuestion.get(q.id);
        const maxScore = q.max_score || p?.max_score || 10;
        const score = p?.score || 0;
        let status = 'unattempted';

        if (p) {
          if (isRecordSolved(p)) {
            status = 'solved';
          } else if (p.status === 'attempted' || score > 0) {
            status = 'attempted';
          }
        }

        if (status === 'solved') contestSolvedCount++;
        contestScore += score;
        contestMaxScore += maxScore;

        return {
          id: q.id,
          title: q.title,
          domain: q.domain || 'General',
          difficulty: q.difficulty || 'Medium',
          hackerrank_url: q.hackerrank_url || q.url || '',
          max_score: maxScore,
          status,
          score,
          last_submission_at: p?.last_submission_at || null,
        };
      });

      return {
        id: c.id,
        title: c.title,
        platform: c.platform || 'hackerrank',
        start_date: c.start_date,
        end_date: c.end_date,
        hackerrank_slug: c.hackerrank_slug,
        total_questions: qList.length,
        solved_count: contestSolvedCount,
        score: contestScore,
        max_score: contestMaxScore,
        questions: formattedQuestions,
      };
    });

    // Summary aggregation (Deduplicated MAX score and solve state per distinct question)
    const dedupProgress = new Map<string, { maxScore: number; isSolved: boolean; isAttempted: boolean }>();
    progressRows.forEach((p: any) => {
      if (p.contest_id && (p.status === 'solved' || p.status === 'attempted' || (p.score || 0) > 0)) {
        participatedContests.add(p.contest_id);
      }
      const qId = p.question_id;
      if (!qId) return;
      const score = Number(p.score) || 0;
      const solved = isRecordSolved(p);
      const attempted = p.status === 'solved' || p.status === 'attempted' || score > 0;
      const existing = dedupProgress.get(qId);
      if (!existing) {
        dedupProgress.set(qId, {
          maxScore: score,
          isSolved: solved,
          isAttempted: attempted,
        });
      } else {
        existing.maxScore = Math.max(existing.maxScore, score);
        existing.isSolved = existing.isSolved || solved;
        existing.isAttempted = existing.isAttempted || attempted;
      }
    });

    dedupProgress.forEach((item) => {
      totalScore += item.maxScore;
      if (item.isSolved) totalSolved++;
      if (item.isAttempted) problemsAttempted++;
    });

    // Batch start calculation
    let batchStart = new Date(Date.now() - 180 * 86400000).toISOString();
    if (contestsData.length > 0) {
      const validDates = contestsData.map((c) => new Date(c.start_date).getTime()).filter((t) => !isNaN(t));
      if (validDates.length > 0) {
        batchStart = new Date(Math.min(...validDates)).toISOString();
      }
    }

    // Heatmap aggregation (Asia/Kolkata IST timezone, strict solves only, distinct questions per day)
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const solveQuestionsByDay = new Map<string, Set<string>>();
    progressRows.forEach((p: any) => {
      if (p.last_submission_at && isRecordSolved(p)) {
        const subDate = new Date(p.last_submission_at);
        if (subDate >= new Date(batchStart)) {
          const dayKey = istDateFormatter.format(subDate);
          if (!solveQuestionsByDay.has(dayKey)) {
            solveQuestionsByDay.set(dayKey, new Set<string>());
          }
          if (p.question_id) {
            solveQuestionsByDay.get(dayKey)!.add(p.question_id);
          }
        }
      }
    });

    const heatmap = Array.from(solveQuestionsByDay.entries())
      .filter(([_, questions]) => questions.size > 0)
      .map(([day, questions]) => ({ day, solve_count: questions.size }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return {
      success: true,
      data: {
        user: targetUser,
        summary: {
          total_solved: totalSolved,
          total_score: totalScore,
          contests_participated: participatedContests.size,
          problems_attempted: problemsAttempted,
        },
        leetcode: leetcode || null,
        heatmap,
        contests: formattedContests,
        batch_start: batchStart,
      },
    };
  } catch (fallbackErr: any) {
    console.error('[getUserPerformanceProfile] Fallback failed:', fallbackErr);
    return { success: false, error: fallbackErr?.message || 'Failed to fetch user profile' };
  }
}