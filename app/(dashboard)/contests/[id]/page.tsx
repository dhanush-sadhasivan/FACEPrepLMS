import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LockedContestView from './LockedContestView';
import ContestViewTabs from './ContestViewTabs';
import { getCachedContestData } from '@/lib/cdn-cache';
import '../page.css';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Next.js ISR cache

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
      <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>Contest Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {contestError?.message || 'This contest may have been deleted or the ID is invalid.'}
        </p>
        <Link href="/contests" className="btn btn-primary btn-sm">← Back to Contests</Link>
      </div>
    );
  }

  // All questions for management panel
  const allQuestionsList = (contest.questions || []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Only enabled questions for calculations, points, and leaderboard counting
  const enabledQuestionsList = allQuestionsList.filter((q: any) => q.is_enabled !== false);
  const enabledQuestionIdsSet = new Set(enabledQuestionsList.map((q: any) => q.id));

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

  const totalContestMaxScore = enabledQuestionsList.reduce((sum: number, q: any) => sum + (q.max_score || 10), 0);

  // ── Build Leaderboard data (Check CDN Storage Cache first) ───────────────
  let leaderboard: any[] = [];
  const cachedContest = await getCachedContestData(contest.id);

  if (cachedContest && Array.isArray(cachedContest.leaderboard) && cachedContest.leaderboard.length > 0) {
    leaderboard = cachedContest.leaderboard;
  } else {
    // ── Fallback to direct DB query if cache snapshot not yet available ────
    const dbAdmin = getAdminClient();

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
    const totalContestMaxScore = enabledQuestionsList.reduce((sum: number, q: any) => sum + (q.max_score || 10), 0);

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
            total: enabledQuestionsList.length,
            score: 0,
            maxScore: totalContestMaxScore,
            lastActive: null,
            progress: [],
          });
        }
      });
    }

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
            total: enabledQuestionsList.length,
            score: 0,
            maxScore: totalContestMaxScore,
            lastActive: null,
            progress: [],
          });
        }
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
        .order('id', { ascending: true })
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
      if (!enabledQuestionIdsSet.has(p.question_id)) return;
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

    leaderboard = Array.from(userMap.values()).sort((a, b) => b.score - a.score);
  }
  const totalTopicsCount = Array.from(new Set(enabledQuestionsList.map((q: any) => q.domain || 'General'))).length;

  return (
    <div>
      {/* Compact Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
              {contest.title}
            </h1>
            <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
              {statusStr.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              HackerRank Slug: <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '0.1rem 0.45rem', borderRadius: 4, color: 'var(--accent)', fontWeight: 700 }}>{contest.hackerrank_slug}</code>
            </span>
            <span>&bull;</span>
            <span>🗓️ <strong>Start:</strong> {startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>&bull;</span>
            <span>⏳ <strong>End:</strong> {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {isAdminOrManager && (
          <Link href={`/contests/${contest.id}/edit`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.82rem' }}>
            ⚙️ Manage / Edit Contest
          </Link>
        )}
      </div>

      {/* Compact Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.85rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{enabledQuestionsList.length}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Active Questions</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.85rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--indigo)', lineHeight: 1 }}>{totalTopicsCount}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Topics / Domains</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.85rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>{leaderboard.length}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Assigned Participants</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.85rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{totalContestMaxScore}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>Total Points</div>
        </div>
      </div>

      {/* Tabs View */}
      <ContestViewTabs
        contestId={contest.id}
        contestSlug={contest.hackerrank_slug}
        leaderboard={leaderboard}
        questions={allQuestionsList}
        lastScraped={contest.last_scraped_at}
        isAdminOrManager={isAdminOrManager}
      />
    </div>
  );
}
