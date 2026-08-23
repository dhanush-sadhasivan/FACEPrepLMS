import { SupabaseClient } from '@supabase/supabase-js';
import { RoadmapCompletionStat } from '@/app/(dashboard)/dashboard/TrainerCompletionAnalytics';

export interface DatabaseRoadmapAnalyticsItem {
  roadmap_id: string;
  title: string;
  domain: string;
  level: string;
  total_questions: number;
  assigned_trainers_count: number;
  completed_trainers_count: number;
  total_solved_sum: number;
  completion_percentage: number;
}

/**
 * Extracts all unique question IDs from roadmap topics (handles both nested topics with questions array & flat topics).
 */
export function extractRoadmapQuestionIds(topics: any[]): string[] {
  if (!Array.isArray(topics) || topics.length === 0) return [];
  const qIds: string[] = [];

  const hasNested = topics.some(
    (t) => t && t.questions && Array.isArray(t.questions) && t.questions.length > 0
  );

  if (hasNested) {
    topics.forEach((t) => {
      (t?.questions || []).forEach((q: any) => {
        const id = q?.id || q?.question_id;
        if (id) qIds.push(String(id));
      });
    });
  } else {
    topics.forEach((t) => {
      const id = t?.id || t?.question_id;
      if (id) qIds.push(String(id));
    });
  }

  return Array.from(new Set(qIds));
}

/**
 * Fetches roadmap cohort completion analytics directly from PostgreSQL RPC `get_roadmap_analytics()`,
 * with an automatic fallback calculation if the database migration has not been executed yet.
 */
export async function getRoadmapAnalytics(supabase: SupabaseClient): Promise<RoadmapCompletionStat[]> {
  try {
    // 1. Attempt PostgreSQL RPC call
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_roadmap_analytics');

    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData.map((row: any) => ({
        roadmapId: row.roadmap_id,
        title: row.title,
        domain: row.domain || 'DSA',
        level: row.level || 'Intermediate',
        totalTopics: Number(row.total_questions || 0),
        assignedTrainersCount: Number(row.assigned_trainers_count || 0),
        completedTrainersCount: Number(row.completed_trainers_count || 0),
        completionPercentage: Number(row.completion_percentage || 0),
      }));
    }
  } catch (err) {
    console.warn('[getRoadmapAnalytics] RPC fallback triggered:', err);
  }

  // 2. Fallback in-app calculation (matches database logic 1:1)
  const [roadmapsRes, assignmentsRes, groupMembersRes, progressRes] = await Promise.all([
    supabase.from('roadmaps').select('id, title, domain, level, topics').order('created_at', { ascending: false }),
    supabase.from('roadmap_assignments').select('roadmap_id, user_id, group_id'),
    supabase.from('group_members').select('group_id, user_id'),
    supabase.from('progress').select('user_id, question_id, status, score, max_score'),
  ]);

  const roadmaps = roadmapsRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const progressRows = progressRes.data || [];

  // Group members lookup
  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  return roadmaps.map((r: any) => {
    const qIds = extractRoadmapQuestionIds(r.topics || []);
    const totalQuestions = qIds.length;

    // Resolve assigned users (combining direct user_id and group_members)
    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.roadmap_id === r.id) {
        if (a.user_id) assignedUserIds.add(a.user_id);
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    const assignedCount = assignedUserIds.size;
    let completedTrainers = 0;
    let totalSolvedSum = 0;

    assignedUserIds.forEach((uid) => {
      const userSolvedCount = qIds.filter((qid) =>
        progressRows.some((p: any) =>
          p.user_id === uid &&
          String(p.question_id) === qid &&
          (p.status === 'solved' || (p.score != null && p.max_score != null && p.max_score > 0 && p.score >= p.max_score))
        )
      ).length;

      totalSolvedSum += userSolvedCount;
      if (totalQuestions > 0 && userSolvedCount >= totalQuestions) {
        completedTrainers++;
      }
    });

    const maxPossible = totalQuestions * assignedCount;
    const pct = (maxPossible > 0 && assignedCount > 0)
      ? Math.min(100, Math.round((totalSolvedSum / maxPossible) * 100))
      : 0;

    return {
      roadmapId: r.id,
      title: r.title,
      domain: r.domain || 'DSA',
      level: r.level || 'Intermediate',
      totalTopics: totalQuestions,
      assignedTrainersCount: assignedCount,
      completedTrainersCount: completedTrainers,
      completionPercentage: pct,
    };
  });
}
