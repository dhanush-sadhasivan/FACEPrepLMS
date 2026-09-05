import { getAdminClient } from '@/lib/supabase/admin';
import { isRecordSolved } from '@/lib/utils';

export interface GlobalPerformer {
  id?: string;
  user_id?: string;
  name: string;
  emp_id?: string;
  team?: string;
  score: number;
  solved: number;
  rank?: number;
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
export function getCdnStorageUrl(fileName: string, bustCache: boolean = true): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const url = `${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
  return bustCache ? `${url}?t=${Date.now()}` : url;
}

/**
 * Fetch the global leaderboard from the Supabase Storage Smart CDN.
 * Uses no-store so every render gets the freshest uploaded file.
 *
 * @returns CachedLeaderboardPayload or null on cache miss
 */
export async function getCachedGlobalLeaderboard(): Promise<CachedLeaderboardPayload | null> {
  const cdnUrl = getCdnStorageUrl('leaderboard.json');

  try {
    const res = await fetch(cdnUrl, {
      cache: 'no-store',        // Always fetch fresh — the CDN file is the cache
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
 * Uses no-store so every render gets the freshest uploaded file immediately
 * without waiting for Next.js data-cache revalidation.
 *
 * @param contestId - Contest UUID
 * @returns CachedContestPayload or null on cache miss
 */
export async function getCachedContestData(contestId: string): Promise<CachedContestPayload | null> {
  if (!contestId) return null;
  const cdnUrl = getCdnStorageUrl(`contest_${contestId}.json`);

  try {
    const res = await fetch(cdnUrl, {
      cache: 'no-store',        // Always fetch fresh — the CDN file is the cache
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
 * Fetch pre-computed roadmap analytics snapshot from Supabase Storage CDN.
 */
export async function getCachedRoadmapAnalytics(): Promise<any[] | null> {
  const cdnUrl = getCdnStorageUrl('roadmap_analytics.json');
  try {
    const res = await fetch(cdnUrl, {
      next: { revalidate: 60, tags: ['roadmaps', 'roadmap-analytics'] },
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.roadmaps || null;
  } catch {
    return null;
  }
}

/**
 * Fetch pre-computed internal training trainer overview snapshot from Supabase Storage CDN.
 */
/**
 * Fetch pre-computed internal training trainer overview snapshot from Supabase Storage CDN.
 * Disabled: IT trainer overview is not published to public CDN to prevent PII exposure.
 */
export async function getCachedITOverview(): Promise<any[] | null> {
  return null;
}

/**
 * Server-side helper to regenerate and upload snapshots directly from LMS using the Service Role client.
 */
export async function generateAndUploadCdnSnapshots(contestId?: string): Promise<{ success: boolean; message: string }> {
  const dbAdmin = getAdminClient();

  try {
    // 1. Generate & Upload Global Leaderboard (Sanitized: display-safe fields only, NO emp_id, email, or UUIDs)
    const uStep = 1000;
    let uFrom = 0;
    let allUserProfiles: any[] = [];
    while (true) {
      const { data: uPage } = await dbAdmin
        .from('users')
        .select('id, full_name, emp_id, team, hackerrank_id, leetcode_id')
        .neq('role', 'admin')
        .order('id', { ascending: true })
        .range(uFrom, uFrom + uStep - 1);
      if (!uPage || uPage.length === 0) break;
      allUserProfiles = allUserProfiles.concat(uPage);
      if (uPage.length < uStep) break;
      uFrom += uStep;
    }

    const globalUserMap = new Map<string, any>();
    (allUserProfiles || []).forEach((u: any) => {
      globalUserMap.set(u.id, {
        id: u.id,
        name: u.full_name || 'Anonymous',
        team: u.team || 'N/A',
        score: 0,
        solved: 0,
      });
    });

    let allProgressRows: any[] = [];
    let pFrom = 0;
    const pStep = 1000;
    let progressFetchFailed = false;
    while (true) {
      const { data: pageRows, error: pErr } = await dbAdmin
        .from('progress')
        .select('user_id, question_id, score, status, max_score')
        .or('score.gt.0,status.eq.solved')
        .order('id', { ascending: true })
        .range(pFrom, pFrom + pStep - 1);

      if (pErr) {
        console.error('[cdn-cache] DB error fetching progress rows — aborting snapshot generation:', pErr.message);
        progressFetchFailed = true;
        break;
      }
      if (!pageRows || pageRows.length === 0) break;
      allProgressRows = allProgressRows.concat(pageRows);
      if (pageRows.length < pStep) break;
      pFrom += pStep;
    }

    // If progress fetch failed on the first page, abort to avoid uploading corrupted (all-zeros) data
    if (progressFetchFailed && allProgressRows.length === 0) {
      return { success: false, message: 'Aborted: DB error fetching progress data — refusing to upload corrupted snapshot.' };
    }

    // Deduplicate by (user_id, question_id) and aggregate scores
    const userQuestionMap = new Map<string, { user_id: string; score: number; isSolved: boolean }>();
    allProgressRows.forEach((p: any) => {
      if (!p.user_id || !p.question_id) return;
      const key = `${p.user_id}:${p.question_id}`;
      const existing = userQuestionMap.get(key);
      const isSolved = isRecordSolved(p);
      if (!existing) {
        userQuestionMap.set(key, {
          user_id: p.user_id,
          score: p.score || 0,
          isSolved,
        });
      } else {
        existing.score = Math.max(existing.score, p.score || 0);
        if (isSolved) existing.isSolved = true;
      }
    });

    userQuestionMap.forEach((item) => {
      const entry = globalUserMap.get(item.user_id);
      if (entry) {
        entry.score += item.score;
        if (item.isSolved) entry.solved++;
      }
    });

    // Strip internal database UUIDs (id, user_id), emails, and emp_id from public CDN payload
    const globalPerformers = Array.from(globalUserMap.values())
      .sort((a, b) => (b.score - a.score) || (b.solved - a.solved) || (a.name || '').localeCompare(b.name || ''))
      .map((entry, idx) => ({
        rank: idx + 1,
        name: entry.name,
        team: entry.team,
        score: entry.score,
        solved: entry.solved,
      }));

    const leaderboardPayload: CachedLeaderboardPayload = {
      updated_at: new Date().toISOString(),
      performers: globalPerformers,
    };

    // Upload leaderboard
    await dbAdmin.storage
      .from(BUCKET_NAME)
      .upload('leaderboard.json', Buffer.from(JSON.stringify(leaderboardPayload)), {
        contentType: 'application/json',
        cacheControl: '0',
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
          if (a.team && a.team.trim() !== '') teams.push(a.team.trim());
        });

        const assignedUserIds = new Set<string>();
        if (groupIds.length > 0) {
          const { data: gm } = await dbAdmin
            .from('group_members')
            .select('user_id, users!inner(role)')
            .in('group_id', groupIds)
            .neq('users.role', 'admin');
          (gm || []).forEach((g: any) => {
            if (g.user_id) assignedUserIds.add(g.user_id);
          });
        }
        if (teams.length > 0) {
          const { data: tu } = await dbAdmin
            .from('users')
            .select('id')
            .in('team', teams)
            .neq('role', 'admin');
          (tu || []).forEach((t: any) => {
            if (t.id) assignedUserIds.add(t.id);
          });
        }

        const contestLeaderMap = new Map<string, any>();
        (allUserProfiles || []).forEach((u: any) => {
          if (assignedUserIds.has(u.id)) {
            contestLeaderMap.set(u.id, {
              user_id: u.id,
              name: u.full_name || 'Anonymous',
              team: u.team || 'N/A',
              hackerrank_id: u.hackerrank_id || null,
              leetcode_id: u.leetcode_id || null,
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
            .order('id', { ascending: true })
            .range(cpFrom, cpFrom + pStep - 1);

          if (cpErr) {
            console.error(`[cdn-cache] DB error fetching contest progress for ${contestId}:`, cpErr.message);
            break;
          }
          if (!pageRows || pageRows.length === 0) break;
          contestProgressRows = contestProgressRows.concat(pageRows);
          if (pageRows.length < pStep) break;
          cpFrom += pStep;
        }

        // Deduplicate progress rows by user_id:question_id (highest score, strict solve check)
        const contestUserQuestionMap = new Map<string, any>();
        contestProgressRows.forEach((p: any) => {
          if (!p.user_id || !p.question_id || !enabledQuestionIds.has(p.question_id)) return;
          const key = `${p.user_id}:${p.question_id}`;
          const isSolved = isRecordSolved(p);
          const score = Number(p.score) || 0;
          const maxScore = Number(p.max_score) || 10;
          const isActive = isSolved || p.status === 'attempted' || score > 0;
          const subTime = p.last_submission_at || (isActive ? p.updated_at : null);

          const existing = contestUserQuestionMap.get(key);
          if (!existing) {
            contestUserQuestionMap.set(key, {
              ...p,
              score,
              max_score: maxScore,
              isSolved,
              isActive,
              subTime,
            });
          } else {
            existing.score = Math.max(existing.score, score);
            if (isSolved) existing.isSolved = true;
            if (isActive) existing.isActive = true;
            if (subTime && (!existing.subTime || new Date(subTime) > new Date(existing.subTime))) {
              existing.subTime = subTime;
            }
          }
        });

        contestUserQuestionMap.forEach((p: any) => {
          const u = contestLeaderMap.get(p.user_id);
          if (u) {
            if (p.isSolved) u.solved++;
            u.score += p.score;
            if (p.subTime && (!u.lastActive || new Date(p.subTime) > new Date(u.lastActive))) {
              u.lastActive = p.subTime;
            }
            u.progress.push({
              question_id: p.question_id,
              status: p.isSolved ? 'solved' : (p.score > 0 || p.status === 'attempted' ? 'attempted' : (p.status || 'unattempted')),
              score: p.score,
              max_score: p.max_score,
              last_submission_at: p.last_submission_at,
            });
          }
        });

        // Sanitize leaderboard for public CDN snapshot (strictly no internal user_id, emp_id, or email)
        const sanitizedLeaderboard = Array.from(contestLeaderMap.values())
          .sort((a, b) => (b.score - a.score) || (b.solved - a.solved) || (a.name || '').localeCompare(b.name || ''))
          .map((entry, idx) => ({
            rank: idx + 1,
            name: entry.name,
            team: entry.team,
            hackerrank_id: entry.hackerrank_id || null,
            leetcode_id: entry.leetcode_id || null,
            solved: entry.solved,
            total: entry.total,
            score: entry.score,
            maxScore: entry.maxScore,
            lastActive: entry.lastActive,
            progress: (entry.progress || []).map((p: any) => ({
              question_id: p.question_id,
              status: p.status,
              score: p.score,
              max_score: p.max_score,
              last_submission_at: p.last_submission_at,
            })),
          }));

        const sanitizedQuestions = (allQuestions || []).map((q: any) => ({
          id: q.id,
          slug: q.slug,
          title: q.title,
          difficulty: q.difficulty,
          domain: q.domain,
          max_score: q.max_score,
          order_index: q.order_index,
          is_enabled: q.is_enabled,
        }));

        const contestPayload: CachedContestPayload = {
          contest_id: contestId,
          updated_at: new Date().toISOString(),
          questions: sanitizedQuestions,
          enabled_question_count: enabledQuestions.length,
          total_max_score: totalMaxScore,
          leaderboard: sanitizedLeaderboard,
        };

        await dbAdmin.storage
          .from(BUCKET_NAME)
          .upload(`contest_${contestId}.json`, Buffer.from(JSON.stringify(contestPayload)), {
            contentType: 'application/json',
            cacheControl: '0',
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
