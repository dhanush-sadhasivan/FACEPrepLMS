import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isRecordSolved } from '@/lib/utils';

const isQuestionSolved = isRecordSolved;


// GET /api/trainer/roadmaps — Fetch roadmaps assigned to the logged-in user with auto-synced progress & date analytics
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Fetch user's group memberships
  const { data: groupMemberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);
  const groupIds = (groupMemberships || []).map((g: { group_id: string }) => g.group_id);

  // 2. Fetch user's roadmap assignments (direct or via group)
  const { data: userAssignments } = await supabase
    .from('roadmap_assignments')
    .select('roadmap_id')
    .eq('user_id', user.id);

  let groupAssignmentRoadmapIds: string[] = [];
  if (groupIds.length > 0) {
    const { data: groupAssignments } = await supabase
      .from('roadmap_assignments')
      .select('roadmap_id')
      .in('group_id', groupIds);
    groupAssignmentRoadmapIds = (groupAssignments || []).map((a: { roadmap_id: string }) => a.roadmap_id);
  }

  const allRoadmapIds = [
    ...new Set([
      ...(userAssignments || []).map((a: { roadmap_id: string }) => a.roadmap_id),
      ...groupAssignmentRoadmapIds,
    ]),
  ];

  // 3. Fetch roadmaps, contest titles, existing user_roadmap_progress, and user progress on questions
  const [roadmapsResult, contestsResult, progressResult, questionProgressResult] = await Promise.all([
    allRoadmapIds.length > 0
      ? supabase.from('roadmaps').select('*').in('id', allRoadmapIds).order('created_at', { ascending: false })
      : supabase.from('roadmaps').select('*').order('created_at', { ascending: false }),
    supabase.from('contests').select('id, title'),
    supabase.from('user_roadmap_progress').select('*').eq('user_id', user.id),
    supabase.from('progress').select('*').eq('user_id', user.id),
  ]);

  const roadmaps = roadmapsResult.data || [];
  const contests = contestsResult.data || [];
  const existingProgress = progressResult.data || [];
  const questionProgress = questionProgressResult.data || [];

  // 4. Merge & compute auto-synced progress for each roadmap
  const result = roadmaps.map((rm: any) => {
    const contest = contests.find((c: any) => c.id === rm.contest_id);
    const existing = existingProgress.find((p: any) => p.roadmap_id === rm.id);

    const topics = rm.topics || [];
    const completedTopicIdsSet = new Set<string>();
    const solvedQuestionIdsSet = new Set<string>();
    const topicCompletionDates: Record<string, string> = {};
    let earliestAttemptedDate: string | null = null;
    let latestCompletedDate: string | null = null;

    let totalQuestionsCount = 0;

    // Check each topic and its nested questions for completion via scraped progress or manual state
    topics.forEach((topic: any) => {
      let isTopicSolved = false;
      let solvedTimestamp: string | null = null;

      // Handle topic with nested questions (e.g. Topic: "LinkedList", Questions: [q1, q2])
      if (topic.questions && Array.isArray(topic.questions) && topic.questions.length > 0) {
        totalQuestionsCount += topic.questions.length;
        let allQuestionsSolved = true;
        topic.questions.forEach((q: any) => {
          const qId = q.question_id || q.id;
          const qp = questionProgress.find((p: any) => p.question_id === qId);
          const qSolved = isRecordSolved(qp) || existing?.completed_topic_ids?.includes(q.id) || (qId && existing?.completed_topic_ids?.includes(qId));
          
          if (qSolved) {
            if (q.id) {
              completedTopicIdsSet.add(String(q.id));
              solvedQuestionIdsSet.add(String(q.id));
            }
            if (qId) {
              completedTopicIdsSet.add(String(qId));
              solvedQuestionIdsSet.add(String(qId));
            }
            const ts = qp?.updated_at || qp?.last_submission_at || existing?.topic_completion_dates?.[q.id] || new Date().toISOString();
            if (q.id) topicCompletionDates[q.id] = ts;
            if (qId) topicCompletionDates[qId] = ts;
            if (ts && (!earliestAttemptedDate || new Date(ts) < new Date(earliestAttemptedDate))) earliestAttemptedDate = ts;
            if (ts && (!latestCompletedDate || new Date(ts) > new Date(latestCompletedDate))) latestCompletedDate = ts;
          } else {
            allQuestionsSolved = false;
          }
        });
        if (allQuestionsSolved) {
          isTopicSolved = true;
        }
      } else if (topic.question_id || topic.id) {
        // Handle single question topic
        totalQuestionsCount += 1;
        const qId = topic.question_id || topic.id;
        const qp = questionProgress.find((p: any) => p.question_id === qId);
        if (isRecordSolved(qp)) {
          isTopicSolved = true;
          solvedTimestamp = qp.updated_at || qp.last_submission_at || new Date().toISOString();
          if (solvedTimestamp && (!earliestAttemptedDate || new Date(solvedTimestamp) < new Date(earliestAttemptedDate))) {
            earliestAttemptedDate = solvedTimestamp;
          }
        }
      } else {
        totalQuestionsCount += 1;
      }

      // Fallback to manual check-off in user_roadmap_progress if recorded
      if (!isTopicSolved && existing?.completed_topic_ids?.includes(topic.id)) {
        isTopicSolved = true;
        solvedTimestamp = existing.topic_completion_dates?.[topic.id] || existing.updated_at || new Date().toISOString();
      }

      if (isTopicSolved) {
        completedTopicIdsSet.add(String(topic.id));
        if (solvedTimestamp) {
          topicCompletionDates[topic.id] = solvedTimestamp;
          if (!latestCompletedDate || new Date(solvedTimestamp) > new Date(latestCompletedDate)) {
            latestCompletedDate = solvedTimestamp;
          }
        }
      }
    });

    const totalTarget = totalQuestionsCount || topics.length;
    const completedCount = solvedQuestionIdsSet.size > 0 ? solvedQuestionIdsSet.size : (completedTopicIdsSet.size);
    const computedStatus =
      completedCount === 0
        ? 'not_started'
        : completedCount >= totalTarget
        ? 'completed'
        : 'in_progress';

    const startedAt = earliestAttemptedDate || (completedCount > 0 ? (existing?.started_at || new Date().toISOString()) : null);
    const completedAt = computedStatus === 'completed' ? (latestCompletedDate || existing?.completed_at || new Date().toISOString()) : null;

    return {
      ...rm,
      contest_title: contest?.title || null,
      progress: {
        id: existing?.id || '',
        user_id: user.id,
        roadmap_id: rm.id,
        completed_topic_ids: Array.from(completedTopicIdsSet),
        topic_completion_dates: topicCompletionDates,
        status: computedStatus,
        started_at: startedAt,
        completed_at: completedAt,
        updated_at: existing?.updated_at || new Date().toISOString(),
      },
    };
  });

  return NextResponse.json(result);
}

// PATCH /api/trainer/roadmaps — Update manual completion state
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { roadmap_id, completed_topic_ids, topic_completion_dates } = body;

  if (!roadmap_id) return NextResponse.json({ error: 'roadmap_id is required' }, { status: 400 });

  const { data: roadmap } = await supabase
    .from('roadmaps')
    .select('topics')
    .eq('id', roadmap_id)
    .single();

  const totalTopics = (roadmap?.topics as unknown[])?.length || 0;
  const completedCount = (completed_topic_ids as string[])?.length || 0;
  const status =
    completedCount === 0
      ? 'not_started'
      : completedCount >= totalTopics
      ? 'completed'
      : 'in_progress';

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_roadmap_progress')
    .upsert(
      {
        user_id: user.id,
        roadmap_id,
        completed_topic_ids,
        topic_completion_dates: topic_completion_dates || {},
        status,
        started_at: completedCount > 0 ? now : null,
        completed_at: status === 'completed' ? now : null,
        updated_at: now,
      },
      { onConflict: 'user_id,roadmap_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
