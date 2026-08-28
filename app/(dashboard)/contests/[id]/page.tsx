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

  // ── 1. Resolve currently assigned non-admin user IDs for this contest ─────
  const dbAdmin = getAdminClient();

  const { data: assignments } = await dbAdmin
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', contest.id);

  const groupIds: string[] = [];
  const teams: string[] = [];
  (assignments || []).forEach((a: { group_id: string | null; team: string | null }) => {
    if (a.group_id) groupIds.push(a.group_id);
    if (a.team && a.team.trim() !== '') teams.push(a.team.trim());
  });

  const assignedUserIds = new Set<string>();

  if (groupIds.length > 0) {
    const { data: groupMembers } = await dbAdmin
      .from('group_members')
      .select('user_id, users!inner(role)')
      .in('group_id', groupIds)
      .neq('users.role', 'admin');

    (groupMembers || []).forEach((gm: any) => {
      if (gm.user_id) assignedUserIds.add(gm.user_id);
    });
  }

  if (teams.length > 0) {
    const { data: teamUsers } = await dbAdmin
      .from('users')
      .select('id')
      .in('team', teams)
      .neq('role', 'admin');

    (teamUsers || []).forEach((tu: any) => {
      if (tu.id) assignedUserIds.add(tu.id);
    });
  }

  // ── 2. Build Leaderboard data (Check CDN Storage Cache first) ───────────────
  let leaderboard: any[] = [];
  
  if (assignedUserIds.size === 0) {
    // If no participants are assigned to this contest, guarantee an empty leaderboard
    leaderboard = [];
  } else {
    const cachedContest = await getCachedContestData(contest.id);

    if (cachedContest && Array.isArray(cachedContest.leaderboard) && cachedContest.leaderboard.length > 0) {
      // Sanitize cached leaderboard and STRICTLY filter to currently assigned participants
      leaderboard = cachedContest.leaderboard
        .filter((row: any) => assignedUserIds.has(row.user_id))
        .map((row: any) => {
          const qProgress = row.progress || [];
          if (Array.isArray(qProgress) && qProgress.length > 0) {
            const strictlySolved = qProgress.filter((p: any) => {
              const score = p.score || 0;
              const maxScore = p.max_score || 10;
              return p.status === 'solved' && maxScore > 0 && score >= maxScore;
            }).length;
            return {
              ...row,
              solved: strictlySolved,
            };
          }
          return row;
        });
    } else {
      // ── Fallback to direct DB query if cache snapshot not yet available ────
      const { data: assignedUserProfiles } = await dbAdmin
        .from('users')
        .select('id, full_name, emp_id, team, hackerrank_id, leetcode_id')
        .in('id', Array.from(assignedUserIds))
        .neq('role', 'admin');

      const userMap = new Map();
      (assignedUserProfiles || []).forEach((u: any) => {
        userMap.set(u.id, {
          user_id: u.id,
          name: u.full_name || 'Anonymous',
          emp_id: u.emp_id || '—',
          team: u.team || 'N/A',
          hackerrank_id: u.hackerrank_id,
          leetcode_id: u.leetcode_id,
          solved: 0,
          total: enabledQuestionsList.length,
          score: 0,
          maxScore: totalContestMaxScore,
          lastActive: null,
          progress: [],
        });
      });

      // Overlay progress data from database
      let progress: any[] = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data: pageRows, error: progressError } = await dbAdmin
          .from('progress')
          .select('*')
          .eq('contest_id', contest.id)
          .in('user_id', Array.from(assignedUserIds))
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
          const score = p.score || 0;
          const maxScore = p.max_score || 10;
          const isSolved = p.status === 'solved' && maxScore > 0 && score >= maxScore;
          if (isSolved) u.solved++;
          u.score += score;
          const isActiveSubmission = isSolved || p.status === 'attempted' || score > 0;
          const subTime = p.last_submission_at || (isActiveSubmission ? p.updated_at : null);
          if (subTime && (!u.lastActive || new Date(subTime) > new Date(u.lastActive))) {
            u.lastActive = subTime;
          }
          u.progress.push({
            ...p,
            status: isSolved ? 'solved' : (score > 0 || p.status === 'attempted' ? 'attempted' : (p.status || 'unattempted')),
          });
        }
      });

      leaderboard = Array.from(userMap.values()).sort((a, b) => b.score - a.score);
    }
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
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.12rem 0.45rem',
                borderRadius: 4,
                background: contest.platform === 'leetcode' ? 'rgba(255, 161, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: contest.platform === 'leetcode' ? '#ffa116' : '#3b82f6',
                border: `1px solid ${contest.platform === 'leetcode' ? 'rgba(255, 161, 22, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              }}
            >
              {contest.platform === 'leetcode' ? '🟠 LeetCode Track' : '🟢 HackerRank'}
            </span>
            <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
              {statusStr.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              {contest.platform === 'leetcode' ? 'Track ID' : 'HackerRank Slug'}: <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '0.1rem 0.45rem', borderRadius: 4, color: contest.platform === 'leetcode' ? '#ffa116' : 'var(--accent)', fontWeight: 700 }}>{contest.hackerrank_slug}</code>
            </span>
            <span>&bull;</span>
            <span suppressHydrationWarning>🗓️ <strong>Start:</strong> {startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
            <span>&bull;</span>
            <span suppressHydrationWarning>⏳ <strong>End:</strong> {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
          </div>
        </div>

        {isAdminOrManager && (
          <Link href={`/contests/${contest.id}/edit`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.82rem' }}>
            ⚙️ Manage / Edit {contest.platform === 'leetcode' ? 'Track' : 'Contest'}
          </Link>
        )}
      </div>

      {/* Compact Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.85rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{enabledQuestionsList.length}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.15rem' }}>
            {contest.platform === 'leetcode' ? 'Active Problems' : 'Active Questions'}
          </div>
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
        platform={contest.platform || 'hackerrank'}
        leaderboard={leaderboard}
        questions={allQuestionsList}
        lastScraped={contest.last_scraped_at}
        isAdminOrManager={isAdminOrManager}
      />
    </div>
  );
}
