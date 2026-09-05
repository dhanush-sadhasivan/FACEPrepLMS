import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractRoadmapQuestionIds } from '@/lib/roadmap-analytics';
import { isRecordSolved } from '@/lib/utils';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonResponse(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(init?.headers || {}),
    },
  });
}

const isQuestionSolved = isRecordSolved;


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('reportType') || 'contests';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const teamFilter = searchParams.get('team');
  const contestFilter = searchParams.get('contestId');
  const roadmapFilter = searchParams.get('roadmapId');
  const searchFilter = (searchParams.get('search') || '').toLowerCase().trim();

  const supabase = await createClient();
  let user: any = null;
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: userData } = await supabase.auth.getUser(token);
    user = userData?.user;
  }
  if (!user) {
    const { data: userData } = await supabase.auth.getUser();
    user = userData?.user;
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbAdmin = getAdminClient();

  // 1. Fetch user role & profile
  const { data: profile } = await dbAdmin
    .from('users')
    .select('id, full_name, emp_id, email, team, manager, role, it_days_count, last_it_check_date')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  const role = profile.role || 'trainer';
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // 2. Fetch all users (trainers)
  let allUsers: any[] = [];
  let uFrom = 0;
  const uStep = 1000;
  while (true) {
    const { data: uPage } = await dbAdmin
      .from('users')
      .select('id, full_name, emp_id, email, emp_email, team, manager, hackerrank_id, role, created_at, it_days_count, last_it_check_date')
      .order('id', { ascending: true })
      .range(uFrom, uFrom + uStep - 1);
    if (!uPage || uPage.length === 0) break;
    allUsers = allUsers.concat(uPage);
    if (uPage.length < uStep) break;
    uFrom += uStep;
  }

  // Map users for fast lookup
  const userMap = new Map<string, any>();
  allUsers.forEach((u) => userMap.set(u.id, u));

  // If role is trainer and requesting organizational data, default to their personal transcript
  if (!isAdminOrManager && reportType !== 'personal-transcript') {
    // Non-admin can only access personal-transcript
    return handlePersonalTranscript(user.id, profile, dbAdmin);
  }

  if (reportType === 'personal-transcript') {
    const targetUserId = isAdminOrManager && searchParams.get('userId') ? searchParams.get('userId')! : user.id;
    const targetProfile = userMap.get(targetUserId) || profile;
    return handlePersonalTranscript(targetUserId, targetProfile, dbAdmin);
  }

  if (reportType === 'contests') {
    return handleContestsReport(dbAdmin, allUsers, userMap, {
      startDate,
      endDate,
      teamFilter,
      contestFilter,
      searchFilter,
    });
  }

  if (reportType === 'it-attendance') {
    return handleITAttendanceReport(dbAdmin, allUsers, userMap, {
      startDate,
      endDate,
      teamFilter,
      roadmapFilter,
      searchFilter,
    });
  }

  if (reportType === 'teams') {
    return handleTeamsReport(dbAdmin, allUsers, {
      startDate,
      endDate,
      teamFilter,
      searchFilter,
    });
  }

  if (reportType === 'roadmaps') {
    return handleRoadmapsReport(dbAdmin, allUsers, userMap, {
      startDate,
      endDate,
      teamFilter,
      roadmapFilter,
      searchFilter,
    });
  }

  if (reportType === 'inactivity-audit') {
    return handleInactivityAuditReport(dbAdmin, allUsers, {
      teamFilter,
      searchFilter,
    });
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONTESTS REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleContestsReport(
  dbAdmin: any,
  allUsers: any[],
  userMap: Map<string, any>,
  filters: { startDate?: string | null; endDate?: string | null; teamFilter?: string | null; contestFilter?: string | null; searchFilter: string }
) {
  // Fetch contests, assignments, group members, questions
  const [
    contestsRes,
    assignmentsRes,
    groupMembersRes,
    questionsRes,
  ] = await Promise.all([
    dbAdmin.from('contests').select('*').order('created_at', { ascending: false }),
    dbAdmin.from('contest_assignments').select('contest_id, group_id, team'),
    dbAdmin.from('group_members').select('group_id, user_id'),
    dbAdmin.from('questions').select('id, contest_id, title, max_score, domain, difficulty'),
  ]);

  const contests = contestsRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const questions = questionsRes.data || [];

  // Group members map
  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  // Team users map
  const teamUsersMap = new Map<string, string[]>();
  allUsers.forEach((u) => {
    if (u.team && u.team !== 'N/A') {
      if (!teamUsersMap.has(u.team)) teamUsersMap.set(u.team, []);
      teamUsersMap.get(u.team)!.push(u.id);
    }
  });

  // Filter contests by ID if requested
  const targetContests = filters.contestFilter && filters.contestFilter !== 'all'
    ? contests.filter((c: any) => c.id === filters.contestFilter)
    : contests;

  const targetContestIds = targetContests.map((c: any) => c.id);

  // Fetch progress ONLY for target contests
  let allProgress: any[] = [];
  if (targetContestIds.length > 0) {
    let pFrom = 0;
    const pStep = 1000;
    while (true) {
      const { data: pageRows } = await dbAdmin
        .from('progress')
        .select('contest_id, user_id, question_id, status, score, max_score, last_submission_at')
        .in('contest_id', targetContestIds)
        .order('id', { ascending: true })
        .range(pFrom, pFrom + pStep - 1);
      if (!pageRows || pageRows.length === 0) break;
      allProgress = allProgress.concat(pageRows);
      if (pageRows.length < pStep) break;
      pFrom += pStep;
    }
  }

  const rows: any[] = [];
  let allScores: number[] = [];
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;

  targetContests.forEach((contest: any) => {
    const contestQs = questions.filter((q: any) => q.contest_id === contest.id);
    const totalQs = contestQs.length;
    const maxContestScore = contestQs.reduce((acc: number, q: any) => acc + (q.max_score || 10), 0);

    contestQs.forEach((q: any) => {
      const diff = (q.difficulty || '').toLowerCase();
      if (diff === 'easy') easyCount++;
      else if (diff === 'medium') mediumCount++;
      else if (diff === 'hard') hardCount++;
    });

    // Identify assigned users for this contest
    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.contest_id === contest.id) {
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
        if (a.team) {
          (teamUsersMap.get(a.team) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    // Build user stats (strictly assigned participants only)
    const contestUserRows: any[] = [];

    assignedUserIds.forEach((userId) => {
      const u = userMap.get(userId);
      if (!u || u.role === 'admin') return;

      const userProgress = allProgress.filter((p) => p.contest_id === contest.id && p.user_id === userId);
      const solvedQs = userProgress.filter(isQuestionSolved);
      const solvedCount = solvedQs.length;
      const totalUserScore = userProgress.reduce((acc, p) => acc + (p.score || 0), 0);
      const completionPct = totalQs > 0 ? Math.round((solvedCount / totalQs) * 100) : 0;
      const accuracyPct = maxContestScore > 0 ? Math.round((totalUserScore / maxContestScore) * 100) : 0;

      // Find latest submission timestamp
      let latestSubDate: string | null = null;
      userProgress.forEach((p) => {
        if (p.last_submission_at) {
          if (!latestSubDate || new Date(p.last_submission_at) > new Date(latestSubDate)) {
            latestSubDate = p.last_submission_at;
          }
        }
      });

      let status = 'Unattempted';
      if (completionPct >= 100) status = 'Mastered';
      else if (solvedCount > 0 || userProgress.length > 0) status = 'In Progress';

      contestUserRows.push({
        contestId: contest.id,
        contestTitle: contest.title,
        hackerrankSlug: contest.hackerrank_slug,
        contestStartDate: contest.start_date,
        contestEndDate: contest.end_date,
        userId: u.id,
        trainerName: u.full_name,
        empId: u.emp_id || '—',
        email: u.email,
        team: u.team || 'N/A',
        manager: u.manager || '—',
        hackerrankId: u.hackerrank_id || '—',
        solvedCount,
        totalQuestions: totalQs,
        completionPct,
        accuracyPct,
        score: totalUserScore,
        maxPossibleScore: maxContestScore,
        status,
        lastSubmissionAt: latestSubDate,
      });
      
      allScores.push(totalUserScore);
    });

    // Also include unassigned users who have progress data for this contest
    // (e.g. users who were previously assigned but later removed)
    const unassignedProgressUsers = new Set<string>();
    allProgress
      .filter((p) => p.contest_id === contest.id && !assignedUserIds.has(p.user_id))
      .forEach((p) => unassignedProgressUsers.add(p.user_id));

    unassignedProgressUsers.forEach((userId) => {
      const u = userMap.get(userId);
      if (!u || u.role === 'admin') return;

      const userProgress = allProgress.filter((p) => p.contest_id === contest.id && p.user_id === userId);
      const solvedQs = userProgress.filter(isQuestionSolved);
      const solvedCount = solvedQs.length;
      const totalUserScore = userProgress.reduce((acc, p) => acc + (p.score || 0), 0);
      const completionPct = totalQs > 0 ? Math.round((solvedCount / totalQs) * 100) : 0;
      const accuracyPct = maxContestScore > 0 ? Math.round((totalUserScore / maxContestScore) * 100) : 0;

      let latestSubDate: string | null = null;
      userProgress.forEach((p) => {
        if (p.last_submission_at) {
          if (!latestSubDate || new Date(p.last_submission_at) > new Date(latestSubDate)) {
            latestSubDate = p.last_submission_at;
          }
        }
      });

      let status = 'Unattempted (Unassigned)';
      if (completionPct >= 100) status = 'Mastered (Unassigned)';
      else if (solvedCount > 0 || userProgress.length > 0) status = 'In Progress (Unassigned)';

      contestUserRows.push({
        contestId: contest.id,
        contestTitle: contest.title,
        hackerrankSlug: contest.hackerrank_slug,
        contestStartDate: contest.start_date,
        contestEndDate: contest.end_date,
        userId: u.id,
        trainerName: u.full_name,
        empId: u.emp_id || '—',
        email: u.email,
        team: u.team || 'N/A',
        manager: u.manager || '—',
        hackerrankId: u.hackerrank_id || '—',
        solvedCount,
        totalQuestions: totalQs,
        completionPct,
        accuracyPct,
        score: totalUserScore,
        maxPossibleScore: maxContestScore,
        status,
        lastSubmissionAt: latestSubDate,
      });

      allScores.push(totalUserScore);
    });

    // Sort to assign ranks (canonical 3-tier tie-break)
    contestUserRows.sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount || a.trainerName.localeCompare(b.trainerName));
    const totalContestRows = contestUserRows.length;
    let currentDenseRank = 1;
    contestUserRows.forEach((r, idx) => {
      if (idx > 0) {
        const prev = contestUserRows[idx - 1];
        if (r.score !== prev.score || r.solvedCount !== prev.solvedCount) {
          currentDenseRank = idx + 1;
        }
      }
      r.rank = currentDenseRank;
      r.percentile = (totalContestRows > 0 && r.score > 0)
        ? Math.max(0, Math.min(100, Math.round(((totalContestRows - r.rank) / totalContestRows) * 100)))
        : 0;
      rows.push(r);
    });
  });

  // Apply filters
  let filteredRows = rows;

  if (filters.teamFilter && filters.teamFilter !== 'all') {
    filteredRows = filteredRows.filter((r) => r.team === filters.teamFilter);
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filteredRows = filteredRows.filter((r) => r.lastSubmissionAt && new Date(r.lastSubmissionAt).getTime() >= start);
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    filteredRows = filteredRows.filter((r) => r.lastSubmissionAt && new Date(r.lastSubmissionAt).getTime() <= end);
  }

  if (filters.searchFilter) {
    filteredRows = filteredRows.filter((r) =>
      r.trainerName.toLowerCase().includes(filters.searchFilter) ||
      r.empId.toLowerCase().includes(filters.searchFilter) ||
      r.team.toLowerCase().includes(filters.searchFilter) ||
      r.contestTitle.toLowerCase().includes(filters.searchFilter)
    );
  }

  // Summary KPI calculation
  const totalEnrolled = filteredRows.length;
  const masteredCount = filteredRows.filter((r) => r.status === 'Mastered').length;
  const avgScore = totalEnrolled > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.score, 0) / totalEnrolled) : 0;
  const avgCompletionPct = totalEnrolled > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.completionPct, 0) / totalEnrolled) : 0;

  // New KPIs
  allScores.sort((a, b) => a - b);
  let min = 0, median = 0, max = 0;
  if (allScores.length > 0) {
    min = allScores[0];
    max = allScores[allScores.length - 1];
    const mid = Math.floor(allScores.length / 2);
    median = allScores.length % 2 !== 0 ? allScores[mid] : (allScores[mid - 1] + allScores[mid]) / 2;
  }
  
  let topScorerName = '—';
  if (filteredRows.length > 0) {
    const sortedFiltered = [...filteredRows].sort((a, b) => b.score - a.score || a.trainerName.localeCompare(b.trainerName));
    if (sortedFiltered.length > 0) topScorerName = sortedFiltered[0].trainerName;
  }

  return jsonResponse({
    reportType: 'contests',
    rows: filteredRows,
    kpis: {
      totalContests: targetContests.length,
      totalEnrolledTrainers: totalEnrolled,
      masteredCount,
      avgScore,
      avgCompletionPct,
      scoreDistribution: { min, median, max },
      difficultyBreakdown: { easy: easyCount, medium: mediumCount, hard: hardCount },
      topScorerName,
    },
    meta: {
      availableContests: contests.map((c: any) => ({ id: c.id, title: c.title })),
      availableTeams: Array.from(new Set(allUsers.map((u) => u.team).filter((t) => t && t !== 'N/A'))),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INTERNAL TRAINING (IT) & ATTENDANCE REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleITAttendanceReport(
  dbAdmin: any,
  allUsers: any[],
  userMap: Map<string, any>,
  filters: { startDate?: string | null; endDate?: string | null; teamFilter?: string | null; roadmapFilter?: string | null; searchFilter: string }
) {
  const { data: itRoadmaps } = await dbAdmin
    .from('roadmaps')
    .select('id, title, domain, level')
    .eq('is_it_roadmap', true);

  if (!itRoadmaps || itRoadmaps.length === 0) {
    return jsonResponse({ reportType: 'it-attendance', rows: [], kpis: {}, meta: {} });
  }

  const roadmapIds: string[] = itRoadmaps.map((r: any) => r.id);
  const roadmapMap = new Map<string, any>();
  itRoadmaps.forEach((r: any) => roadmapMap.set(r.id, r));

  // Fetch day plan counts per roadmap to get accurate totalDays
  const { data: dayPlanRows } = await dbAdmin
    .from('it_day_plans')
    .select('id, roadmap_id, day_number')
    .in('roadmap_id', roadmapIds);

  const dayPlans = dayPlanRows || [];
  const roadmapDaysMap = new Map<string, number>();
  dayPlans.forEach((dp: any) => {
    roadmapDaysMap.set(dp.roadmap_id, (roadmapDaysMap.get(dp.roadmap_id) || 0) + 1);
  });

  // 1. Fetch overview from RPC
  let overviewList: any[] = [];
  try {
    const { data: itOverviewData, error: rpcErr } = await dbAdmin.rpc('get_it_trainer_overview');
    if (!rpcErr && Array.isArray(itOverviewData) && itOverviewData.length > 0) {
      overviewList = itOverviewData;
    }
  } catch (err) {
    console.warn('[handleITAttendanceReport] RPC get_it_trainer_overview call failed, using in-app fallback:', err);
  }

  // 2. In-app calculation fallback if RPC returned empty or failed
  if (overviewList.length === 0) {
    const [
      assignmentsRes,
      groupMembersRes,
      trainerProgressRes,
    ] = await Promise.all([
      dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id').in('roadmap_id', roadmapIds),
      dbAdmin.from('group_members').select('group_id, user_id'),
      dbAdmin.from('it_trainer_progress').select('*').in('roadmap_id', roadmapIds),
    ]);

    const assignments = assignmentsRes.data || [];
    const groupMembers = groupMembersRes.data || [];
    const trainerProgressList = trainerProgressRes.data || [];

    const dayPlanIds = dayPlans.map((dp: any) => dp.id);
    let allQuestions: any[] = [];
    if (dayPlanIds.length > 0) {
      const { data: qData } = await dbAdmin
        .from('it_day_questions')
        .select('id, day_plan_id, question_id, order_index')
        .in('day_plan_id', dayPlanIds);
      allQuestions = qData || [];
    }

    const relevantQuestionIds = Array.from(
      new Set(allQuestions.map((q: any) => q.question_id).filter(Boolean))
    );
    const relevantDayQuestionIds = allQuestions.map((q: any) => q.id);

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

    const groupMembersMap = new Map<string, Set<string>>();
    groupMembers.forEach((gm: any) => {
      if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, new Set());
      groupMembersMap.get(gm.group_id)!.add(gm.user_id);
    });

    const roadmapTrainersMap = new Map<string, Set<string>>();
    roadmapIds.forEach((rmId: string) => roadmapTrainersMap.set(rmId, new Set()));

    assignments.forEach((a: any) => {
      const targetSet = roadmapTrainersMap.get(a.roadmap_id);
      if (!targetSet) return;
      if (a.user_id) targetSet.add(a.user_id);
      if (a.group_id && groupMembersMap.has(a.group_id)) {
        groupMembersMap.get(a.group_id)!.forEach((uid) => targetSet.add(uid));
      }
    });

    trainerProgressList.forEach((p: any) => {
      if (roadmapTrainersMap.has(p.roadmap_id)) {
        roadmapTrainersMap.get(p.roadmap_id)!.add(p.user_id);
      }
    });

    const progressMap = new Map<string, any>();
    trainerProgressList.forEach((p: any) => {
      progressMap.set(`${p.user_id}_${p.roadmap_id}`, p);
    });

    const dayPlanQuestionsMap = new Map<string, any[]>();
    allQuestions.forEach((q: any) => {
      if (!dayPlanQuestionsMap.has(q.day_plan_id)) dayPlanQuestionsMap.set(q.day_plan_id, []);
      dayPlanQuestionsMap.get(q.day_plan_id)!.push(q);
    });

    const roadmapDayPlansMap = new Map<string, any[]>();
    dayPlans.forEach((dp: any) => {
      if (!roadmapDayPlansMap.has(dp.roadmap_id)) roadmapDayPlansMap.set(dp.roadmap_id, []);
      roadmapDayPlansMap.get(dp.roadmap_id)!.push(dp);
    });

    const completionMap = new Map<string, any>();
    completions.forEach((c: any) => {
      completionMap.set(`${c.user_id}_${c.day_question_id}`, c);
    });

    const hrSolvedLookup = new Set<string>();
    hrProgress.forEach((p: any) => {
      if (isRecordSolved(p)) {
        hrSolvedLookup.add(`${p.user_id}_${p.question_id}`);
      }
    });

    roadmapIds.forEach((rmId: string) => {
      const rm = roadmapMap.get(rmId);
      const rmTitle = rm?.title || 'IT Roadmap';
      const assignedUserIds = roadmapTrainersMap.get(rmId) || new Set();
      const rmDayPlans = roadmapDayPlansMap.get(rmId) || [];
      const totalDays = rmDayPlans.length;

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
        if (!u || u.role === 'admin') return;

        const p = progressMap.get(`${uid}_${rmId}`);
        const itDaysLogged = p?.it_days_logged ?? u.it_days_count ?? 0;
        const currentDay = Math.min(itDaysLogged, totalDays || 1);
        const lastCheckIn = p?.last_check_in_date || u.last_it_check_date || null;

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
          } else if (q.day_number <= currentDay) {
            pendingCount++;
          }
        });

        overviewList.push({
          user_id: u.id,
          full_name: u.full_name || 'Unknown Trainer',
          emp_id: u.emp_id || '—',
          email: u.email,
          team: u.team || 'General',
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
          location: p?.location || null,
          last_it_check_date: lastCheckIn,
        });
      });
    });
  }

  // 3. Fetch IT trainer progress to get extra metadata (started_at, last_check_in_date, location)
  let itProgressData: any[] = [];
  let pFrom = 0;
  const pStep = 1000;
  while (true) {
    const { data: pPage } = await dbAdmin
      .from('it_trainer_progress')
      .select('user_id, roadmap_id, started_at, updated_at, last_check_in_date, location, it_days_logged, extended_days, extension_count')
      .order('id', { ascending: true })
      .range(pFrom, pFrom + pStep - 1);
    if (!pPage || pPage.length === 0) break;
    itProgressData = itProgressData.concat(pPage);
    if (pPage.length < pStep) break;
    pFrom += pStep;
  }

  const progressLookup = new Map<string, any>();
  itProgressData.forEach((p: any) => {
    progressLookup.set(`${p.user_id}:${p.roadmap_id}`, p);
  });

  const now = new Date().getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const rows: any[] = [];

  overviewList.forEach((row: any) => {
    const u = userMap.get(row.user_id);
    if (u?.role === 'admin') return;

    const p = progressLookup.get(`${row.user_id}:${row.roadmap_id}`);
    const trainerName = u?.full_name || row.full_name || 'Unknown Trainer';
    const empId = u?.emp_id || row.emp_id || '—';
    const team = u?.team || row.team || 'General';
    const email = u?.email || row.email || '';
    const manager = u?.manager || '—';
    const rmTitle = row.roadmap_title || roadmapMap.get(row.roadmap_id)?.title || 'IT Roadmap';

    // Apply filters
    if (filters.roadmapFilter && filters.roadmapFilter !== 'all' && row.roadmap_id !== filters.roadmapFilter) return;
    if (filters.teamFilter && filters.teamFilter !== 'all' && team !== filters.teamFilter) return;

    // Location parsing
    const rawLoc = p?.location || row.location || null;
    let locationDisplay = '—';
    let locationType = '';
    let locationDetail = '';

    if (rawLoc) {
      let parsedLoc = rawLoc;
      if (typeof rawLoc === 'string' && rawLoc.trim().startsWith('{') && rawLoc.trim().endsWith('}')) {
        try {
          parsedLoc = JSON.parse(rawLoc);
        } catch {
          parsedLoc = rawLoc;
        }
      }

      if (typeof parsedLoc === 'string') {
        locationDisplay = parsedLoc;
        locationType = parsedLoc;
      } else if (typeof parsedLoc === 'object') {
        locationType = parsedLoc.type || parsedLoc.office_name || '';
        locationDetail = parsedLoc.detail || (parsedLoc.office_name && parsedLoc.office_name !== locationType ? parsedLoc.office_name : '') || parsedLoc.wfh_reason || '';
        locationDisplay = `${locationType}${locationDetail ? ` (${locationDetail})` : ''}`.trim() || '—';
      }
    }

    // Search filter
    if (filters.searchFilter) {
      const sf = filters.searchFilter;
      const matchesSearch =
        trainerName.toLowerCase().includes(sf) ||
        empId.toLowerCase().includes(sf) ||
        team.toLowerCase().includes(sf) ||
        rmTitle.toLowerCase().includes(sf) ||
        email.toLowerCase().includes(sf) ||
        locationDisplay.toLowerCase().includes(sf) ||
        locationType.toLowerCase().includes(sf) ||
        locationDetail.toLowerCase().includes(sf);

      if (!matchesSearch) return;
    }

    const startedAt = p?.started_at || row.started_at || null;
    const lastCheckInDate = p?.last_check_in_date || row.last_it_check_date || u?.last_it_check_date || (p?.updated_at ? p.updated_at.slice(0, 10) : null);

    if (filters.startDate) {
      if (!lastCheckInDate) return;
      const checkInTime = new Date(lastCheckInDate).getTime();
      const startTime = new Date(filters.startDate).getTime();
      if (checkInTime < startTime) return;
    }
    if (filters.endDate) {
      if (!lastCheckInDate) return;
      const checkInTime = new Date(lastCheckInDate).getTime();
      const endTime = filters.endDate.length === 10
        ? new Date(`${filters.endDate}T23:59:59.999Z`).getTime()
        : new Date(filters.endDate).getTime();
      if (checkInTime > endTime) return;
    }

    const completedQsCount = row.completed_questions_count || 0;
    const currentDay = row.current_day ?? p?.current_day ?? 0;
    const totalQuestions = row.total_questions_count || 0;
    const completionPct = totalQuestions > 0 ? Math.round((completedQsCount / totalQuestions) * 100) : 0;
    const pendingQuestions = row.pending_questions_count ?? Math.max(0, totalQuestions - completedQsCount);

    const completionVelocity = Math.round((completedQsCount / Math.max(1, currentDay)) * 10) / 10;
    const daysSinceLastActivity = lastCheckInDate ? Math.floor((now - new Date(lastCheckInDate).getTime()) / dayMs) : null;

    const extensionCount = row.extension_count ?? p?.extension_count ?? 0;
    const extendedDays = row.extended_days ?? p?.extended_days ?? 0;
    const itDaysCount = row.it_days_count ?? p?.it_days_logged ?? u?.it_days_count ?? 0;

    let attendanceStatus = 'On Track';
    if (completionPct >= 100) attendanceStatus = 'Completed';
    else if (pendingQuestions > 0 && daysSinceLastActivity !== null && daysSinceLastActivity > 3) attendanceStatus = 'Behind';
    else if (pendingQuestions > 0) attendanceStatus = 'Behind';
    else if (completionPct > 0 && daysSinceLastActivity !== null && daysSinceLastActivity <= 3) attendanceStatus = 'On Track';
    else if (extensionCount > 0) attendanceStatus = 'Extended';
    else if (completionPct === 0 && itDaysCount === 0) attendanceStatus = 'Not Started';

    const rm = roadmapMap.get(row.roadmap_id);

    rows.push({
      roadmapId: row.roadmap_id,
      roadmapTitle: rmTitle,
      domain: rm?.domain || 'Internal Training',
      userId: row.user_id,
      trainerName,
      empId,
      email,
      team,
      manager,
      itDaysCount,
      totalDays: roadmapDaysMap.get(row.roadmap_id) ?? row.total_days ?? 0,
      currentDay,
      startedAt,
      lastCheckInDate,
      location: rawLoc,
      locationDisplay,
      locationType,
      locationDetail,
      questionsCompleted: completedQsCount,
      totalQuestions,
      pendingQuestions,
      completionPct,
      extendedDays,
      extensionCount,
      attendanceStatus,
      completionVelocity,
      daysSinceLastActivity,
    });
  });

  // Summary KPIs
  const totalTrainers = rows.length;
  const completedCount = rows.filter((r) => r.attendanceStatus === 'Completed').length;
  const onTrackCount = rows.filter((r) => r.attendanceStatus === 'On Track').length;
  const behindCount = rows.filter((r) => r.attendanceStatus === 'Behind' || (r.pendingQuestions > 0)).length;
  const extendedCount = rows.filter((r) => r.extendedDays > 0 || r.extensionCount > 0).length;
  const totalBacklogCount = rows.reduce((sum, r) => sum + (r.pendingQuestions || 0), 0);
  const avgItDays = totalTrainers > 0 ? Math.round((rows.reduce((a, b) => a + (b.itDaysCount || 0), 0) / totalTrainers) * 10) / 10 : 0;
  const avgItCompletion = totalTrainers > 0 ? Math.round(rows.reduce((a, b) => a + (b.completionPct || 0), 0) / totalTrainers) : 0;
  const officeCheckInsCount = rows.filter((r) => {
    const t = (r.locationType || '').toLowerCase();
    const d = (r.locationDisplay || '').toLowerCase();
    return t.includes('office') || t.includes('coimbatore') || t.includes('chennai') || t.includes('hyderabad') || t.includes('vijayawada') ||
           d.includes('office') || d.includes('coimbatore') || d.includes('chennai') || d.includes('hyderabad') || d.includes('vijayawada');
  }).length;
  const wfhCheckInsCount = rows.filter((r) => {
    const t = (r.locationType || '').toLowerCase();
    const d = (r.locationDisplay || '').toLowerCase();
    return t.includes('wfh') || t.includes('home') || t.includes('remote') ||
           d.includes('wfh') || d.includes('home') || d.includes('remote');
  }).length;

  return jsonResponse({
    reportType: 'it-attendance',
    rows,
    kpis: {
      totalTrainers,
      completedCount,
      onTrackCount,
      behindCount,
      extendedCount,
      totalBacklogCount,
      avgItDays,
      avgItCompletion,
      officeCheckInsCount,
      wfhCheckInsCount,
    },
    meta: {
      availableRoadmaps: itRoadmaps.map((r: any) => ({ id: r.id, title: r.title })),
      availableTeams: Array.from(new Set(allUsers.map((u) => u.team).filter((t) => t && t !== 'N/A'))),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEAMS & COHORT BENCHMARKS REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleTeamsReport(
  dbAdmin: any,
  allUsers: any[],
  filters: { startDate?: string | null; endDate?: string | null; teamFilter?: string | null; searchFilter: string }
) {
  const { data: roadmapProgressRes } = await dbAdmin.from('user_roadmap_progress').select('user_id, status');
  const roadmapProgressList = roadmapProgressRes || [];

  // 1. Resolve canonical user scores and solve counts (using RPC or paginated deduplication)
  const userStatsMap = new Map<string, { score: number; solved: number }>();

  if (!filters.startDate && !filters.endDate) {
    try {
      const { data: leaderboardData, error: lbErr } = await dbAdmin.rpc('get_global_leaderboard');
      if (!lbErr && leaderboardData && Array.isArray(leaderboardData)) {
        leaderboardData.forEach((row: any) => {
          userStatsMap.set(row.user_id, {
            score: Number(row.score || 0),
            solved: Number(row.solved || 0),
          });
        });
      }
    } catch (rpcErr) {
      console.warn('[handleTeamsReport] get_global_leaderboard RPC error, falling back to paginated progress:', rpcErr);
    }
  }

  // 2. Fallback or date-filtered paginated query (handles >1,000 rows without cutoff)
  if (userStatsMap.size === 0) {
    let progressList: any[] = [];
    let pFrom = 0;
    const pStep = 1000;
    while (true) {
      let q = dbAdmin
        .from('progress')
        .select('user_id, question_id, score, max_score, status, last_submission_at')
        .order('id', { ascending: true })
        .range(pFrom, pFrom + pStep - 1);

      if (filters.startDate) q = q.gte('last_submission_at', filters.startDate);
      if (filters.endDate) q = q.lte('last_submission_at', filters.endDate);

      const { data: pPage, error: pErr } = await q;
      if (pErr || !pPage || pPage.length === 0) break;
      progressList = progressList.concat(pPage);
      if (pPage.length < pStep) break;
      pFrom += pStep;
    }

    // Deduplicate by (user_id, question_id) taking MAX score
    const userQuestionMap = new Map<string, Map<string, { maxScore: number; isSolved: boolean }>>();
    progressList.forEach((p: any) => {
      if (!userQuestionMap.has(p.user_id)) userQuestionMap.set(p.user_id, new Map());
      const qMap = userQuestionMap.get(p.user_id)!;
      const existing = qMap.get(p.question_id);
      const score = Number(p.score || 0);
      const solved = isQuestionSolved(p);

      if (!existing) {
        qMap.set(p.question_id, { maxScore: score, isSolved: solved });
      } else {
        qMap.set(p.question_id, {
          maxScore: Math.max(existing.maxScore, score),
          isSolved: existing.isSolved || solved,
        });
      }
    });

    userQuestionMap.forEach((qMap, uid) => {
      let totScore = 0;
      let totSolved = 0;
      qMap.forEach((val) => {
        totScore += val.maxScore;
        if (val.isSolved) totSolved++;
      });
      userStatsMap.set(uid, { score: totScore, solved: totSolved });
    });
  }

  // Group users by team
  const teamsMap = new Map<string, any[]>();
  allUsers.forEach((u) => {
    if (u.role === 'admin') return;
    const teamName = u.team && u.team.trim() !== '' && u.team !== 'N/A' ? u.team : 'Unassigned';
    if (!teamsMap.has(teamName)) teamsMap.set(teamName, []);
    teamsMap.get(teamName)!.push(u);
  });

  const teamRows: any[] = [];

  teamsMap.forEach((members, teamName) => {
    const totalMembers = members.length;

    let activeCount = 0;
    let totalScore = 0;
    let totalSolved = 0;
    let masterTrainersCount = 0;
    let topTrainer = { name: '—', score: 0, solved: 0 };
    
    let membersWithRoadmapCompleted = 0;
    let membersWithItDays = 0;
    
    const memberScores: number[] = [];

    members.forEach((m) => {
      const stats = userStatsMap.get(m.id) || { score: 0, solved: 0 };
      const userScore = stats.score;
      const userSolved = stats.solved;

      const userRoadmapsCompleted = roadmapProgressList.filter((rp: any) => rp.user_id === m.id && rp.status === 'completed').length;

      if (userScore > 0 || userSolved > 0 || (m.it_days_count || 0) > 0) {
        activeCount++;
      }

      if (userScore >= 500 || userRoadmapsCompleted >= 2) {
        masterTrainersCount++;
      }

      totalScore += userScore;
      totalSolved += userSolved;
      
      memberScores.push(userScore);
      
      if (userRoadmapsCompleted > 0) membersWithRoadmapCompleted++;
      if ((m.it_days_count || 0) > 0) membersWithItDays++;

      // 3-tier tie-breaking: score DESC, solved DESC, full_name ASC
      const isBetter =
        userScore > topTrainer.score ||
        (userScore === topTrainer.score && userScore > 0 && userSolved > topTrainer.solved) ||
        (userScore === topTrainer.score && userScore > 0 && userSolved === topTrainer.solved && m.full_name.localeCompare(topTrainer.name) < 0);

      if (isBetter) {
        topTrainer = { name: m.full_name, score: userScore, solved: userSolved };
      }
    });

    const participationRate = totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0;
    const avgScore = totalMembers > 0 ? Math.round(totalScore / totalMembers) : 0;
    const avgSolved = totalMembers > 0 ? Math.round(totalSolved / totalMembers) : 0;
    
    const completionRate = totalMembers > 0 ? Math.round((membersWithRoadmapCompleted / totalMembers) * 100) : 0;
    const itEngagementPct = totalMembers > 0 ? Math.round((membersWithItDays / totalMembers) * 100) : 0;

    memberScores.sort((a, b) => a - b);
    let min = 0, median = 0, max = 0;
    if (memberScores.length > 0) {
      min = memberScores[0];
      max = memberScores[memberScores.length - 1];
      const mid = Math.floor(memberScores.length / 2);
      median = memberScores.length % 2 !== 0 ? memberScores[mid] : (memberScores[mid - 1] + memberScores[mid]) / 2;
    }

    teamRows.push({
      teamName,
      totalMembers,
      activeMembers: activeCount,
      participationRate,
      totalScore,
      avgScore,
      totalSolved,
      avgSolved,
      masterTrainersCount,
      topTrainerName: topTrainer.name,
      topTrainerScore: topTrainer.score,
      completionRate,
      itEngagementPct,
      scoreDistribution: { min, median, max }
    });
  });

  // Sort by average score desc
  teamRows.sort((a, b) => b.avgScore - a.avgScore || b.participationRate - a.participationRate);
  teamRows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  let filteredRows = teamRows;
  if (filters.teamFilter && filters.teamFilter !== 'all') {
    filteredRows = filteredRows.filter((r) => r.teamName === filters.teamFilter);
  }
  if (filters.searchFilter) {
    filteredRows = filteredRows.filter((r) =>
      r.teamName.toLowerCase().includes(filters.searchFilter) ||
      r.topTrainerName.toLowerCase().includes(filters.searchFilter)
    );
  }

  const totalTeams = filteredRows.length;
  const orgTotalMembers = filteredRows.reduce((a, b) => a + b.totalMembers, 0);
  const orgActiveMembers = filteredRows.reduce((a, b) => a + b.activeMembers, 0);
  const orgParticipationRate = orgTotalMembers > 0 ? Math.round((orgActiveMembers / orgTotalMembers) * 100) : 0;
  const topTeamName = filteredRows.length > 0 ? filteredRows[0].teamName : '—';

  return jsonResponse({
    reportType: 'teams',
    rows: filteredRows,
    kpis: {
      totalTeams,
      orgTotalMembers,
      orgActiveMembers,
      orgParticipationRate,
      topTeamName,
    },
    meta: {
      availableTeams: Array.from(teamsMap.keys()),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOPIC ROADMAPS & SKILLS MASTERY REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleRoadmapsReport(
  dbAdmin: any,
  allUsers: any[],
  userMap: Map<string, any>,
  filters: { startDate?: string | null; endDate?: string | null; teamFilter?: string | null; roadmapFilter?: string | null; searchFilter: string }
) {
  const [roadmapsRes, userProgressRes, assignmentsRes, groupMembersRes, progressRes, contestAssignmentsRes] = await Promise.all([
    dbAdmin.from('roadmaps').select('*').order('created_at', { ascending: false }),
    dbAdmin.from('user_roadmap_progress').select('*'),
    dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id'),
    dbAdmin.from('group_members').select('group_id, user_id'),
    dbAdmin.from('progress').select('user_id, question_id, status, score, max_score'),
    dbAdmin.from('contest_assignments').select('contest_id, group_id, team'),
  ]);

  const roadmaps = roadmapsRes.data || [];
  const userProgressList = userProgressRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const progressList = progressRes.data || [];
  const contestAssignments = contestAssignmentsRes.data || [];

  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  const targetRoadmaps = filters.roadmapFilter && filters.roadmapFilter !== 'all'
    ? roadmaps.filter((r: any) => r.id === filters.roadmapFilter)
    : roadmaps;

  const rows: any[] = [];
  const now = new Date().getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  targetRoadmaps.forEach((rm: any) => {
    const topics = rm.topics || [];
    const rmQIds = extractRoadmapQuestionIds(topics);
    
    // Assigned users (direct roadmap assignments, group memberships, contest linkages, or existing progress)
    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.roadmap_id === rm.id) {
        if (a.user_id) assignedUserIds.add(a.user_id);
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    if (rm.contest_id) {
      contestAssignments.forEach((ca: any) => {
        if (ca.contest_id === rm.contest_id) {
          if (ca.group_id && groupMembersMap.has(ca.group_id)) {
            (groupMembersMap.get(ca.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
          }
          if (ca.team) {
            allUsers.filter((u) => u.team === ca.team).forEach((u) => assignedUserIds.add(u.id));
          }
        }
      });
    }
    
    userProgressList.forEach((p: any) => {
      if (p.roadmap_id === rm.id) assignedUserIds.add(p.user_id);
    });

    assignedUserIds.forEach((uid) => {
      const u = userMap.get(uid);
      if (!u || u.role === 'admin') return;

      const p = userProgressList.find((up: any) => up.user_id === uid && up.roadmap_id === rm.id);

      const baseCompletedIds = new Set(p?.completed_topic_ids || []);
      const userSolvedQIds = new Set(
        progressList
          .filter((pr: any) => pr.user_id === uid && rmQIds.includes(String(pr.question_id)) && isQuestionSolved(pr))
          .map((pr: any) => String(pr.question_id))
      );
      const questionsSolved = userSolvedQIds.size;

      // Evaluate topic completion
      let completedCount = 0;
      topics.forEach((t: any) => {
        let isTopicSolved = false;

        if (t.questions && Array.isArray(t.questions) && t.questions.length > 0) {
          const allQsSolved = t.questions.every((q: any) => {
            const qId = q.question_id || q.id;
            return userSolvedQIds.has(qId) || userSolvedQIds.has(q.id) || baseCompletedIds.has(q.id) || baseCompletedIds.has(qId);
          });
          if (allQsSolved) isTopicSolved = true;
        } else {
          const qId = t.question_id || t.id;
          if (userSolvedQIds.has(qId) || userSolvedQIds.has(t.id)) {
            isTopicSolved = true;
          }
        }

        if (!isTopicSolved && (baseCompletedIds.has(t.id) || (t.question_id && baseCompletedIds.has(t.question_id)))) {
          isTopicSolved = true;
        }

        if (isTopicSolved) completedCount++;
      });

      const totalTopics = topics.length;
      const completionPct = totalTopics > 0
        ? Math.min(100, Math.round((completedCount / totalTopics) * 100))
        : (rmQIds.length > 0 ? Math.min(100, Math.round((questionsSolved / rmQIds.length) * 100)) : 0);

      let status = 'not_started';
      if (completionPct >= 100) {
        status = 'completed';
      } else if (completionPct > 0 || completedCount > 0 || questionsSolved > 0) {
        status = 'in_progress';
      } else {
        status = 'not_started';
      }

      const startedAtMs = p?.started_at ? new Date(p.started_at).getTime() : null;
      const daysSinceStarted = (startedAtMs && now >= startedAtMs) ? Math.floor((now - startedAtMs) / dayMs) : null;
      const estimatedCompletionDays = (status === 'in_progress' && completionPct > 0 && completionPct < 100 && daysSinceStarted !== null && daysSinceStarted > 0)
        ? Math.max(1, Math.round(daysSinceStarted / (completionPct / 100)))
        : null;

      const startedAt = (status !== 'not_started' && p?.started_at) ? p.started_at : null;
      const completedAt = (status === 'completed' && p?.completed_at) ? p.completed_at : null;

      rows.push({
        roadmapId: rm.id,
        roadmapTitle: rm.title,
        domain: rm.domain || 'General',
        level: rm.level || 'Beginner',
        estimatedHours: rm.estimated_hours || 20,
        userId: u.id,
        trainerName: u.full_name,
        empId: u.emp_id || '—',
        email: u.email,
        team: u.team || 'N/A',
        manager: u.manager || '—',
        completedTopicsCount: completedCount,
        totalTopics,
        completionPct,
        questionsSolved,
        daysSinceStarted,
        estimatedCompletionDays,
        status,
        startedAt,
        completedAt,
        updatedAt: p?.updated_at || null,
      });
    });
  });

  let filteredRows = rows;
  if (filters.teamFilter && filters.teamFilter !== 'all') {
    filteredRows = filteredRows.filter((r) => r.team === filters.teamFilter);
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filteredRows = filteredRows.filter((r) => r.updatedAt && new Date(r.updatedAt).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    filteredRows = filteredRows.filter((r) => r.updatedAt && new Date(r.updatedAt).getTime() <= end);
  }
  if (filters.searchFilter) {
    filteredRows = filteredRows.filter((r) =>
      r.trainerName.toLowerCase().includes(filters.searchFilter) ||
      r.empId.toLowerCase().includes(filters.searchFilter) ||
      r.team.toLowerCase().includes(filters.searchFilter) ||
      r.roadmapTitle.toLowerCase().includes(filters.searchFilter) ||
      r.domain.toLowerCase().includes(filters.searchFilter)
    );
  }

  const totalEnrollments = filteredRows.length;
  const completedCount = filteredRows.filter((r) => r.status === 'completed').length;
  const inProgressCount = filteredRows.filter((r) => r.status === 'in_progress').length;
  const avgCompletionPct = totalEnrollments > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.completionPct, 0) / totalEnrollments) : 0;

  return jsonResponse({
    reportType: 'roadmaps',
    rows: filteredRows,
    kpis: {
      totalRoadmaps: targetRoadmaps.length,
      totalEnrollments,
      completedCount,
      inProgressCount,
      avgCompletionPct,
    },
    meta: {
      availableRoadmaps: roadmaps.map((r: any) => ({ id: r.id, title: r.title })),
      availableTeams: Array.from(new Set(allUsers.map((u) => u.team).filter((t) => t && t !== 'N/A'))),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRAINER INACTIVITY & AT-RISK AUDIT REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleInactivityAuditReport(
  dbAdmin: any,
  allUsers: any[],
  filters: { teamFilter?: string | null; searchFilter: string }
) {
  const [progressRes, itProgressRes, todosRes] = await Promise.all([
    dbAdmin.from('progress').select('user_id, score, max_score, status, last_submission_at'),
    dbAdmin.from('it_trainer_progress').select('user_id, updated_at, current_day, extended_days'),
    dbAdmin.from('trainer_todos').select('user_id, is_completed'),
  ]);

  const progressList = progressRes.data || [];
  const itProgressList = itProgressRes.data || [];
  const todosList = todosRes.data || [];

  const now = new Date();
  const rows: any[] = [];

  allUsers.forEach((u) => {
    if (u.role === 'admin') return;

    const userProgress = progressList.filter((p: any) => p.user_id === u.id);
    const userItProgress = itProgressList.filter((p: any) => p.user_id === u.id);
    const userTodos = todosList.filter((t: any) => t.user_id === u.id);

    // Latest activity timestamp from all sources
    const timestamps: number[] = [];
    let pMax = 0, itMax = 0, uMax = 0;

    userProgress.forEach((p: any) => {
      if (p.last_submission_at) {
        const t = new Date(p.last_submission_at).getTime();
        if (!isNaN(t)) {
          timestamps.push(t);
          pMax = Math.max(pMax, t);
        }
      }
    });

    userItProgress.forEach((ip: any) => {
      if (ip.updated_at) {
        const t = new Date(ip.updated_at).getTime();
        if (!isNaN(t)) {
          timestamps.push(t);
          itMax = Math.max(itMax, t);
        }
      }
    });

    if (u.last_it_check_date) {
      const t = new Date(u.last_it_check_date).getTime();
      if (!isNaN(t)) {
        timestamps.push(t);
        uMax = t;
      }
    }

    const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;
    const latestActivityDate = maxTimestamp ? new Date(maxTimestamp) : null;

    const daysInactive = latestActivityDate
      ? Math.floor((now.getTime() - latestActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
      
    let lastActivityType = 'Unknown';
    if (maxTimestamp) {
      if (maxTimestamp === pMax) lastActivityType = 'Contest';
      else if (maxTimestamp === itMax || maxTimestamp === uMax) lastActivityType = 'IT Training';
    }

    const totalSolved = userProgress.filter(isQuestionSolved).length;
    const totalScore = userProgress.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
    const itDaysCount = u.it_days_count || 0;
    const pendingTodos = userTodos.filter((t: any) => !t.is_completed).length;

    const contestScorePart = Math.min(40, totalSolved * 2);
    const itScorePart = Math.min(30, itDaysCount * 3);
    const recencyScorePart = daysInactive <= 3 ? 30 : daysInactive <= 7 ? 20 : daysInactive <= 14 ? 10 : 0;
    const engagementScore = contestScorePart + itScorePart + recencyScorePart;
    
    let trend = 'Declining';
    if (daysInactive <= 3) trend = 'Improving';
    else if (daysInactive <= 7) trend = 'Stable';

    let riskLevel = '🟢 Active';
    let riskTier = 'active';
    let actionRecommendation = 'Regular monitoring; performing on schedule.';

    if (daysInactive >= 14 || (daysInactive >= 7 && totalSolved === 0 && itDaysCount === 0)) {
      riskLevel = '🔴 High Risk';
      riskTier = 'high';
      actionRecommendation = 'Immediate manager follow-up required. Extended inactivity.';
    } else if (daysInactive >= 7 || (daysInactive >= 3 && itDaysCount === 0)) {
      riskLevel = '🟡 Medium Risk';
      riskTier = 'medium';
      actionRecommendation = 'Send automated notification or check-in reminder.';
    }

    rows.push({
      userId: u.id,
      trainerName: u.full_name,
      empId: u.emp_id || '—',
      email: u.email,
      team: u.team || 'N/A',
      manager: u.manager || '—',
      daysInactive: daysInactive === 999 ? 'No Activity' : `${daysInactive} days`,
      daysInactiveNumber: daysInactive,
      lastActiveDate: latestActivityDate ? latestActivityDate.toISOString() : null,
      totalSolved,
      totalScore,
      itDaysCount,
      pendingTodos,
      engagementScore,
      lastActivityType,
      trend,
      riskLevel,
      riskTier,
      actionRecommendation,
    });
  });

  // Sort by risk tier (high first, then medium, then active)
  rows.sort((a, b) => b.daysInactiveNumber - a.daysInactiveNumber || a.trainerName.localeCompare(b.trainerName));

  let filteredRows = rows;
  if (filters.teamFilter && filters.teamFilter !== 'all') {
    filteredRows = filteredRows.filter((r) => r.team === filters.teamFilter);
  }
  if (filters.searchFilter) {
    filteredRows = filteredRows.filter((r) =>
      r.trainerName.toLowerCase().includes(filters.searchFilter) ||
      r.empId.toLowerCase().includes(filters.searchFilter) ||
      r.team.toLowerCase().includes(filters.searchFilter) ||
      r.riskLevel.toLowerCase().includes(filters.searchFilter)
    );
  }

  const highRiskCount = filteredRows.filter((r) => r.riskTier === 'high').length;
  const mediumRiskCount = filteredRows.filter((r) => r.riskTier === 'medium').length;
  const activeCount = filteredRows.filter((r) => r.riskTier === 'active').length;
  const totalAudited = filteredRows.length;
  const avgEngagementScore = totalAudited > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.engagementScore, 0) / totalAudited) : 0;

  return jsonResponse({
    reportType: 'inactivity-audit',
    rows: filteredRows,
    kpis: {
      totalAudited,
      highRiskCount,
      mediumRiskCount,
      activeCount,
      avgEngagementScore,
      atRiskPercentage: totalAudited > 0 ? Math.round(((highRiskCount + mediumRiskCount) / totalAudited) * 100) : 0,
    },
    meta: {
      availableTeams: Array.from(new Set(allUsers.map((u) => u.team).filter((t) => t && t !== 'N/A'))),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PERSONAL TRANSCRIPT REPORT (FOR TRAINERS)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePersonalTranscript(userId: string, profile: any, dbAdmin: any) {
  const [
    progressRes,
    contestsRes,
    questionsRes,
    roadmapsRes,
    userRoadmapRes,
    itProgressRes,
    coursesRes,
    todosRes,
  ] = await Promise.all([
    dbAdmin.from('progress').select('*').eq('user_id', userId),
    dbAdmin.from('contests').select('*'),
    dbAdmin.from('questions').select('*'),
    dbAdmin.from('roadmaps').select('*'),
    dbAdmin.from('user_roadmap_progress').select('*').eq('user_id', userId),
    dbAdmin.from('it_trainer_progress').select('*').eq('user_id', userId),
    dbAdmin.from('course_assignments').select('*, course:courses(*)').eq('user_id', userId),
    dbAdmin.from('trainer_todos').select('*').eq('user_id', userId),
  ]);

  const progress = progressRes.data || [];
  const contests = contestsRes.data || [];
  const questions = questionsRes.data || [];
  const roadmaps = roadmapsRes.data || [];
  const userRoadmaps = userRoadmapRes.data || [];
  const itProgress = itProgressRes.data || [];
  const courses = coursesRes.data || [];
  const todos = todosRes.data || [];

  // Contest breakdown
  const contestBreakdown = contests.map((c: any) => {
    const cQs = questions.filter((q: any) => q.contest_id === c.id);
    const userQs = progress.filter((p: any) => p.contest_id === c.id);
    const solved = userQs.filter(isQuestionSolved).length;
    const score = userQs.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
    const maxScore = cQs.reduce((acc: number, q: any) => acc + (q.max_score || 10), 0);

    return {
      contestId: c.id,
      title: c.title,
      hackerrankSlug: c.hackerrank_slug,
      solvedCount: solved,
      totalQuestions: cQs.length,
      completionPct: cQs.length > 0 ? Math.round((solved / cQs.length) * 100) : 0,
      score,
      maxScore,
    };
  }).filter((c: any) => c.score > 0 || c.solvedCount > 0);

  // Roadmap breakdown
  const roadmapBreakdown = roadmaps.map((r: any) => {
    const rp = userRoadmaps.find((up: any) => up.roadmap_id === r.id);
    const completedTopics = (rp?.completed_topic_ids || []).length;
    const totalTopics = (r.topics || []).length;

    return {
      roadmapId: r.id,
      title: r.title,
      domain: r.domain,
      level: r.level,
      completedTopics,
      totalTopics,
      completionPct: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
      status: rp?.status || 'not_started',
    };
  });

  const totalScore = progress.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
  const totalSolved = progress.filter(isQuestionSolved).length;
  const itDays = profile.it_days_count || 0;
  const completedRoadmaps = roadmapBreakdown.filter((r: any) => r.status === 'completed').length;
  const completedTodos = todos.filter((t: any) => t.is_completed).length;

  return jsonResponse({
    reportType: 'personal-transcript',
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      empId: profile.emp_id,
      email: profile.email,
      team: profile.team,
      manager: profile.manager,
      hackerrankId: profile.hackerrank_id,
      itDaysCount: itDays,
      lastItCheckDate: profile.last_it_check_date,
    },
    summary: {
      totalScore,
      totalSolved,
      itDaysCount: itDays,
      contestsMastered: contestBreakdown.filter((c: any) => c.completionPct >= 100).length,
      roadmapsCompleted: completedRoadmaps,
      todosCompleted: completedTodos,
      totalTodos: todos.length,
    },
    contests: contestBreakdown,
    roadmaps: roadmapBreakdown,
    courses: courses.map((ca: any) => ({
      courseId: ca.course?.id,
      title: ca.course?.title,
      category: ca.course?.category,
      level: ca.course?.level,
      dueDate: ca.due_date,
    })),
  });
}
