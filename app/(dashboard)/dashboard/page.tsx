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
import './page.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [userRes, contestsHeadRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('contests').select('*', { count: 'exact', head: true }),
  ]);

  const userData = userRes.data;
  const contestsCount = contestsHeadRes.count || 0;

  const role = userData?.role || 'trainer';
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const isTrainer = role === 'trainer';

  // ── Global Live Top Performers (Computed for ALL Roles with Pagination) ───
  const dbAdmin = getAdminClient();
  const { data: allUserProfiles } = await dbAdmin.from('users').select('id, full_name, emp_id, team').neq('role', 'admin');

  const globalUserMap = new Map();
  (allUserProfiles || []).forEach((u: any) => {
    globalUserMap.set(u.id, {
      user_id: u.id,
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
      .select('user_id, score, status')
      .or('score.gt.0,status.eq.solved')
      .range(pFrom, pFrom + pStep - 1);

    if (pErr || !pageRows || pageRows.length === 0) break;
    allProgressRows = allProgressRows.concat(pageRows);
    if (pageRows.length < pStep) break;
    pFrom += pStep;
  }

  allProgressRows.forEach((p: any) => {
    const entry = globalUserMap.get(p.user_id);
    if (entry) {
      entry.score += p.score || 0;
      if (p.status === 'solved') entry.solved++;
    }
  });

  const globalPerformers = Array.from(globalUserMap.values())
    .sort((a: any, b: any) => (b.score - a.score) || (b.solved - a.solved));

  // ── Admin / Manager Queries ─────────────────────────────────────────
  let usersCount = 0;
  let groupsCount = 0;
  let questionsCount = 0;
  let pendingRequests: any[] = [];
  let pendingRequestsCount = 0;
  let contests: any[] = [];
  let activeContestsCount = 0;
  let upcomingContestsCount = 0;

  if (isAdminOrManager) {
    const [uq, gq, qq, pq, cq] = await Promise.all([
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
        .order('created_at', { ascending: false })
        .limit(6),
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
      let totalQs = 0;

      topics.forEach((t: any) => {
        const questions = t.questions || [];
        if (Array.isArray(questions) && questions.length > 0) {
          totalQs += questions.length;
          questions.forEach((q: any) => {
            const qId = q.question_id || q.id;
            const qp = questionProgress.find((p: any) => p.question_id === qId);
            if (qp && (qp.status === 'solved' || qp.score > 0)) {
              if (q.id && !completedTopicIds.includes(q.id)) completedTopicIds.push(q.id);
              if (qId && !completedTopicIds.includes(qId)) completedTopicIds.push(qId);
            }
          });
        } else {
          totalQs += 1;
          const qId = t.question_id || t.id;
          const qp = questionProgress.find((p: any) => p.question_id === qId);
          if (qp && (qp.status === 'solved' || qp.score > 0)) {
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

    assignedContestsCount = (contests || []).length;
    if ((contests || []).length > 0) {
      const { data: allQuestions } = await supabase.from('questions').select('id, contest_id');
      (contests || []).forEach((c: any) => {
        const cQs = (allQuestions || []).filter((q: any) => q.contest_id === c.id);
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
  }

  return (
    <div className="dashboard-container">
      {/* Exact Original Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, <strong>{userData?.full_name || 'User'}</strong> &bull; <span className="role-badge">{role}</span>
            {isTrainer && (
              <span style={{ marginLeft: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                🎓 IT Days: {userData?.it_days_count ?? user?.user_metadata?.it_days_count ?? 0}
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
              <Link href="/profile" className="btn btn-secondary btn-sm">
                ✏️ Edit Profile
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Exact Original Stats Grid */}
      <div className="stats-grid">
        {isAdminOrManager ? (
          <>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>👥</div>
              <div className="stat-info">
                <span className="stat-value">{usersCount || 0}</span>
                <span className="stat-label">Total Users</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>🏆</div>
              <div className="stat-info">
                <span className="stat-value">{activeContestsCount} Active</span>
                <span className="stat-label">{contestsCount || 0} Total Contests</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(255,165,0,0.12)', color: '#FFA500' }}>📚</div>
              <div className="stat-info">
                <span className="stat-value">{questionsCount || 0}</span>
                <span className="stat-label">Scraped Questions</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>🔒</div>
              <div className="stat-info">
                <span className="stat-value" style={{ color: (pendingRequestsCount || 0) > 0 ? 'var(--warning)' : 'inherit' }}>
                  {pendingRequestsCount || 0}
                </span>
                <span className="stat-label">Pending Requests</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>🗺️</div>
              <div className="stat-info">
                <span className="stat-value">{trainerRoadmaps.length}</span>
                <span className="stat-label">Topic Roadmaps</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🏆</div>
              <div className="stat-info">
                <span className="stat-value">{assignedContestsCount}</span>
                <span className="stat-label">Contests Assigned</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>👑</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {/* Left Column: Contests Section */}
          <section className="contests-section">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 className="section-title">Recent Contests</h2>
                {contests.length > 0 && <span className="contests-count-badge">{contests.length}</span>}
              </div>
              <Link href="/contests" className="btn-view-all">
                View All Contests →
              </Link>
            </div>

            <div className="d-contests-list">
              {(!contests || contests.length === 0) ? (
                <div className="empty-state">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏆</div>
                  <h3>No active or recent contests</h3>
                  <p>Check back later or view past contests.</p>
                </div>
              ) : (
                contests.map((contest: any) => {
                  const now = new Date();
                  const start = new Date(contest.start_date);
                  const end = new Date(contest.end_date);
                  const status = now >= start && now <= end ? 'active' : now < start ? 'upcoming' : 'past';
                  const qCount = contest.questions?.[0]?.count || 0;
                  const gCount = contest.assignments?.[0]?.count || 0;

                  return (
                    <Link key={contest.id} href={`/contests/${contest.id}`} className={`d-contest-row status-${status}`}>
                      <div className="d-contest-icon">🏆</div>
                      <div className="d-contest-body">
                        <div className="d-contest-title">{contest.title}</div>
                        <div className="d-contest-sub">
                          <span>🗓️ {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <span className="d-sub-sep">•</span>
                          <span>❓ {qCount} Questions</span>
                          {gCount > 0 && (
                            <>
                              <span className="d-sub-sep">•</span>
                              <span>👥 {gCount} {gCount === 1 ? 'Group' : 'Groups'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="d-contest-right">
                        <span className={`d-status-badge d-status-${status}`}>
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

          {/* Right Column: Admin Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <PendingRequestsWidget initialRequests={pendingRequests || []} />
            <TopPerformersWidget performers={globalPerformers} currentUserId={user.id} />
          </div>
        </div>
      ) : (
        /* ── Trainer Dashboard Layout ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
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
