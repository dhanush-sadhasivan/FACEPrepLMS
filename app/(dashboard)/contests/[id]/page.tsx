import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LockedContestView from './LockedContestView';
import ContestViewTabs from './ContestViewTabs';
import '../page.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('role, team, full_name').eq('id', user.id).single();
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*, questions(*)')
    .eq('id', id)
    .single();

  if (!contest) {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Contest Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {contestError?.message || 'This contest may have been deleted or the ID is invalid.'}
        </p>
        <Link href="/contests" className="btn btn-primary">← Back to Contests</Link>
      </div>
    );
  }

  // Sort questions by order_index
  const questionsList = (contest.questions || []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const now = new Date();
  const startDate = new Date(contest.start_date);
  const endDate = new Date(contest.end_date);

  const isActive = now >= startDate && now <= endDate;
  const isUpcoming = now < startDate;

  const statusStr = isActive ? 'active' : isUpcoming ? 'upcoming' : 'past';
  const statusBadgeClass = isActive ? 'badge-success' : isUpcoming ? 'badge-warning' : 'badge-muted';

  // Check access for trainer
  if (!isAdminOrManager) {
    const { data: access } = await supabase
      .from('access_requests')
      .select('*')
      .eq('contest_id', contest.id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!isActive && !access) {
      return <LockedContestView contestId={contest.id} title={contest.title} start={contest.start_date} end={contest.end_date} />;
    }
  }

  // ── Build Leaderboard data with ALL assigned users ────────────────────────
  const dbAdmin = getAdminClient();

  // Fetch all user profiles for bulletproof user lookup
  const { data: allUserProfiles } = await dbAdmin
    .from('users')
    .select('id, full_name, emp_id, team')
    .neq('role', 'admin');
  const allUsersMap = new Map((allUserProfiles || []).map((u: any) => [u.id, u]));

  // 1. Fetch contest assignments
  const { data: assignments } = await dbAdmin
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', contest.id);

  const groupIds: string[] = [];
  const teams: string[] = [];
  (assignments || []).forEach((a: { group_id: string | null; team: string | null }) => {
    if (a.group_id) groupIds.push(a.group_id);
    if (a.team) teams.push(a.team);
  });

  // 2. Fetch assigned user records
  const userMap = new Map();
  const totalContestMaxScore = questionsList.reduce((sum: number, q: any) => sum + (q.max_score || 10), 0);

  // From group members
  if (groupIds.length > 0) {
    const { data: groupMembers } = await dbAdmin
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds);

    (groupMembers || []).forEach((gm: any) => {
      const u = allUsersMap.get(gm.user_id);
      if (u && !userMap.has(u.id)) {
        userMap.set(u.id, {
          user_id: u.id,
          name: u.full_name,
          emp_id: u.emp_id,
          team: u.team || 'N/A',
          solved: 0,
          total: questionsList.length,
          score: 0,
          maxScore: totalContestMaxScore,
          lastActive: null,
          progress: [],
        });
      }
    });
  }

  // From teams
  if (teams.length > 0) {
    const { data: teamUsers } = await dbAdmin
      .from('users')
      .select('id')
      .in('team', teams);

    (teamUsers || []).forEach((tu: any) => {
      const u = allUsersMap.get(tu.id);
      if (u && !userMap.has(u.id)) {
        userMap.set(u.id, {
          user_id: u.id,
          name: u.full_name,
          emp_id: u.emp_id,
          team: u.team || 'N/A',
          solved: 0,
          total: questionsList.length,
          score: 0,
          maxScore: totalContestMaxScore,
          lastActive: null,
          progress: [],
        });
      }
    });
  }

  // Fallback: If no assigned users found yet, initialize all non-admin users in userMap
  if (userMap.size === 0) {
    allUsersMap.forEach((u: any) => {
      userMap.set(u.id, {
        user_id: u.id,
        name: u.full_name,
        emp_id: u.emp_id,
        team: u.team || 'N/A',
        solved: 0,
        total: questionsList.length,
        score: 0,
        maxScore: totalContestMaxScore,
        lastActive: null,
        progress: [],
      });
    });
  }

  // 3. Overlay progress data from database
  let progress: any[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data: pageRows, error: progressError } = await dbAdmin
      .from('progress')
      .select('*')
      .eq('contest_id', contest.id)
      .range(from, from + step - 1);

    if (progressError) {
      console.error(`[contest detail] Error fetching progress: ${progressError.message}`);
      break;
    }
    if (!pageRows || pageRows.length === 0) break;
    progress = progress.concat(pageRows);
    if (pageRows.length < step) break;
    from += step;
  }

  (progress || []).forEach((p: any) => {
    if (!userMap.has(p.user_id)) {
      const userProfile = allUsersMap.get(p.user_id);
      userMap.set(p.user_id, {
        user_id: p.user_id,
        name: userProfile?.full_name || 'Participant',
        emp_id: userProfile?.emp_id || '—',
        team: userProfile?.team || 'N/A',
        solved: 0,
        total: questionsList.length,
        score: 0,
        maxScore: totalContestMaxScore,
        lastActive: null,
        progress: [],
      });
    }
    const u = userMap.get(p.user_id);
    if (u) {
      if (p.status === 'solved') u.solved++;
      u.score += p.score || 0;
      const isActiveSubmission = p.status === 'solved' || p.status === 'attempted' || (p.score || 0) > 0;
      const subTime = p.last_submission_at || (isActiveSubmission ? p.updated_at : null);
      if (subTime && (!u.lastActive || new Date(subTime) > new Date(u.lastActive))) {
        u.lastActive = subTime;
      }
      u.progress.push(p);
    }
  });

  const leaderboard = Array.from(userMap.values()).sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{contest.title}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
            HackerRank Slug: <code style={{ background: 'var(--surface-2)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{contest.hackerrank_slug}</code>
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
            🗓️ <strong>Start:</strong> {startDate.toLocaleString()} &nbsp;|&nbsp; ⌛ <strong>End:</strong> {endDate.toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={`badge ${statusBadgeClass}`}>{statusStr.toUpperCase()}</span>
          {isAdminOrManager && (
            <Link href={`/contests/${contest.id}/edit`} className="btn btn-secondary">
              ⚙️ Manage / Edit Contest
            </Link>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{questionsList.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Questions</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
            {Array.from(new Set(questionsList.map((q: any) => q.domain || 'General'))).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Topics / Domains</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{leaderboard.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Assigned Participants</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
            {questionsList.reduce((s: number, q: any) => s + (q.max_score || 10), 0)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Total Points</div>
        </div>
      </div>

      {/* Tabs View: Leaderboard visible entirely at first, with Topic-wise Questions Dropdowns tab */}
      <ContestViewTabs
        contestId={contest.id}
        contestSlug={contest.hackerrank_slug}
        leaderboard={leaderboard}
        questions={questionsList}
        lastScraped={contest.last_scraped_at}
        isAdminOrManager={isAdminOrManager}
      />
    </div>
  );
}
