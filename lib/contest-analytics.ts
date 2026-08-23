import { SupabaseClient } from '@supabase/supabase-js';
import { ContestCompletionStat } from '@/app/(dashboard)/dashboard/TrainerCompletionAnalytics';

export interface DatabaseContestAnalyticsItem {
  contest_id: string;
  title: string;
  slug: string;
  question_count: number;
  assigned_trainers_count: number;
  completed_trainers_count: number;
  total_solved_sum: number;
  completion_percentage: number;
}

/**
 * Fetches contest completion analytics using database RPC or paginated fallback.
 */
export async function getContestAnalytics(supabase: SupabaseClient, limit = 5): Promise<ContestCompletionStat[]> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_contest_analytics');

    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData.slice(0, limit).map((row: any) => ({
        contestId: row.contest_id,
        title: row.title,
        slug: row.slug || '',
        questionCount: Number(row.question_count || 0),
        assignedTrainersCount: Number(row.assigned_trainers_count || 0),
        completedTrainersCount: Number(row.completed_trainers_count || 0),
        completionPercentage: Number(row.completion_percentage || 0),
      }));
    }
  } catch (err) {
    console.warn('[getContestAnalytics] RPC fallback triggered:', err);
  }

  // Fallback in-app calculation with full pagination
  const [contestsRes, questionsRes, assignmentsRes, groupMembersRes, usersRes] = await Promise.all([
    supabase.from('contests').select('id, title, hackerrank_slug, start_date').order('start_date', { ascending: false }).limit(limit),
    supabase.from('questions').select('id, contest_id, is_enabled'),
    supabase.from('contest_assignments').select('contest_id, group_id, team'),
    supabase.from('group_members').select('group_id, user_id'),
    supabase.from('users').select('id, full_name, team').neq('role', 'admin'),
  ]);

  const contests = contestsRes.data || [];
  const questions = questionsRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const users = usersRes.data || [];

  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  const teamUsersMap = new Map<string, string[]>();
  users.forEach((u: any) => {
    if (u.team && u.team !== 'N/A') {
      if (!teamUsersMap.has(u.team)) teamUsersMap.set(u.team, []);
      teamUsersMap.get(u.team)!.push(u.id);
    }
  });

  const contestIds = contests.map((c: any) => c.id);
  let allProgress: any[] = [];
  if (contestIds.length > 0) {
    let from = 0;
    const step = 1000;
    while (true) {
      const { data: page } = await supabase
        .from('progress')
        .select('contest_id, user_id, question_id, score, max_score, status')
        .in('contest_id', contestIds)
        .order('id', { ascending: true })
        .range(from, from + step - 1);
      if (!page || page.length === 0) break;
      allProgress = allProgress.concat(page);
      if (page.length < step) break;
      from += step;
    }
  }

  return contests.map((c: any) => {
    const cQs = questions.filter((q: any) => q.contest_id === c.id && q.is_enabled !== false);
    const qCount = cQs.length;

    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.contest_id === c.id) {
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
        if (a.team) {
          (teamUsersMap.get(a.team) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    const assignedCount = assignedUserIds.size;
    let completedTrainers = 0;
    let totalSolvedSum = 0;

    assignedUserIds.forEach((uid) => {
      const userSolvedCount = cQs.filter((q: any) =>
        allProgress.some((p: any) =>
          p.contest_id === c.id &&
          p.user_id === uid &&
          p.question_id === q.id &&
          (p.status === 'solved' || (p.score != null && p.max_score != null && p.max_score > 0 && p.score >= p.max_score))
        )
      ).length;

      totalSolvedSum += userSolvedCount;
      if (qCount > 0 && userSolvedCount >= qCount) {
        completedTrainers++;
      }
    });

    const maxPossible = qCount * assignedCount;
    const pct = (maxPossible > 0 && assignedCount > 0)
      ? Math.min(100, Math.round((totalSolvedSum / maxPossible) * 100))
      : 0;

    return {
      contestId: c.id,
      title: c.title,
      slug: c.hackerrank_slug || '',
      questionCount: qCount,
      assignedTrainersCount: assignedCount,
      completedTrainersCount: completedTrainers,
      completionPercentage: pct,
    };
  });
}
