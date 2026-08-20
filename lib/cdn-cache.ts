import { getAdminClient } from '@/lib/supabase/admin';

export interface GlobalPerformer {
  id: string;
  user_id: string;
  name: string;
  emp_id: string;
  team: string;
  score: number;
  solved: number;
}

export interface CachedLeaderboardPayload {
  updated_at: string;
  performers: GlobalPerformer[];
}

export interface CachedContestPayload {
  contest_id: string;
  updated_at: string;
  questions: any[];
  enabled_question_count: number;
  total_max_score: number;
  leaderboard: any[];
}

const BUCKET_NAME = 'api-cache';

/**
 * Returns the public CDN URL for a file stored in the 'api-cache' bucket.
 */
export function getCdnStorageUrl(fileName: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
}

/**
 * Fetch the global leaderboard from the Supabase Storage Smart CDN.
 * Uses Next.js caching with background revalidation.
 *
 * @returns CachedLeaderboardPayload or null on cache miss
 */
export async function getCachedGlobalLeaderboard(): Promise<CachedLeaderboardPayload | null> {
  const cdnUrl = getCdnStorageUrl('leaderboard.json');

  try {
    const res = await fetch(cdnUrl, {
      next: {
        revalidate: 60, // Stale-while-revalidate every 60 seconds
        tags: ['leaderboard', 'global-stats'],
      },
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      // 404 means snapshot not yet generated; trigger self-healing generation in background
      generateAndUploadCdnSnapshots().catch(() => {});
      return null;
    }

    const data: CachedLeaderboardPayload = await res.json();
    return data;
  } catch (err: any) {
    console.warn(`[cdn-cache] CDN fetch failed for leaderboard.json (${err.message}). Falling back to DB.`);
    return null;
  }
}

/**
 * Fetch contest leaderboard and questions from the Supabase Storage Smart CDN.
 *
 * @param contestId - Contest UUID
 * @returns CachedContestPayload or null on cache miss
 */
export async function getCachedContestData(contestId: string): Promise<CachedContestPayload | null> {
  if (!contestId) return null;
  const cdnUrl = getCdnStorageUrl(`contest_${contestId}.json`);

  try {
    const res = await fetch(cdnUrl, {
      next: {
        revalidate: 60, // Stale-while-revalidate every 60 seconds
        tags: [`contest-${contestId}`, 'contests'],
      },
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      // 404 means contest snapshot not yet generated; trigger self-healing generation in background
      generateAndUploadCdnSnapshots(contestId).catch(() => {});
      return null;
    }

    const data: CachedContestPayload = await res.json();
    return data;
  } catch (err: any) {
    console.warn(`[cdn-cache] CDN fetch failed for contest_${contestId}.json (${err.message}). Falling back to DB.`);
    return null;
  }
}

/**
 * Server-side helper to regenerate and upload snapshots directly from LMS using the Service Role client.
 */
export async function generateAndUploadCdnSnapshots(contestId?: string): Promise<{ success: boolean; message: string }> {
  const dbAdmin = getAdminClient();

  try {
    // 1. Generate & Upload Global Leaderboard
    const { data: allUserProfiles } = await dbAdmin
      .from('users')
      .select('id, full_name, emp_id, team')
      .neq('role', 'admin');

    const globalUserMap = new Map<string, GlobalPerformer>();
    (allUserProfiles || []).forEach((u: any) => {
      globalUserMap.set(u.id, {
        id: u.id,
        user_id: u.id,
        name: u.full_name || 'Anonymous',
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
        .not('contest_id', 'is', null)
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
      .sort((a, b) => (b.score - a.score) || (b.solved - a.solved));

    const leaderboardPayload: CachedLeaderboardPayload = {
      updated_at: new Date().toISOString(),
      performers: globalPerformers,
    };

    // Upload leaderboard
    await dbAdmin.storage
      .from(BUCKET_NAME)
      .upload('leaderboard.json', Buffer.from(JSON.stringify(leaderboardPayload)), {
        contentType: 'application/json',
        cacheControl: '180',
        upsert: true,
      });

    // 2. If contestId is specified, also refresh the contest snapshot
    if (contestId) {
      const { data: contest } = await dbAdmin
        .from('contests')
        .select('id, title, hackerrank_slug, start_date, end_date, last_scraped_at, questions(*)')
        .eq('id', contestId)
        .single();

      if (contest) {
        const allQuestions = (contest.questions || []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const enabledQuestions = allQuestions.filter((q: any) => q.is_enabled !== false);
        const enabledQuestionIds = new Set(enabledQuestions.map((q: any) => q.id));
        const totalMaxScore = enabledQuestions.reduce((sum: number, q: any) => sum + (q.max_score || 10), 0);

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

        const assignedUserIds = new Set<string>();
        if (groupIds.length > 0) {
          const { data: gm } = await dbAdmin.from('group_members').select('user_id').in('group_id', groupIds);
          (gm || []).forEach((g: any) => assignedUserIds.add(g.user_id));
        }
        if (teams.length > 0) {
          const { data: tu } = await dbAdmin.from('users').select('id').in('team', teams);
          (tu || []).forEach((t: any) => assignedUserIds.add(t.id));
        }

        const contestLeaderMap = new Map<string, any>();
        (allUserProfiles || []).forEach((u: any) => {
          if (assignedUserIds.has(u.id)) {
            contestLeaderMap.set(u.id, {
              user_id: u.id,
              name: u.full_name || 'Anonymous',
              emp_id: u.emp_id || '—',
              team: u.team || 'N/A',
              solved: 0,
              total: enabledQuestions.length,
              score: 0,
              maxScore: totalMaxScore,
              lastActive: null,
              progress: [],
            });
          }
        });

        let contestProgressRows: any[] = [];
        let cpFrom = 0;
        while (true) {
          const { data: pageRows, error: cpErr } = await dbAdmin
            .from('progress')
            .select('user_id, question_id, status, score, max_score, last_submission_at, updated_at')
            .eq('contest_id', contestId)
            .range(cpFrom, cpFrom + pStep - 1);

          if (cpErr || !pageRows || pageRows.length === 0) break;
          contestProgressRows = contestProgressRows.concat(pageRows);
          if (pageRows.length < pStep) break;
          cpFrom += pStep;
        }

        contestProgressRows.forEach((p: any) => {
          if (!enabledQuestionIds.has(p.question_id)) return;
          const u = contestLeaderMap.get(p.user_id);
          if (u) {
            if (p.status === 'solved') u.solved++;
            u.score += p.score || 0;
            const isActive = p.status === 'solved' || p.status === 'attempted' || (p.score || 0) > 0;
            const subTime = p.last_submission_at || (isActive ? p.updated_at : null);
            if (subTime && (!u.lastActive || new Date(subTime) > new Date(u.lastActive))) {
              u.lastActive = subTime;
            }
            u.progress.push(p);
          }
        });

        const contestPayload: CachedContestPayload = {
          contest_id: contestId,
          updated_at: new Date().toISOString(),
          questions: allQuestions,
          enabled_question_count: enabledQuestions.length,
          total_max_score: totalMaxScore,
          leaderboard: Array.from(contestLeaderMap.values()).sort((a, b) => b.score - a.score),
        };

        await dbAdmin.storage
          .from(BUCKET_NAME)
          .upload(`contest_${contestId}.json`, Buffer.from(JSON.stringify(contestPayload)), {
            contentType: 'application/json',
            cacheControl: '180',
            upsert: true,
          });
      }
    }

    return { success: true, message: 'CDN cache snapshots generated and uploaded successfully.' };
  } catch (err: any) {
    console.error('[cdn-cache] Error in generateAndUploadCdnSnapshots:', err.message);
    return { success: false, message: err.message };
  }
}
