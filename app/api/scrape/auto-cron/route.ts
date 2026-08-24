import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/scrape/auto-cron
 *
 * Called by pg_cron (or Vercel Cron / any external scheduler) every 30 minutes.
 * Secured by x-api-key matching RAILWAY_API_KEY env var.
 *
 * Logic:
 *  1. Verify API key
 *  2. Check current IST time is within 10:00–18:00
 *  3. Check today (IST) is an allowed weekday per auto_scrape_config
 *  4. Load today's auto_scrape_schedules
 *  5. For each contest: skip if is_running; set lock; trigger scrape; store jobId; release lock
 *  6. Contests are triggered sequentially with a 5s gap to avoid request bursts
 */
export async function POST(request: Request) {
  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const providedKey = request.headers.get('x-api-key');
  const expectedKey = process.env.RAILWAY_API_KEY || process.env.SCRAPER_INGEST_API_KEY;

  if (!expectedKey) {
    console.error('[auto-cron] RAILWAY_API_KEY is not set — rejecting request');
    return NextResponse.json({ error: 'Server misconfiguration: API key not set' }, { status: 500 });
  }
  if (providedKey !== expectedKey) {
    console.error('[auto-cron] Unauthorized: invalid x-api-key');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const nowIST = getNowIST();
  const todayIST = getTodayIST();

  // ── 2. Time-window check (10:00–18:00 IST) ──────────────────────────────────
  const hourIST = nowIST.getHours();
  const minuteIST = nowIST.getMinutes();
  const totalMinutes = hourIST * 60 + minuteIST;

  if (totalMinutes < 10 * 60 || totalMinutes > 18 * 60) {
    console.log(`[auto-cron] ⏰ Outside window (${hourIST}:${String(minuteIST).padStart(2, '0')} IST). Skipping.`);
    return NextResponse.json({ skipped: 'outside_window', istTime: `${hourIST}:${minuteIST}` });
  }

  // ── 3. Day-of-week check ─────────────────────────────────────────────────────
  const { data: config } = await supabase
    .from('auto_scrape_config')
    .select('allowed_days')
    .limit(1)
    .single();

  const allowedDays: number[] = config?.allowed_days ?? [1, 2, 3, 4, 5];
  const todayDOW = nowIST.getDay(); // 0=Sun, 6=Sat

  if (!allowedDays.includes(todayDOW)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    console.log(`[auto-cron] 📅 Today (${dayNames[todayDOW]}) is not in allowed days. Skipping.`);
    return NextResponse.json({ skipped: 'day_not_configured', day: dayNames[todayDOW] });
  }

  // ── 4. Load today's schedule ─────────────────────────────────────────────────
  const { data: schedules, error: schedErr } = await supabase
    .from('auto_scrape_schedules')
    .select(`
      id,
      contest_id,
      is_running,
      active_job_id,
      contests(id, title, hackerrank_slug)
    `)
    .eq('date', todayIST);

  if (schedErr) {
    console.error('[auto-cron] Failed to load schedules:', schedErr.message);
    return NextResponse.json({ error: schedErr.message }, { status: 500 });
  }

  if (!schedules || schedules.length === 0) {
    console.log('[auto-cron] No contests scheduled for today.');
    return NextResponse.json({ ok: true, triggered: 0, message: 'No contests scheduled today' });
  }

  console.log(`[auto-cron] ▶ ${nowIST.toTimeString().slice(0, 8)} IST — Processing ${schedules.length} scheduled contest(s)`);

  const scraperUrl = (process.env.RAILWAY_SCRAPER_URL || '').trim().replace(/\/$/, '');
  const results: Array<{ contestId: string; title: string; status: string; jobId?: string; error?: string }> = [];

  // ── 5. Trigger each contest sequentially ────────────────────────────────────
  for (const schedule of schedules) {
    const contest = (schedule as any).contests;
    const contestTitle = contest?.title || schedule.contest_id;

    // Skip if another cron tick is already processing this contest
    if (schedule.is_running) {
      console.log(`[auto-cron]   ⏭  [${contestTitle}] already running (jobId: ${schedule.active_job_id}). Skipping.`);
      results.push({ contestId: schedule.contest_id, title: contestTitle, status: 'skipped_running' });
      continue;
    }

    // Set is_running lock
    await supabase
      .from('auto_scrape_schedules')
      .update({ is_running: true, active_job_id: null })
      .eq('id', schedule.id);

    try {
      console.log(`[auto-cron]   🚀 Triggering scrape for "${contestTitle}"...`);
      const jobId = await triggerContestScrape(supabase, scraperUrl, expectedKey, schedule.contest_id);

      // Store job ID + update last triggered timestamp
      await supabase
        .from('auto_scrape_schedules')
        .update({
          is_running: false,
          active_job_id: jobId || null,
          last_triggered_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      console.log(`[auto-cron]   ✅ [${contestTitle}] scrape started. jobId=${jobId}`);
      results.push({ contestId: schedule.contest_id, title: contestTitle, status: 'triggered', jobId: jobId || undefined });
    } catch (err: any) {
      console.error(`[auto-cron]   ❌ [${contestTitle}] failed: ${err.message}`);

      // Release lock even on failure
      await supabase
        .from('auto_scrape_schedules')
        .update({ is_running: false, active_job_id: null })
        .eq('id', schedule.id);

      results.push({ contestId: schedule.contest_id, title: contestTitle, status: 'error', error: err.message });
    }

    // 5s gap between contests to avoid request bursts to Railway
    if (schedules.indexOf(schedule) < schedules.length - 1) {
      await sleep(5000);
    }
  }

  const triggered = results.filter((r) => r.status === 'triggered').length;
  console.log(`[auto-cron] Done. ${triggered}/${schedules.length} contest(s) triggered.`);

  return NextResponse.json({
    ok: true,
    triggered,
    total: schedules.length,
    istTime: nowIST.toTimeString().slice(0, 8),
    results,
  });
}

// ─── Core trigger logic (mirrors /api/scrape/trigger) ─────────────────────────

async function triggerContestScrape(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').getAdminClient>,
  scraperUrl: string,
  apiKey: string,
  contestId: string
): Promise<string | null> {
  // 1. Fetch contest
  const { data: contest, error: contestErr } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single();

  if (contestErr || !contest) throw new Error(`Contest not found: ${contestId}`);

  // 2. Fetch enabled questions
  let questions: any[] = [];
  const { data: filteredQs, error: qErr } = await supabase
    .from('questions')
    .select('id, slug, title, max_score, domain, is_enabled')
    .eq('contest_id', contestId)
    .neq('is_enabled', false);

  if (qErr) {
    // Fallback if is_enabled column not available
    const { data: allQs } = await supabase
      .from('questions')
      .select('id, slug, title, max_score, domain')
      .eq('contest_id', contestId);
    questions = allQs || [];
  } else {
    questions = filteredQs || [];
  }

  if (questions.length === 0) throw new Error('No questions found for this contest');

  // 3. Fetch assignments
  const { data: assignments } = await supabase
    .from('contest_assignments')
    .select('group_id, team')
    .eq('contest_id', contestId);

  const groupIds: string[] = [];
  const teams: string[] = [];
  (assignments || []).forEach((a: any) => {
    if (a.group_id) groupIds.push(a.group_id);
    if (a.team) teams.push(a.team);
  });

  if (groupIds.length === 0 && teams.length === 0) {
    throw new Error('No groups or teams assigned to this contest');
  }

  // 4. Collect assigned users
  const userIds = new Set<string>();
  if (groupIds.length > 0) {
    const { data: gm } = await supabase.from('group_members').select('user_id').in('group_id', groupIds);
    (gm || []).forEach((g: any) => userIds.add(g.user_id));
  }
  if (teams.length > 0) {
    const { data: tu } = await supabase.from('users').select('id').in('team', teams);
    (tu || []).forEach((u: any) => userIds.add(u.id));
  }

  if (userIds.size === 0) throw new Error('No users found in assigned groups/teams');

  // 5. Fetch valid HackerRank IDs (exclude admins)
  const { data: users } = await supabase
    .from('users')
    .select('id, hackerrank_id')
    .in('id', Array.from(userIds))
    .neq('role', 'admin')
    .not('hackerrank_id', 'is', null);

  const validUsers = (users || []).filter((u: any) => u.hackerrank_id?.trim());
  if (validUsers.length === 0) throw new Error('No users with HackerRank IDs found');

  // 6. Auto-register contest in scraper if needed, then trigger
  if (!scraperUrl) throw new Error('RAILWAY_SCRAPER_URL is not configured');

  const scraperQuestions = questions.map((q: any) => ({
    slug: q.slug,
    questionName: q.title,
    maxScore: q.max_score || 10,
  }));

  const payload = {
    contestId,
    contestSlug: contest.hackerrank_slug,
    questions: scraperQuestions,
    users: validUsers.map((u: any) => ({ user_id: u.id, hackerrank_id: u.hackerrank_id })),
  };

  let res = await fetch(`${scraperUrl}/scrape/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(payload),
  });

  // Auto-heal: register contest if not found
  if (!res.ok) {
    const errText = await res.text();
    if (errText.includes('not found') || errText.includes('Create it first')) {
      const regRes = await fetch(`${scraperUrl}/scrape/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ slug: contest.hackerrank_slug, contestId }),
      });
      if (regRes.ok) {
        res = await fetch(`${scraperUrl}/scrape/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify(payload),
        });
      }
    }

    if (!res.ok) {
      const finalErr = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Scraper returned ${res.status}: ${finalErr}`);
    }
  }

  const result = await res.json();
  return result.jobId || null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date object representing current time in IST. */
function getNowIST(): Date {
  const utc = new Date();
  // IST = UTC + 5:30
  return new Date(utc.getTime() + (5 * 60 + 30) * 60 * 1000);
}

/** Returns today's date string in IST as YYYY-MM-DD. */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
