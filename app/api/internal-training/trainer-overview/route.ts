import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { isRecordSolved } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { formatISODate } from '@/lib/it-calendar';
import { ITTrainerOverviewItem } from '@/lib/types';

// GET /api/internal-training/trainer-overview
// Admin/Manager view: returns status of all trainers assigned to IT roadmaps
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();

  // 1. Attempt Fast Database RPC (PostgreSQL Stored Procedure)
  try {
    const { data: rpcTrainers, error: rpcErr } = await dbAdmin.rpc('get_it_trainer_overview');
    if (!rpcErr && Array.isArray(rpcTrainers) && rpcTrainers.length > 0) {
      return NextResponse.json({ trainers: rpcTrainers });
    }
  } catch (err) {
    console.warn('[trainer-overview] RPC fallback triggered:', err);
  }

  const today = formatISODate(new Date());

  // 2. Fallback in-app calculation
  const { data: itRoadmaps } = await dbAdmin
    .from('roadmaps')
    .select('id, title')
    .eq('is_it_roadmap', true);

  if (!itRoadmaps || itRoadmaps.length === 0) {
    return NextResponse.json({ trainers: [] });
  }

  const roadmapIds = itRoadmaps.map((r: any) => r.id);
  const roadmapMap = new Map<string, string>();
  itRoadmaps.forEach((r: any) => roadmapMap.set(r.id, r.title));

  // 2. Fetch configs, day plans, assignments, group members, users, and progress
  const [
    configsRes,
    dayPlansRes,
    assignmentsRes,
    groupMembersRes,
    allUsersRes,
    trainerProgressRes,
    authUsersRes,
  ] = await Promise.all([
    dbAdmin.from('it_roadmap_config').select('*').in('roadmap_id', roadmapIds),
    dbAdmin.from('it_day_plans').select('id, roadmap_id, day_number').in('roadmap_id', roadmapIds),
    dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id').in('roadmap_id', roadmapIds),
    dbAdmin.from('group_members').select('group_id, user_id'),
    dbAdmin.from('users').select('id, full_name, emp_id, email, team, role').neq('role', 'admin'),
    dbAdmin.from('it_trainer_progress').select('*').in('roadmap_id', roadmapIds),
    dbAdmin.auth.admin.listUsers({ perPage: 1000 }).catch((authErr: any) => {
      console.warn('[trainer-overview] Failed to list auth users (online status will be unavailable):', authErr?.message || authErr);
      return { data: { users: [] } };
    }),
  ]);

  const configs = configsRes.data || [];
  const dayPlans = dayPlansRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const allUsers = allUsersRes.data || [];
  const trainerProgressList = trainerProgressRes.data || [];
  const authUsersList = (authUsersRes as any)?.data?.users || [];

  const authMetaMap = new Map<string, any>();
  authUsersList.forEach((au: any) => {
    authMetaMap.set(au.id, au.user_metadata || {});
  });

  // Fetch questions for day plans
  const dayPlanIds = dayPlans.map((dp: any) => dp.id);
  let allQuestions: any[] = [];
  if (dayPlanIds.length > 0) {
    const { data: qData } = await dbAdmin
      .from('it_day_questions')
      .select('id, day_plan_id, question_id, order_index')
      .in('day_plan_id', dayPlanIds);
    allQuestions = qData || [];
  }

  // Extract roadmap question IDs and day question IDs to query completions accurately
  const relevantQuestionIds = Array.from(
    new Set(allQuestions.map((q: any) => q.question_id).filter(Boolean))
  );
  const relevantDayQuestionIds = allQuestions.map((q: any) => q.id);

  // Fetch completions and progress specifically scoped to roadmap questions with pagination
  let completions: any[] = [];
  if (relevantDayQuestionIds.length > 0) {
    let cFrom = 0;
    const cStep = 1000;
    while (true) {
      const { data: cPage } = await dbAdmin
        .from('it_question_completions')
        .select('user_id, day_question_id, clicked_at, is_completed')
        .in('day_question_id', relevantDayQuestionIds)
        .order('id', { ascending: true })
        .range(cFrom, cFrom + cStep - 1);
      if (!cPage || cPage.length === 0) break;
      completions = completions.concat(cPage);
      if (cPage.length < cStep) break;
      cFrom += cStep;
    }
  }

  let hrProgress: any[] = [];
  if (relevantQuestionIds.length > 0) {
    let pFrom = 0;
    const pStep = 1000;
    while (true) {
      const { data: pPage } = await dbAdmin
        .from('progress')
        .select('user_id, question_id, status, score, max_score')
        .in('question_id', relevantQuestionIds)
        .eq('status', 'solved')
        .order('id', { ascending: true })
        .range(pFrom, pFrom + pStep - 1);
      if (!pPage || pPage.length === 0) break;
      hrProgress = hrProgress.concat(pPage);
      if (pPage.length < pStep) break;
      pFrom += pStep;
    }
  }

  // Maps for fast lookups
  const configMap = new Map<string, any>();
  configs.forEach((c: any) => configMap.set(c.roadmap_id, c));

  const userMap = new Map<string, any>();
  allUsers.forEach((u: any) => userMap.set(u.id, u));

  // Map group_id -> set of user_ids
  const groupMembersMap = new Map<string, Set<string>>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, new Set());
    groupMembersMap.get(gm.group_id)!.add(gm.user_id);
  });

  // Map roadmap_id -> set of user_ids
  const roadmapTrainersMap = new Map<string, Set<string>>();
  roadmapIds.forEach((rmId) => roadmapTrainersMap.set(rmId, new Set()));

  assignments.forEach((a: any) => {
    const targetSet = roadmapTrainersMap.get(a.roadmap_id);
    if (!targetSet) return;
    if (a.user_id) targetSet.add(a.user_id);
    if (a.group_id && groupMembersMap.has(a.group_id)) {
      groupMembersMap.get(a.group_id)!.forEach((uid) => targetSet.add(uid));
    }
  });

  // Map (user_id, roadmap_id) -> progress
  const progressMap = new Map<string, any>();
  trainerProgressList.forEach((p: any) => {
    progressMap.set(`${p.user_id}_${p.roadmap_id}`, p);
  });

  // Map day_plan_id -> questions
  const dayPlanQuestionsMap = new Map<string, any[]>();
  allQuestions.forEach((q: any) => {
    if (!dayPlanQuestionsMap.has(q.day_plan_id)) dayPlanQuestionsMap.set(q.day_plan_id, []);
    dayPlanQuestionsMap.get(q.day_plan_id)!.push(q);
  });

  // Map roadmap_id -> day plans
  const roadmapDayPlansMap = new Map<string, any[]>();
  dayPlans.forEach((dp: any) => {
    if (!roadmapDayPlansMap.has(dp.roadmap_id)) roadmapDayPlansMap.set(dp.roadmap_id, []);
    roadmapDayPlansMap.get(dp.roadmap_id)!.push(dp);
  });

  // Map (user_id, day_question_id) -> completion
  const completionMap = new Map<string, any>();
  completions.forEach((c: any) => {
    completionMap.set(`${c.user_id}_${c.day_question_id}`, c);
  });

  // Map (user_id, question_id) -> solved
  const hrSolvedLookup = new Set<string>();
  hrProgress.forEach((p: any) => {
    if (isRecordSolved(p)) {
      hrSolvedLookup.add(`${p.user_id}_${p.question_id}`);
    }
  });

  // Build overview list
  const overviewList: ITTrainerOverviewItem[] = [];

  roadmapIds.forEach((rmId) => {
    const rmTitle = roadmapMap.get(rmId) || 'IT Roadmap';
    const assignedUserIds = roadmapTrainersMap.get(rmId) || new Set();
    const rmDayPlans = roadmapDayPlansMap.get(rmId) || [];
    const rmConfig = configMap.get(rmId) || { working_days: [1, 2, 3, 4, 5] };
    const workingDays = rmConfig.working_days || [1, 2, 3, 4, 5];
    const totalDays = rmDayPlans.length;

    // Collect all questions for this roadmap
    const rmQuestions: (any & { day_number: number })[] = [];
    rmDayPlans.forEach((dp: any) => {
      const qs = dayPlanQuestionsMap.get(dp.id) || [];
      qs.forEach((q: any) => {
        rmQuestions.push({ ...q, day_number: dp.day_number });
      });
    });
    const totalQuestionsCount = rmQuestions.length;

    assignedUserIds.forEach((uid) => {
      const u = userMap.get(uid);
      if (!u) return;

      const p = progressMap.get(`${uid}_${rmId}`);
      // Per-roadmap attendance-driven day: use it_days_logged from progress row
      const itDaysLogged = p?.it_days_logged || 0;
      const currentDay = Math.min(itDaysLogged, totalDays || 1);
      const lastCheckIn = p?.last_check_in_date || null;
      const isCountedToday = lastCheckIn === today;

      // Count completions for this trainer
      // Portal-click gating: question is complete only if clicked_at exists AND (HR solved OR manually completed)
      let completedCount = 0;
      let pendingCount = 0;

      rmQuestions.forEach((q) => {
        const comp = completionMap.get(`${uid}_${q.id}`);
        const hasClicked = Boolean(comp?.clicked_at);
        const isManuallyCompleted = Boolean(comp?.is_completed);
        const isHrSolved = q.question_id ? hrSolvedLookup.has(`${uid}_${q.question_id}`) : false;

        const isComp = hasClicked && (isHrSolved || isManuallyCompleted);

        if (isComp) {
          completedCount++;
        } else {
          // If the question belongs to a day <= currentDay and is incomplete, it's pending
          if (q.day_number <= currentDay) {
            pendingCount++;
          }
        }
      });

      overviewList.push({
        user_id: u.id,
        full_name: u.full_name || 'Unnamed Trainer',
        emp_id: u.emp_id || '—',
        team: u.team || 'N/A',
        email: u.email,
        roadmap_id: rmId,
        roadmap_title: rmTitle,
        started_at: p?.started_at || null,
        current_day: currentDay,
        total_days: totalDays,
        completed_questions_count: completedCount,
        total_questions_count: totalQuestionsCount,
        pending_questions_count: pendingCount,
        it_days_count: itDaysLogged,
        extended_days: p?.extended_days || 0,
        extension_count: p?.extension_count || 0,
        location: isCountedToday ? p?.location || null : null,
        is_online: false, // populated on client via Realtime Presence
        last_it_check_date: lastCheckIn,
        is_it_counted_today: isCountedToday,
      });
    });
  });

  // Sort by pending questions desc, then name
  overviewList.sort((a, b) => b.pending_questions_count - a.pending_questions_count || a.full_name.localeCompare(b.full_name));

  return NextResponse.json({ trainers: overviewList });
}
