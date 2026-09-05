import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/scrape/auto-cron/cancel?contestId=...
 *
 * Stops an in-progress auto-scrape job for a specific contest:
 *   1. Clears the is_running lock in auto_scrape_schedules so the next cron tick skips it
 *   2. The in-flight Railway job completes naturally (Railway has no hard-kill API)
 *      — the results are still written to DB which is harmless
 *
 * Requires admin/manager role.
 */
export async function DELETE(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseServer
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden: admin/manager only' }, { status: 403 });
  }

  // ── Params ───────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get('contestId');

  if (!contestId) {
    return NextResponse.json({ error: 'contestId query parameter is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // ── Fetch current schedule row ───────────────────────────────────────────────
  const { data: schedule } = await supabase
    .from('auto_scrape_schedules')
    .select('id, is_running, active_job_id')
    .eq('contest_id', contestId)
    .eq('date', todayIST)
    .single();

  if (!schedule) {
    return NextResponse.json(
      { error: 'No auto-scrape schedule found for this contest today' },
      { status: 404 }
    );
  }

  if (!schedule.is_running) {
    return NextResponse.json({ ok: true, message: 'Job was not running — nothing to cancel' });
  }

  // ── Release the is_running lock ──────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('auto_scrape_schedules')
    .update({ is_running: false, active_job_id: null })
    .eq('id', schedule.id);

  if (updateErr) {
    console.error('[auto-cron/cancel] Failed to release lock:', updateErr.message);
    return NextResponse.json({ error: 'Failed to cancel auto-scrape job' }, { status: 500 });
  }

  console.log(
    `[auto-cron/cancel] Released is_running lock for contestId=${contestId}` +
    (schedule.active_job_id ? ` (Railway jobId: ${schedule.active_job_id} will finish naturally)` : '')
  );

  return NextResponse.json({
    ok: true,
    message: 'Scrape job cancelled. The next cron tick will skip this contest.',
    note: schedule.active_job_id
      ? `Railway job ${schedule.active_job_id} is still finishing in the background.`
      : undefined,
  });
}
