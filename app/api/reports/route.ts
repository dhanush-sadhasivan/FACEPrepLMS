import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
  // Fetch contests, assignments, group members, questions, progress
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

  // Fetch progress
  let allProgress: any[] = [];
  let pFrom = 0;
  const pStep = 1000;
  while (true) {
    const { data: pageRows } = await dbAdmin
      .from('progress')
      .select('contest_id, user_id, question_id, status, score, max_score, last_submission_at')
      .order('id', { ascending: true })
      .range(pFrom, pFrom + pStep - 1);
    if (!pageRows || pageRows.length === 0) break;
    allProgress = allProgress.concat(pageRows);
    if (pageRows.length < pStep) break;
    pFrom += pStep;
  }

  // Filter contests by ID if requested
  const targetContests = filters.contestFilter && filters.contestFilter !== 'all'
    ? contests.filter((c: any) => c.id === filters.contestFilter)
    : contests;

  const rows: any[] = [];

  targetContests.forEach((contest: any) => {
    const contestQs = questions.filter((q: any) => q.contest_id === contest.id);
    const totalQs = contestQs.length;
    const maxContestScore = contestQs.reduce((acc: number, q: any) => acc + (q.max_score || 10), 0);

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

    // If no direct assignments exist, check all users who have progress in this contest
    if (assignedUserIds.size === 0) {
      allProgress.forEach((p) => {
        if (p.contest_id === contest.id && p.user_id) assignedUserIds.add(p.user_id);
      });
    }

    // Build user stats
    const contestUserRows: any[] = [];

    assignedUserIds.forEach((userId) => {
      const u = userMap.get(userId);
      if (!u || u.role === 'admin') return;

      const userProgress = allProgress.filter((p) => p.contest_id === contest.id && p.user_id === userId);
      const solvedQs = userProgress.filter((p) => p.status === 'solved' || p.score > 0);
      const solvedCount = solvedQs.length;
      const totalUserScore = userProgress.reduce((acc, p) => acc + (p.score || 0), 0);
      const completionPct = totalQs > 0 ? Math.round((solvedCount / totalQs) * 100) : 0;

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
        score: totalUserScore,
        maxPossibleScore: maxContestScore,
        status,
        lastSubmissionAt: latestSubDate,
      });
    });

    // Sort to assign ranks
    contestUserRows.sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount || a.trainerName.localeCompare(b.trainerName));
    contestUserRows.forEach((r, idx) => {
      r.rank = idx + 1;
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
    filteredRows = filteredRows.filter((r) => !r.lastSubmissionAt || new Date(r.lastSubmissionAt).getTime() >= start);
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    filteredRows = filteredRows.filter((r) => !r.lastSubmissionAt || new Date(r.lastSubmissionAt).getTime() <= end);
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

  return NextResponse.json({
    reportType: 'contests',
    rows: filteredRows,
    kpis: {
      totalContests: targetContests.length,
      totalEnrolledTrainers: totalEnrolled,
      masteredCount,
      avgScore,
      avgCompletionPct,
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
    return NextResponse.json({ reportType: 'it-attendance', rows: [], kpis: {}, meta: {} });
  }

  const roadmapIds = itRoadmaps.map((r: any) => r.id);
  const targetRoadmaps = filters.roadmapFilter && filters.roadmapFilter !== 'all'
    ? itRoadmaps.filter((r: any) => r.id === filters.roadmapFilter)
    : itRoadmaps;

  const [
    dayPlansRes,
    assignmentsRes,
    groupMembersRes,
    progressRes,
    questionsRes,
  ] = await Promise.all([
    dbAdmin.from('it_day_plans').select('id, roadmap_id, day_number, topic_title').in('roadmap_id', roadmapIds),
    dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id').in('roadmap_id', roadmapIds),
    dbAdmin.from('group_members').select('group_id, user_id'),
    dbAdmin.from('it_trainer_progress').select('*').in('roadmap_id', roadmapIds),
    dbAdmin.from('it_day_questions').select('id, day_plan_id, question_id'),
  ]);

  const dayPlans = dayPlansRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];
  const progressList = progressRes.data || [];
  const questions = questionsRes.data || [];

  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  // Fetch completions
  let completions: any[] = [];
  let cFrom = 0;
  const cStep = 1000;
  while (true) {
    const { data: cPage } = await dbAdmin
      .from('it_question_completions')
      .select('user_id, day_question_id, clicked_at, is_completed, completed_at')
      .order('id', { ascending: true })
      .range(cFrom, cFrom + cStep - 1);
    if (!cPage || cPage.length === 0) break;
    completions = completions.concat(cPage);
    if (cPage.length < cStep) break;
    cFrom += cStep;
  }

  // Build completions map: user_id:day_question_id
  const completionMap = new Map<string, any>();
  completions.forEach((c: any) => {
    completionMap.set(`${c.user_id}:${c.day_question_id}`, c);
  });

  // Map progress: user_id:roadmap_id
  const progressMap = new Map<string, any>();
  progressList.forEach((p: any) => {
    progressMap.set(`${p.user_id}:${p.roadmap_id}`, p);
  });

  const rows: any[] = [];

  targetRoadmaps.forEach((rm: any) => {
    const rmDayPlans = dayPlans.filter((dp: any) => dp.roadmap_id === rm.id);
    const totalDays = rmDayPlans.length;

    // Roadmap questions
    const rmPlanIds = rmDayPlans.map((dp: any) => dp.id);
    const rmQuestions = questions.filter((q: any) => rmPlanIds.includes(q.day_plan_id));
    const totalQuestions = rmQuestions.length;

    // Assigned users
    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.roadmap_id === rm.id) {
        if (a.user_id) assignedUserIds.add(a.user_id);
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    if (assignedUserIds.size === 0) {
      progressList.forEach((p: any) => {
        if (p.roadmap_id === rm.id && p.user_id) assignedUserIds.add(p.user_id);
      });
    }

    assignedUserIds.forEach((uid) => {
      const u = userMap.get(uid);
      if (!u || u.role === 'admin') return;

      const p = progressMap.get(`${uid}:${rm.id}`);
      const itDaysCount = p?.it_days_logged || u.it_days_count || 0;
      const currentDay = Math.min(itDaysCount, totalDays || 1);
      const extendedDays = p?.extended_days || 0;
      const extensionCount = p?.extension_count || 0;
      const startedAt = p?.started_at || null;
      const lastCheckInDate = p?.last_check_in_date || u.last_it_check_date || null;

      let completedQsCount = 0;
      let clickedQsCount = 0;
      rmQuestions.forEach((q: any) => {
        const comp = completionMap.get(`${uid}:${q.id}`);
        if (comp?.clicked_at) clickedQsCount++;
        if (comp?.is_completed || comp?.completed_at) completedQsCount++;
      });

      const pendingQsCount = Math.max(0, totalQuestions - completedQsCount);
      const completionPct = totalQuestions > 0 ? Math.round((completedQsCount / totalQuestions) * 100) : 0;

      let attendanceStatus = 'On Track';
      if (extendedDays > 0 || extensionCount > 0) attendanceStatus = 'Extended';
      else if (itDaysCount === 0) attendanceStatus = 'Not Started';
      else if (pendingQsCount > 5) attendanceStatus = 'Lagging';

      rows.push({
        roadmapId: rm.id,
        roadmapTitle: rm.title,
        domain: rm.domain || 'Internal Training',
        userId: u.id,
        trainerName: u.full_name,
        empId: u.emp_id || '—',
        email: u.email,
        team: u.team || 'N/A',
        manager: u.manager || '—',
        itDaysCount,
        totalDays,
        currentDay,
        startedAt,
        lastCheckInDate,
        questionsClicked: clickedQsCount,
        questionsCompleted: completedQsCount,
        totalQuestions,
        pendingQuestions: pendingQsCount,
        completionPct,
        extendedDays,
        extensionCount,
        attendanceStatus,
      });
    });
  });

  // Apply filters
  let filteredRows = rows;
  if (filters.teamFilter && filters.teamFilter !== 'all') {
    filteredRows = filteredRows.filter((r) => r.team === filters.teamFilter);
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filteredRows = filteredRows.filter((r) => !r.lastCheckInDate || new Date(r.lastCheckInDate).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    filteredRows = filteredRows.filter((r) => !r.lastCheckInDate || new Date(r.lastCheckInDate).getTime() <= end);
  }
  if (filters.searchFilter) {
    filteredRows = filteredRows.filter((r) =>
      r.trainerName.toLowerCase().includes(filters.searchFilter) ||
      r.empId.toLowerCase().includes(filters.searchFilter) ||
      r.team.toLowerCase().includes(filters.searchFilter) ||
      r.roadmapTitle.toLowerCase().includes(filters.searchFilter)
    );
  }

  // Summary KPIs
  const totalTrainers = filteredRows.length;
  const onTrackCount = filteredRows.filter((r) => r.attendanceStatus === 'On Track').length;
  const laggingCount = filteredRows.filter((r) => r.attendanceStatus === 'Lagging').length;
  const extendedCount = filteredRows.filter((r) => r.attendanceStatus === 'Extended').length;
  const avgItDays = totalTrainers > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.itDaysCount, 0) / totalTrainers) : 0;
  const avgItCompletion = totalTrainers > 0 ? Math.round(filteredRows.reduce((a, b) => a + b.completionPct, 0) / totalTrainers) : 0;

  return NextResponse.json({
    reportType: 'it-attendance',
    rows: filteredRows,
    kpis: {
      totalTrainers,
      onTrackCount,
      laggingCount,
      extendedCount,
      avgItDays,
      avgItCompletion,
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
  // Fetch contests, progress, user roadmap progress
  const [progressRes, roadmapProgressRes] = await Promise.all([
    dbAdmin.from('progress').select('user_id, question_id, score, status'),
    dbAdmin.from('user_roadmap_progress').select('user_id, status'),
  ]);

  const progressList = progressRes.data || [];
  const roadmapProgressList = roadmapProgressRes.data || [];

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
    let topTrainer = { name: '—', score: 0 };

    members.forEach((m) => {
      const userProgress = progressList.filter((p: any) => p.user_id === m.id);
      const userScore = userProgress.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
      const userSolved = userProgress.filter((p: any) => p.status === 'solved' || p.score > 0).length;

      const userRoadmapsCompleted = roadmapProgressList.filter((rp: any) => rp.user_id === m.id && rp.status === 'completed').length;

      if (userScore > 0 || userSolved > 0 || (m.it_days_count || 0) > 0) {
        activeCount++;
      }

      if (userScore > 500 || userRoadmapsCompleted >= 2) {
        masterTrainersCount++;
      }

      totalScore += userScore;
      totalSolved += userSolved;

      if (userScore > topTrainer.score) {
        topTrainer = { name: m.full_name, score: userScore };
      }
    });

    const participationRate = totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0;
    const avgScore = totalMembers > 0 ? Math.round(totalScore / totalMembers) : 0;
    const avgSolved = totalMembers > 0 ? Math.round(totalSolved / totalMembers) : 0;

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

  return NextResponse.json({
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
      availableTeams: Array.from(teamsMap.keys()).filter((t) => t !== 'Unassigned'),
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
  const [roadmapsRes, userProgressRes, assignmentsRes, groupMembersRes] = await Promise.all([
    dbAdmin.from('roadmaps').select('*').order('created_at', { ascending: false }),
    dbAdmin.from('user_roadmap_progress').select('*'),
    dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id'),
    dbAdmin.from('group_members').select('group_id, user_id'),
  ]);

  const roadmaps = roadmapsRes.data || [];
  const userProgressList = userProgressRes.data || [];
  const assignments = assignmentsRes.data || [];
  const groupMembers = groupMembersRes.data || [];

  const groupMembersMap = new Map<string, string[]>();
  groupMembers.forEach((gm: any) => {
    if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
    groupMembersMap.get(gm.group_id)!.push(gm.user_id);
  });

  const targetRoadmaps = filters.roadmapFilter && filters.roadmapFilter !== 'all'
    ? roadmaps.filter((r: any) => r.id === filters.roadmapFilter)
    : roadmaps;

  const rows: any[] = [];

  targetRoadmaps.forEach((rm: any) => {
    const topics = rm.topics || [];
    const totalTopics = topics.length;

    // Assigned users
    const assignedUserIds = new Set<string>();
    assignments.forEach((a: any) => {
      if (a.roadmap_id === rm.id) {
        if (a.user_id) assignedUserIds.add(a.user_id);
        if (a.group_id) {
          (groupMembersMap.get(a.group_id) || []).forEach((uid) => assignedUserIds.add(uid));
        }
      }
    });

    if (assignedUserIds.size === 0) {
      allUsers.forEach((u) => {
        if (u.role !== 'admin') assignedUserIds.add(u.id);
      });
    }

    assignedUserIds.forEach((uid) => {
      const u = userMap.get(uid);
      if (!u || u.role === 'admin') return;

      const p = userProgressList.find((up: any) => up.user_id === uid && up.roadmap_id === rm.id);
      const completedTopicIds: string[] = p?.completed_topic_ids || [];
      const completedCount = completedTopicIds.length;
      const completionPct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

      let status = p?.status || 'not_started';
      if (completionPct >= 100) status = 'completed';
      else if (completedCount > 0) status = 'in_progress';

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
        status,
        startedAt: p?.started_at || null,
        completedAt: p?.completed_at || null,
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
    filteredRows = filteredRows.filter((r) => !r.updatedAt || new Date(r.updatedAt).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    filteredRows = filteredRows.filter((r) => !r.updatedAt || new Date(r.updatedAt).getTime() <= end);
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

  return NextResponse.json({
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
    dbAdmin.from('progress').select('user_id, score, status, last_submission_at'),
    dbAdmin.from('it_trainer_progress').select('user_id, last_check_in_date, it_days_logged, extended_days'),
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

    userProgress.forEach((p: any) => {
      if (p.last_submission_at) {
        const t = new Date(p.last_submission_at).getTime();
        if (!isNaN(t)) timestamps.push(t);
      }
    });

    userItProgress.forEach((ip: any) => {
      if (ip.last_check_in_date) {
        const t = new Date(ip.last_check_in_date).getTime();
        if (!isNaN(t)) timestamps.push(t);
      }
    });

    if (u.last_it_check_date) {
      const t = new Date(u.last_it_check_date).getTime();
      if (!isNaN(t)) timestamps.push(t);
    }

    const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;
    const latestActivityDate = maxTimestamp ? new Date(maxTimestamp) : null;

    const daysInactive = latestActivityDate
      ? Math.floor((now.getTime() - latestActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const totalSolved = userProgress.filter((p: any) => p.status === 'solved' || p.score > 0).length;
    const totalScore = userProgress.reduce((acc: number, p: any) => acc + (p.score || 0), 0);
    const itDaysCount = u.it_days_count || 0;
    const pendingTodos = userTodos.filter((t: any) => !t.is_completed).length;

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

  return NextResponse.json({
    reportType: 'inactivity-audit',
    rows: filteredRows,
    kpis: {
      totalAudited,
      highRiskCount,
      mediumRiskCount,
      activeCount,
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
    const solved = userQs.filter((p: any) => p.status === 'solved' || p.score > 0).length;
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
  const totalSolved = progress.filter((p: any) => p.status === 'solved' || p.score > 0).length;
  const itDays = profile.it_days_count || 0;
  const completedRoadmaps = roadmapBreakdown.filter((r: any) => r.status === 'completed').length;
  const completedTodos = todos.filter((t: any) => t.is_completed).length;

  return NextResponse.json({
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
