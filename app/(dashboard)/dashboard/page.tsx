import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PendingRequestsWidget from './PendingRequestsWidget';
import TrainerTodoWidget from './TrainerTodoWidget';
import TopicRoadmapsWidget from './TopicRoadmapsWidget';
import AssignedCoursesWidget from './AssignedCoursesWidget';
import TopPerformersWidget from './TopPerformersWidget';
import HelpdeskWidget from './HelpdeskWidget';
import TrainerCompletionAnalytics, { ContestCompletionStat, RoadmapCompletionStat } from './TrainerCompletionAnalytics';
import TrainerAnnouncementsBanner from './TrainerAnnouncementsBanner';
import { getCachedGlobalLeaderboard, GlobalPerformer } from '@/lib/cdn-cache';
import './page.css';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Next.js ISR cache

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [userRes, contestsHeadRes, userNotificationsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('contests').select('*', { count: 'exact', head: true }),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const userData = userRes.data;
  const contestsCount = contestsHeadRes.count || 0;
  const rawUserNotifications = userNotificationsRes.data || [];

  // ── Attach Sender details to notifications ─────────────────────────
  const dbAdmin = getAdminClient();
  const senderIds = Array.from(new Set(rawUserNotifications.map((n: any) => n.related_id).filter(Boolean)));
  const sendersMap = new Map();
  if (senderIds.length > 0) {
    const { data: senders } = await dbAdmin.from('users').select('id, full_name, role, team').in('id', senderIds);
    (senders || []).forEach((s: any) => sendersMap.set(s.id, s));
  }

  const allUserNotifications = rawUserNotifications.map((n: any) => ({
    ...n,
    sender: n.related_id ? sendersMap.get(n.related_id) || null : null,
  }));

  // Only display UNREAD announcements on the dashboard banner
  const userAnnouncements = allUserNotifications.filter(
    (n: any) => (n.type === 'announcement' || (n.title && n.title.includes('📢'))) && !n.is_read
  );
  const userUnreadNotifsCount = allUserNotifications.filter((n: any) => !n.is_read).length;

  const role = userData?.role || 'trainer';
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const isTrainer = role === 'trainer';

  // ── Global Live Top Performers (Cached via Supabase Storage CDN) ───
  let globalPerformers: GlobalPerformer[] = [];
  const cachedData = await getCachedGlobalLeaderboard();

  if (cachedData && Array.isArray(cachedData.performers) && cachedData.performers.length > 0) {
    globalPerformers = cachedData.performers;
  } else {
    // Graceful fallback to direct DB query if cache is cold
    let allUserProfiles: any[] = [];
    let uFrom = 0;
    const uStep = 1000;
    while (true) {
      const { data: uPage } = await dbAdmin
        .from('users').select('id, full_name, emp_id, team')
        .neq('role', 'admin')
        .order('id', { ascending: true })
        .range(uFrom, uFrom + uStep - 1);
      if (!uPage || uPage.length === 0) break;
      allUserProfiles = allUserProfiles.concat(uPage);
      if (uPage.length < uStep) break;
      uFrom += uStep;
    }
    const globalUserMap = new Map();
    (allUserProfiles || []).forEach((u: any) => {
      globalUserMap.set(u.id, {
        id: u.id,
        name: u.full_name,
        emp_id: u.emp_id || '—',
        team: u.team || 'N/A',
        score: 0,
        solved: 0,
      });
    });

    let allProgressRows: any[] = [];
    let pFrom = 0;
    const pStep = 1000;
    while (true) {
      const { data: pageRows, error: pErr } = await dbAdmin
        .from('progress')
        .select('user_id, question_id, score, status, contest_id')
        .or('score.gt.0,status.eq.solved')
        .order('id', { ascending: true })
        .range(pFrom, pFrom + pStep - 1);

      if (pErr || !pageRows || pageRows.length === 0) break;
      allProgressRows = allProgressRows.concat(pageRows);
      if (pageRows.length < pStep) break;
      pFrom += pStep;
    }

    // Deduplicate by (user_id, question_id) and aggregate scores
    const userQuestionMap = new Map<string, { user_id: string; score: number; isSolved: boolean }>();
    allProgressRows.forEach((p: any) => {
      if (!p.user_id || !p.question_id) return;
      const key = `${p.user_id}:${p.question_id}`;
      const existing = userQuestionMap.get(key);
      if (!existing) {
        userQuestionMap.set(key, {
          user_id: p.user_id,
          score: p.score || 0,
          isSolved: p.status === 'solved',
        });
      } else {
        existing.score = Math.max(existing.score, p.score || 0);
        if (p.status === 'solved') existing.isSolved = true;
      }
    });

    userQuestionMap.forEach((item) => {
      const entry = globalUserMap.get(item.user_id);
      if (entry) {
        entry.score += item.score;
        if (item.isSolved) entry.solved++;
      }
    });

    globalPerformers = Array.from(globalUserMap.values())
      .sort((a: any, b: any) => (b.score - a.score) || (b.solved - a.solved));
  }

  // ── Admin / Manager Queries ─────────────────────────────────────────
  let usersCount = 0;
  let groupsCount = 0;
  let questionsCount = 0;
  let pendingRequests: any[] = [];
  let pendingRequestsCount = 0;
  let contests: any[] = [];
  let activeContestsCount = 0;
  let upcomingContestsCount = 0;

  let contestStats: ContestCompletionStat[] = [];
  let roadmapStats: RoadmapCompletionStat[] = [];
  let topTrainersWithStats: any[] = [];

  if (isAdminOrManager) {
    const [
      uq,
      gq,
      qq,
      pq,
      cq,
      allQsRes,
      allRoadmapsRes,
      allRoadmapProgressRes,
      allContestAssignRes,
      allGroupMembersRes,
      allRoadmapAssignRes,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase
        .from('access_requests')
        .select('*, users(full_name, emp_id, team), contests(title)', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('contests')
        .select('*, questions(count), assignments:contest_assignments(count)')
        .order('created_at', { ascending: false }),
      dbAdmin.from('questions').select('id, contest_id, topic, domain'),
      dbAdmin.from('roadmaps').select('id, title, domain, level, topics'),
      dbAdmin.from('user_roadmap_progress').select('user_id, roadmap_id, completed_topic_ids, status'),
      dbAdmin.from('contest_assignments').select('contest_id, group_id, team'),
      dbAdmin.from('group_members').select('group_id, user_id'),
      dbAdmin.from('roadmap_assignments').select('roadmap_id, user_id, group_id'),
    ]);

    usersCount = uq.count || 0;
    groupsCount = gq.count || 0;
    questionsCount = qq.count || 0;
    pendingRequests = pq.data || [];
    pendingRequestsCount = pq.count || 0;
    contests = cq.data || [];

    const now = new Date();
    (contests || []).forEach((c: any) => {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      if (now >= start && now <= end) activeContestsCount++;
      else if (now < start) upcomingContestsCount++;
    });

    const allContestsData = contests;
    const allQsData = allQsRes.data || [];
    const allContestAssignData = allContestAssignRes.data || [];
    const allGroupMembersData = (allGroupMembersRes as any)?.data || [];
    const totalTrainersCount = globalPerformers.length || 1;

    // Helper maps for contest assignment resolution
    const groupMembersMap = new Map<string, string[]>();
    (allContestAssignRes && (await dbAdmin.from('group_members').select('group_id, user_id'))?.data || []).forEach((gm: any) => {
      if (!groupMembersMap.has(gm.group_id)) groupMembersMap.set(gm.group_id, []);
      groupMembersMap.get(gm.group_id)!.push(gm.user_id);
    });

    const teamUsersMap = new Map<string, string[]>();
    (globalPerformers || []).forEach((u: any) => {
      if (u.team && u.team !== 'N/A') {
        if (!teamUsersMap.has(u.team)) teamUsersMap.set(u.team, []);
        teamUsersMap.get(u.team)!.push(u.id);
      }
    });

    // Fetch progress ONLY for top 5 contests to save bandwidth
    const top5Contests = allContestsData.slice(0, 5);
    const top5ContestIds = top5Contests.map((c: any) => c.id);
    let top5ProgressRows: any[] = [];
    if (top5ContestIds.length > 0) {
      const { data: pRows } = await dbAdmin
        .from('progress')
        .select('contest_id, user_id, question_id, score, status')
        .in('contest_id', top5ContestIds)
        .or('score.gt.0,status.eq.solved');
      top5ProgressRows = pRows || [];
    }

    // 1. Contest Completion Analytics
    contestStats = top5Contests.map((c: any) => {
      const cQs = allQsData.filter((q: any) => q.contest_id === c.id);
      const qCount = cQs.length || (c.questions?.[0]?.count || 0);

      const assignedUserIds = new Set<string>();
      allContestAssignData.forEach((a: any) => {
        if (a.contest_id === c.id) {
          if (a.group_id) {
            (groupMembersMap.get(a.group_id) || []).forEach((uid: string) => assignedUserIds.add(uid));
          }
          if (a.team) {
            (teamUsersMap.get(a.team) || []).forEach((uid: string) => assignedUserIds.add(uid));
          }
        }
      });
      const assignedCount = assignedUserIds.size;

      let completedTrainers = 0;
      let totalSolvedSum = 0;

      if (assignedCount > 0 && cQs.length > 0) {
        assignedUserIds.forEach((userId) => {
          const userSolvedInContest = cQs.filter((q: any) =>
            top5ProgressRows.some((p: any) => p.contest_id === c.id && p.user_id === userId && p.question_id === q.id && (p.status === 'solved' || p.score > 0))
          ).length;
          totalSolvedSum += userSolvedInContest;
          if (userSolvedInContest >= cQs.length) {
            completedTrainers++;
          }
        });
      }

      const maxPossibleSolved = (qCount || 1) * assignedCount;
      const pct = (maxPossibleSolved > 0 && assignedCount > 0) ? Math.min(100, Math.round((totalSolvedSum / maxPossibleSolved) * 100)) : 0;

      return {
        contestId: c.id,
        title: c.title,
        slug: c.hackerrank_slug,
        questionCount: qCount,
        assignedTrainersCount: assignedCount,
        completedTrainersCount: completedTrainers,
        completionPercentage: pct,
      };
    });

    // 2. Roadmap Completion Analytics
    const allRoadmapsData = allRoadmapsRes.data || [];
    const allRoadmapProgressData = allRoadmapProgressRes.data || [];
    const allRoadmapAssignData = allRoadmapAssignRes.data || [];

    roadmapStats = allRoadmapsData.slice(0, 5).map((r: any) => {
      const topicsArr = r.topics || [];
      const topicCount = topicsArr.length || 1;

      const assignedUserIds = new Set<string>();
      allRoadmapAssignData.forEach((a: any) => {
        if (a.roadmap_id === r.id && a.user_id) assignedUserIds.add(a.user_id);
      });
      const assignedCount = assignedUserIds.size > 0 ? assignedUserIds.size : totalTrainersCount;

      let completedTrainers = 0;
      let totalTopicsDoneSum = 0;

      globalPerformers.forEach((userPerf) => {
        const rp = allRoadmapProgressData.find((p: any) => p.user_id === userPerf.id && p.roadmap_id === r.id);
        const doneCount = (rp?.completed_topic_ids || []).length;
        totalTopicsDoneSum += doneCount;
        if (rp?.status === 'completed' || doneCount >= topicCount) {
          completedTrainers++;
        }
      });

      const maxPossible = topicCount * assignedCount;
      const pct = maxPossible > 0 ? Math.min(100, Math.round((totalTopicsDoneSum / maxPossible) * 100)) : 0;

      return {
        roadmapId: r.id,
        title: r.title,
        domain: r.domain || 'DSA',
        level: r.level || 'Intermediate',
        totalTopics: topicCount,
        assignedTrainersCount: assignedCount,
        completedTrainersCount: completedTrainers,
        completionPercentage: pct,
      };
    });

    // 3. Top Master Trainers Leaderboard
    topTrainersWithStats = globalPerformers.map((userPerf: any) => {
      const userCompletedContests = contestStats.filter((c) => {
        const cQs = allQsData.filter((q: any) => q.contest_id === c.contestId);
        if (cQs.length === 0) return false;
        const userSolved = cQs.filter((q: any) =>
          top5ProgressRows.some((p: any) => p.contest_id === c.contestId && p.user_id === userPerf.id && p.question_id === q.id && (p.status === 'solved' || p.score > 0))
        ).length;
        return userSolved >= cQs.length;
      }).length;

      const userCompletedRoadmaps = allRoadmapProgressData.filter(
        (rp: any) => rp.user_id === userPerf.id && rp.status === 'completed'
      ).length;

      return {
        ...userPerf,
        completedContestsCount: userCompletedContests,
        completedRoadmapsCount: userCompletedRoadmaps,
      };
    }).sort((a: any, b: any) => ((b.completedContestsCount + b.completedRoadmapsCount) - (a.completedContestsCount + a.completedRoadmapsCount)) || (b.solved - a.solved));
  }

  // ── Trainer Queries ─────────────────────────────────────────────────
  let trainerTodos: any[] = [];
  let trainerRoadmaps: any[] = [];
  let trainerCourseAssignments: any[] = [];
  let trainerProgress: { score: number; solved: number } = { score: 0, solved: 0 };
  let assignedContestsCount = 0;
  let completedContestsCount = 0;

  if (isTrainer) {
    const [todosRes, groupMemRes, userRoadmapRes, directCourseRes, myProgressRes] = await Promise.all([
      supabase
        .from('trainer_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
      supabase.from('roadmap_assignments').select('roadmap_id').eq('user_id', user.id),
      supabase
        .from('course_assignments')
        .select('*, course:courses(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('progress').select('score, status').eq('user_id', user.id),
    ]);

    trainerTodos = todosRes.data || [];
    const groupIds = (groupMemRes.data || []).map((g: any) => g.group_id);
    let allRoadmapIds: string[] = (userRoadmapRes.data || []).map((a: any) => a.roadmap_id);

    let groupCourseAssignments: any[] = [];
    if (groupIds.length > 0) {
      const [groupRoadmapRes, groupCourseRes] = await Promise.all([
        supabase.from('roadmap_assignments').select('roadmap_id').in('group_id', groupIds),
        supabase.from('course_assignments').select('*, course:courses(*)').in('group_id', groupIds),
      ]);
      allRoadmapIds = [...new Set([...allRoadmapIds, ...((groupRoadmapRes.data || []) as any[]).map((a: any) => a.roadmap_id)])];
      groupCourseAssignments = groupCourseRes.data || [];
    }

    const roadmapQuery = allRoadmapIds.length > 0
      ? supabase.from('roadmaps').select('*').in('id', allRoadmapIds).order('created_at', { ascending: false })
      : supabase.from('roadmaps').select('*').order('created_at', { ascending: false }).limit(6);

    const [roadmapsResult, progressResult, questionProgressResult] = await Promise.all([
      roadmapQuery,
      supabase.from('user_roadmap_progress').select('*').eq('user_id', user.id),
      supabase.from('progress').select('question_id, status, score').eq('user_id', user.id),
    ]);

    const roadmaps = roadmapsResult.data || [];
    const progressData = progressResult.data || [];
    const questionProgress = questionProgressResult.data || [];

    trainerRoadmaps = roadmaps.map((rm: any) => {
      const existing = progressData.find((p: any) => p.roadmap_id === rm.id);
      const completedTopicIds: string[] = [...(existing?.completed_topic_ids || [])];
      const topics = rm.topics || [];
      const totalQs = topics.length;

      topics.forEach((t: any) => {
        const qId = t.id || t.question_id;
        if (qId) {
          const isSolvedInDb = questionProgress.some((qp: any) => qp.question_id === qId && (qp.status === 'solved' || qp.score > 0));
          if (isSolvedInDb) {
            if (t.id && !completedTopicIds.includes(t.id)) completedTopicIds.push(t.id);
            if (qId && !completedTopicIds.includes(qId)) completedTopicIds.push(qId);
          }
        }
      });

      const uniqueSolvedCount = completedTopicIds.length;
      let currentStatus = 'not_started';
      if (totalQs > 0 && uniqueSolvedCount >= totalQs) {
        currentStatus = 'completed';
      } else if (uniqueSolvedCount > 0) {
        currentStatus = 'in_progress';
      } else if (existing?.status) {
        currentStatus = existing.status;
      }

      return {
        ...rm,
        progress: {
          ...(existing || { id: '', user_id: user.id, roadmap_id: rm.id, status: 'not_started', started_at: null, completed_at: null, updated_at: new Date().toISOString() }),
          completed_topic_ids: completedTopicIds,
          status: currentStatus,
        },
      };
    });

    const seenCourses = new Set<string>();
    const allCoursesRaw = [...(directCourseRes.data || []), ...groupCourseAssignments];
    trainerCourseAssignments = allCoursesRaw.filter((c: any) => {
      const courseId = c.course_id || c.course?.id;
      if (!courseId || seenCourses.has(courseId)) return false;
      seenCourses.add(courseId);
      return true;
    });

    let totalScore = 0;
    let solvedCount = 0;
    (myProgressRes.data || []).forEach((p: any) => {
      totalScore += p.score || 0;
      if (p.status === 'solved') solvedCount++;
    });
    trainerProgress = { score: totalScore, solved: solvedCount };

    const conditions: string[] = [];
    if (userData?.team) conditions.push(`team.eq.${userData.team}`);
    if (groupIds.length > 0) conditions.push(`group_id.in.(${groupIds.join(',')})`);

    let assignedContestIds: string[] = [];
    if (conditions.length > 0) {
      const { data: matchedAssignments } = await supabase
        .from('contest_assignments')
        .select('contest_id')
        .or(conditions.join(','));
      assignedContestIds = (matchedAssignments || []).map((a: any) => a.contest_id);
    }

    const [allContestsRes, allQsRes] = await Promise.all([
      supabase.from('contests').select('id, title, start_date, end_date'),
      supabase.from('questions').select('id, contest_id'),
    ]);

    const roadmapContestIds = trainerRoadmaps.map((rm: any) => rm.contest_id).filter(Boolean);
    const myContestIds = Array.from(new Set([...assignedContestIds, ...roadmapContestIds]));
    const availableContests = allContestsRes.data || [];

    const myContests = availableContests.filter((c: any) => myContestIds.includes(c.id));
    assignedContestsCount = myContests.length;

    const allQs = allQsRes.data || [];
    completedContestsCount = 0;

    myContests.forEach((c: any) => {
      const cQs = allQs.filter((q: any) => q.contest_id === c.id);
      if (cQs.length > 0) {
        const solvedInContest = cQs.filter((q: any) =>
          questionProgress.some((qp: any) => qp.question_id === q.id && (qp.status === 'solved' || qp.score > 0))
        ).length;
        if (solvedInContest >= cQs.length) {
          completedContestsCount++;
        }
      }
    });
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, <strong>{userData?.full_name || 'User'}</strong> &bull; <span className="role-badge">{role}</span>
            {isTrainer && (
              <span style={{ marginLeft: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🎓 IT Days: {Math.max(userData?.it_days_count || 0, user?.user_metadata?.it_days_count || 0)}
              </span>
            )}
          </p>
        </div>

        <div className="quick-actions-bar">
          {isAdminOrManager ? (
            <>
              <Link href="/contests/new" className="btn btn-primary btn-sm">
                ➕ New Contest
              </Link>
              <Link href="/notifications" className="btn btn-secondary btn-sm" style={{ position: 'relative' }}>
                🔔 Notifications
                {(pendingRequestsCount || 0) > 0 && (
                  <span className="quick-action-badge">{pendingRequestsCount}</span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link href="/roadmaps" className="btn btn-primary btn-sm">
                🗺️ My Roadmaps
              </Link>
              <Link href="/skills" className="btn btn-secondary btn-sm">
                🏆 Skills &amp; Badges
              </Link>
              <Link href="/notifications" className="btn btn-secondary btn-sm" style={{ position: 'relative' }}>
                🔔 Announcements
                {userUnreadNotifsCount > 0 && (
                  <span className="quick-action-badge">{userUnreadNotifsCount}</span>
                )}
              </Link>
              <Link href="/profile" className="btn btn-secondary btn-sm">
                ✏️ Edit Profile
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Broadcast Announcements Banner */}
      <TrainerAnnouncementsBanner
        initialAnnouncements={userAnnouncements}
        userRole={role}
      />

      {/* Stats Grid */}
      <div className="stats-grid">
        {isAdminOrManager ? (
          <>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)' }}>👥</div>
              <div className="stat-info">
                <span className="stat-value">{usersCount} Users</span>
                <span className="stat-label">System Members</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>👥</div>
              <div className="stat-info">
                <span className="stat-value">{groupsCount} Groups</span>
                <span className="stat-label">Active Training Groups</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(240,82,55,0.12)', color: 'var(--accent)' }}>🏆</div>
              <div className="stat-info">
                <span className="stat-value">{contestsCount} Contests</span>
                <span className="stat-label">{activeContestsCount} Active Now</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>⚡</div>
              <div className="stat-info">
                <span className="stat-value">{questionsCount} Questions</span>
                <span className="stat-label">Bank Total</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(240,82,55,0.12)', color: 'var(--accent)' }}>🗺️</div>
              <div className="stat-info">
                <span className="stat-value">{trainerRoadmaps.length} Roadmaps</span>
                <span className="stat-label">Assigned Learning</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)' }}>🏆</div>
              <div className="stat-info">
                <span className="stat-value">{assignedContestsCount} Contests</span>
                <span className="stat-label">Assigned Contests</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>🥇</div>
              <div className="stat-info">
                <span className="stat-value">{completedContestsCount} Completed</span>
                <span className="stat-label">Contests Mastery</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>✅</div>
              <div className="stat-info">
                <span className="stat-value">{trainerProgress.solved} Solved</span>
                <span className="stat-label">Total Solved Problems</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content Layout Grid */}
      {isAdminOrManager ? (
        /* ── Admin Dashboard Layout ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
          {/* Left Column: Compact Recent Contests Summary + Real-time Contest & Roadmap Completion Analytics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <section className="contests-section" style={{ padding: '0.75rem 1rem' }}>
              <div className="section-header" style={{ marginBottom: '0.4rem', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 className="section-title" style={{ fontSize: '0.98rem' }}>Recent Contests</h2>
                  {contests.length > 0 && <span className="contests-count-badge">{contests.length}</span>}
                </div>
                <Link href="/contests" className="btn-view-all" style={{ fontSize: '0.78rem' }}>
                  View All →
                </Link>
              </div>

              <div className="d-contests-list">
                {(!contests || contests.length === 0) ? (
                  <div className="empty-state" style={{ padding: '0.85rem' }}>
                    <h3>No active contests</h3>
                  </div>
                ) : (
                  contests.slice(0, 3).map((contest: any) => {
                    const now = new Date();
                    const start = new Date(contest.start_date);
                    const end = new Date(contest.end_date);
                    const status = now >= start && now <= end ? 'active' : now < start ? 'upcoming' : 'past';
                    const qCount = contest.questions?.[0]?.count || 0;

                    return (
                      <Link key={contest.id} href={`/contests/${contest.id}`} className="d-contest-row" style={{ padding: '0.45rem 0.4rem' }}>
                        <div className="d-contest-icon" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>🏆</div>
                        <div className="d-contest-body">
                          <span className="d-contest-title" style={{ fontSize: '0.86rem' }}>{contest.title}</span>
                          <div className="d-contest-sub" style={{ fontSize: '0.74rem' }}>
                            <span>💡 {qCount} Qs</span>
                          </div>
                        </div>
                        <div className="d-contest-right">
                          <span className={`d-status-badge d-status-${status}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                            {status === 'active' && <span className="d-pulse-dot" />}
                            {status.toUpperCase()}
                          </span>
                          <span className="d-arrow">→</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Contest & Roadmap Completion Analytics Module */}
            <TrainerCompletionAnalytics
              contestStats={contestStats}
              roadmapStats={roadmapStats}
              topTrainers={topTrainersWithStats}
              totalTrainersCount={globalPerformers.length || 1}
            />
          </div>

          {/* Right Column: Admin Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <PendingRequestsWidget initialRequests={pendingRequests || []} />
            <TopPerformersWidget performers={globalPerformers} currentUserId={user.id} />
          </div>
        </div>
      ) : (
        /* ── Trainer Dashboard Layout ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
          {/* Top-left: Topic Roadmaps */}
          <TopicRoadmapsWidget roadmaps={trainerRoadmaps} />

          {/* Top-right: Skills & Badges Obtained Widget */}
          <AssignedCoursesWidget />

          {/* Bottom-left: Helpdesk / Support Desk Widget */}
          <HelpdeskWidget />

          {/* Bottom-right: Live Top Performers Leaderboard Widget */}
          <TopPerformersWidget performers={globalPerformers} currentUserId={user.id} />
        </div>
      )}
    </div>
  );
}
