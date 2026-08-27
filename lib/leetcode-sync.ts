import { getAdminClient } from '@/lib/supabase/admin';
import { fetchProfileStats, fetchRecentAc, parseProblemSlug, sleep } from '@/lib/leetcode';
import { revalidatePath } from 'next/cache';

export async function syncLeetCodeContest(contestId: string): Promise<{
  success: boolean;
  message: string;
  syncedCount: number;
  totalNewlySolved: number;
}> {
  const dbAdmin = getAdminClient();

  const { data: contest } = await dbAdmin
    .from('contests')
    .select('id, title, platform, questions(id, slug, max_score, title)')
    .eq('id', contestId)
    .single();

  if (!contest) {
    throw new Error('Contest not found');
  }

  if (contest.platform !== 'leetcode') {
    throw new Error('This contest is not configured as a LeetCode contest.');
  }

  const questions = contest.questions || [];
  if (questions.length === 0) {
    throw new Error('No questions found for this LeetCode contest.');
  }

  // Collect target users assigned to this contest
  const { data: assignments } = await dbAdmin
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', contestId);

  const groupIds: string[] = [];
  const teams: string[] = [];
  (assignments || []).forEach((a: any) => {
    if (a.group_id) groupIds.push(a.group_id);
    if (a.team) teams.push(a.team);
  });

  const userIds = new Set<string>();
  if (groupIds.length > 0) {
    const { data: gm } = await dbAdmin
      .from('group_members')
      .select('user_id, users!inner(role)')
      .in('group_id', groupIds)
      .neq('users.role', 'admin');
    (gm || []).forEach((m: any) => { if (m.user_id) userIds.add(m.user_id); });
  }

  if (teams.length > 0) {
    const { data: tu } = await dbAdmin
      .from('users')
      .select('id')
      .in('team', teams)
      .neq('role', 'admin');
    (tu || []).forEach((u: any) => { if (u.id) userIds.add(u.id); });
  }

  if (userIds.size === 0) {
    return {
      success: true,
      message: 'No participants are assigned to this LeetCode contest. Assign groups or teams first.',
      syncedCount: 0,
      totalNewlySolved: 0,
    };
  }

  // Fetch assigned non-admin users with leetcode_id
  const { data: uList } = await dbAdmin
    .from('users')
    .select('id, full_name, team, leetcode_id')
    .in('id', Array.from(userIds))
    .neq('role', 'admin')
    .not('leetcode_id', 'is', null);

  const targetUsers = (uList || []).filter((u: any) => u.leetcode_id && u.leetcode_id.trim() !== '');

  if (targetUsers.length === 0) {
    return {
      success: true,
      message: 'None of the assigned participants have a LeetCode ID configured.',
      syncedCount: 0,
      totalNewlySolved: 0,
    };
  }

  console.log(`[leetcode-sync] Syncing ${targetUsers.length} user(s) for contest "${contest.title}"`);

  let totalNewlySolved = 0;
  let syncedCount = 0;

  for (let i = 0; i < targetUsers.length; i++) {
    const u = targetUsers[i];
    try {
      // 1. Fetch Profile Stats & Save
      const stats = await fetchProfileStats(u.leetcode_id);
      if (stats.found) {
        await dbAdmin.from('leetcode_user_stats').upsert({
          user_id: u.id,
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

      // 2. Fetch recent AC submissions
      const recentAc = await fetchRecentAc(u.leetcode_id, 30);
      const acMap = new Map<string, any>();
      recentAc.forEach((r) => {
        const sl = parseProblemSlug(r.titleSlug);
        if (sl) acMap.set(sl, r);
      });

      // 3. Match against contest questions
      for (const q of questions) {
        const qSlug = parseProblemSlug(q.slug);
        if (qSlug && acMap.has(qSlug)) {
          const hit = acMap.get(qSlug);
          const ts = hit.timestamp
            ? new Date(Number(hit.timestamp) * 1000).toISOString()
            : new Date().toISOString();

          const { error: progErr } = await dbAdmin.from('progress').upsert({
            contest_id: contest.id,
            user_id: u.id,
            question_id: q.id,
            status: 'solved',
            score: q.max_score || 10,
            max_score: q.max_score || 10,
            last_submission_at: ts,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'contest_id,user_id,question_id' });

          if (!progErr) totalNewlySolved++;
        }
      }

      syncedCount++;
    } catch (err: any) {
      console.warn(`[leetcode-sync] Error syncing user ${u.full_name} (${u.leetcode_id}):`, err.message);
    }

    if (i < targetUsers.length - 1) {
      await sleep(1000);
    }
  }

  // Update contest last_scraped_at
  await dbAdmin
    .from('contests')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', contestId);

  try {
    revalidatePath(`/contests/${contestId}`);
    revalidatePath('/contests');
    revalidatePath('/dashboard');
  } catch {}

  return {
    success: true,
    message: `Synced ${syncedCount} participants, verified ${totalNewlySolved} new solves.`,
    syncedCount,
    totalNewlySolved,
  };
}
