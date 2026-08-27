import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Helper: verify admin/manager auth, return { user, supabase } or a 401/403 response
async function requireAdminOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return { error: NextResponse.json({ error: 'Forbidden: admin/manager only' }, { status: 403 }) };
  }

  return { user, supabase };
}

/**
 * GET /api/scrape/auto-schedule
 * Returns today's selected contests for auto-scraping (with contest title + status).
 */
export async function GET() {
  const auth = await requireAdminOrManager();
  if (auth.error) return auth.error;

  const supabase = getAdminClient();
  const todayIST = getTodayIST();

  const { data, error } = await supabase
    .from('auto_scrape_schedules')
    .select(`
      id,
      contest_id,
      date,
      is_running,
      active_job_id,
      last_triggered_at,
      created_at,
      contests(id, title, hackerrank_slug, platform, start_date, end_date)
    `)
    .eq('date', todayIST)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[auto-schedule GET] DB error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ date: todayIST, schedules: data || [] });
}

/**
 * POST /api/scrape/auto-schedule
 * Add a contest to today's auto-scrape schedule.
 * Body: { contestId: string }
 */
export async function POST(request: Request) {
  const auth = await requireAdminOrManager();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const { contestId } = body;

  if (!contestId || typeof contestId !== 'string') {
    return NextResponse.json({ error: 'contestId (string) is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const todayIST = getTodayIST();

  // Verify contest exists
  const { data: contest } = await supabase
    .from('contests')
    .select('id, title')
    .eq('id', contestId)
    .single();

  if (!contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
  }

  // Upsert: idempotent — adding same contest twice is a no-op
  const { data, error } = await supabase
    .from('auto_scrape_schedules')
    .upsert(
      {
        contest_id: contestId,
        date: todayIST,
        enabled_by: auth.user!.id,
        is_running: false,
      },
      { onConflict: 'contest_id,date' }
    )
    .select()
    .single();

  if (error) {
    console.error('[auto-schedule POST] DB error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[auto-schedule] Added contest "${contest.title}" to ${todayIST} schedule`);
  return NextResponse.json({ ok: true, schedule: data }, { status: 201 });
}

/**
 * DELETE /api/scrape/auto-schedule?contestId=...
 * Remove a contest from today's auto-scrape schedule.
 * This does NOT cancel an in-progress job — use /api/scrape/auto-cron/cancel for that.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdminOrManager();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get('contestId');

  if (!contestId) {
    return NextResponse.json({ error: 'contestId query parameter is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const todayIST = getTodayIST();

  const { error } = await supabase
    .from('auto_scrape_schedules')
    .delete()
    .eq('contest_id', contestId)
    .eq('date', todayIST);

  if (error) {
    console.error('[auto-schedule DELETE] DB error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[auto-schedule] Removed contestId=${contestId} from ${todayIST} schedule`);
  return NextResponse.json({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date string in IST (Asia/Kolkata) as YYYY-MM-DD.
 * pg stores `date` columns without timezone — we always use IST date.
 */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // → "YYYY-MM-DD"
}
