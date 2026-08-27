import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { fetchProfileStats, fetchRecentAc, parseProblemSlug, sleep } from '@/lib/leetcode';
import { syncLeetCodeContest } from '@/lib/leetcode-sync';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  try {
    const body = await req.json().catch(() => ({}));
    const { contestId, userId } = body;

    const dbAdmin = getAdminClient();

    // ── CASE 1: Sync a single user (self-sync or admin requested) ─────────────
    if (userId) {
      if (!isAdminOrManager && userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You can only sync your own progress' }, { status: 403 });
      }

      const { data: targetUser } = await dbAdmin
        .from('users')
        .select('id, full_name, team, leetcode_id')
        .eq('id', userId)
        .single();

      if (!targetUser || !targetUser.leetcode_id || targetUser.leetcode_id.trim() === '') {
        return NextResponse.json({
          error: 'User has no LeetCode ID configured. Update profile first.',
        }, { status: 400 });
      }

      // 1. Fetch Profile Stats & Save
      const stats = await fetchProfileStats(targetUser.leetcode_id);
      if (stats.found) {
        await dbAdmin.from('leetcode_user_stats').upsert({
          user_id: targetUser.id,
          username: stats.username,
          ranking: stats.ranking,
          contest_rating: stats.contestRating,
          solved_easy: stats.solved.easy,
          solved_medium: stats.solved.medium,
          solved_hard: stats.solved.hard,
          solved_total: stats.solved.total,
          submission_calendar: stats.submissionCalendar,
          last_synced_at: new Date().toISOString(),
          sync_status: 'ok',
          sync_error: null,
        });
      }

      // 2. Fetch Recent AC submissions
      const recentAc = await fetchRecentAc(targetUser.leetcode_id, 30);
      const acMap = new Map<string, any>();
      recentAc.forEach((r) => {
        const sl = parseProblemSlug(r.titleSlug);
        if (sl) acMap.set(sl, r);
      });

      // 3. Find LeetCode contests strictly assigned to this user (via team or groups)
      const { data: userGroups } = await dbAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', targetUser.id);
      const groupIds = (userGroups || []).map((g: any) => g.group_id);

      const conditions: string[] = [];
      if (targetUser.team && targetUser.team !== 'N/A') {
        conditions.push(`team.eq.${targetUser.team}`);
      }
      if (groupIds.length > 0) {
        conditions.push(`group_id.in.(${groupIds.join(',')})`);
      }

      let assignedContests: any[] = [];
      if (conditions.length > 0) {
        const { data: matchedAssignments } = await dbAdmin
          .from('contest_assignments')
          .select('contest_id')
          .or(conditions.join(','));

        const contestIds = Array.from(new Set((matchedAssignments || []).map((a: any) => a.contest_id)));
        if (contestIds.length > 0) {
          const { data: lcContests } = await dbAdmin
            .from('contests')
            .select('id, title, platform, questions(id, slug, max_score)')
            .eq('platform', 'leetcode')
            .in('id', contestIds);
          assignedContests = lcContests || [];
        }
      }

      let newlyCompleted = 0;

      for (const contest of assignedContests || []) {
        const questions = contest.questions || [];
        for (const q of questions) {
          const qSlug = parseProblemSlug(q.slug);
          if (qSlug && acMap.has(qSlug)) {
            const hit = acMap.get(qSlug);
            const ts = hit.timestamp
              ? new Date(Number(hit.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            const { error: upsertErr } = await dbAdmin.from('progress').upsert({
              contest_id: contest.id,
              user_id: targetUser.id,
              question_id: q.id,
              status: 'solved',
              score: q.max_score || 10,
              max_score: q.max_score || 10,
              last_submission_at: ts,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'contest_id,user_id,question_id' });

            if (!upsertErr) newlyCompleted++;
          }
        }
      }

      try {
        revalidatePath('/contests');
        revalidatePath('/dashboard');
        revalidatePath('/leetcode');
      } catch {}

      return NextResponse.json({
        ok: true,
        stats,
        recentSolvesCount: recentAc.length,
        newlyCompleted,
      });
    }

    // ── CASE 2: Sync an entire contest ────────────────────────────────────────
    if (contestId) {
      const result = await syncLeetCodeContest(contestId);
      return NextResponse.json({
        ok: true,
        contestId,
        syncedUsers: result.syncedCount,
        totalNewlySolved: result.totalNewlySolved,
        message: result.message,
      });
    }

    return NextResponse.json({ error: 'contestId or userId required' }, { status: 400 });
  } catch (err: any) {
    console.error('[leetcode/sync] Fatal error:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
