import { getAdminClient } from '@/lib/supabase/admin';
import { formatISODate } from '@/lib/it-calendar';
import { ITAttendanceLocation } from '@/lib/types';

export interface ITAttendanceResult {
  success: boolean;
  roadmapDaysLogged: number;
  globalItDays: number;
  alreadyCheckedInToday: boolean;
  today: string;
  location?: ITAttendanceLocation | null;
}

/**
 * Records per-roadmap IT attendance for a trainer.
 * - Increments `it_days_logged` on the specific it_trainer_progress row
 * - Sets `last_check_in_date = today` on that row
 * - Saves `location` on the it_trainer_progress row
 * - Recalculates global `users.it_days_count` as count of unique dates
 *   across ALL of the user's it_trainer_progress rows
 */
export async function recordITAttendance(
  userId: string,
  roadmapId: string,
  location?: ITAttendanceLocation | null,
): Promise<ITAttendanceResult> {
  const supabase = getAdminClient();
  const today = formatISODate(new Date());

  // 1. Fetch the specific progress row for this user + roadmap
  let { data: progress } = await supabase
    .from('it_trainer_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();

  if (!progress) {
    // Auto-create initial it_trainer_progress record if missing (self-healing robustness)
    const { data: newProg, error: insertErr } = await supabase
      .from('it_trainer_progress')
      .insert({
        user_id: userId,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: 0,
        it_days_logged: 0,
        last_check_in_date: null,
        extended_days: 0,
        extension_count: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insertErr) {
      console.warn('[recordITAttendance] Progress record auto-creation notice:', insertErr);
    }
    progress = newProg || {
      user_id: userId,
      roadmap_id: roadmapId,
      started_at: today,
      current_day: 0,
      it_days_logged: 0,
      last_check_in_date: null,
      extended_days: 0,
      extension_count: 0,
    };
  }

  const lastCheckIn = progress.last_check_in_date || null;
  const currentDaysLogged = progress.it_days_logged || 0;
  const alreadyCheckedInToday = Boolean(lastCheckIn && lastCheckIn.slice(0, 10) === today);

  let newDaysLogged = currentDaysLogged;
  if (!alreadyCheckedInToday) {
    newDaysLogged = currentDaysLogged + 1;
  }

  // 2. Update the per-roadmap progress row
  const updatePayload: Record<string, any> = {
    it_days_logged: newDaysLogged,
    current_day: newDaysLogged,
    last_check_in_date: today,
    updated_at: new Date().toISOString(),
  };

  if (location) {
    updatePayload.location = location;
  }

  let { error: updateErr } = await supabase
    .from('it_trainer_progress')
    .update(updatePayload)
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId);

  // Fallback if column 'location' doesn't exist yet in remote schema
  if (updateErr && (updateErr.message?.includes('location') || updateErr.code === '42703' || updateErr.code === 'PGRST204')) {
    console.warn('[recordITAttendance] location column missing in it_trainer_progress, falling back without location...');
    delete updatePayload.location;
    const retryRes = await supabase
      .from('it_trainer_progress')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('roadmap_id', roadmapId);
    updateErr = retryRes.error;
  }

  if (updateErr) {
    console.error('[recordITAttendance] Error updating it_trainer_progress:', updateErr);
  }

  // 3. Recalculate global IT days count (Two-tier attendance invariant):
  // Global IT days (users.it_days_count) increments by 1 on the first check-in of the calendar day across ANY roadmap.
  // If a trainer checks in on multiple roadmaps on the same calendar day, each roadmap gets its check-in recorded,
  // but global IT days increments only once for that day.
  const [allProgressRes, profileRes, authUserRes] = await Promise.all([
    supabase
      .from('it_trainer_progress')
      .select('roadmap_id, it_days_logged, last_check_in_date')
      .eq('user_id', userId),
    supabase
      .from('users')
      .select('it_days_count, last_it_check_date')
      .eq('id', userId)
      .single(),
    supabase.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } })),
  ]);

  const allProgressFull = allProgressRes.data || [];
  const maxRoadmapDays = Math.max(
    ...allProgressFull.map((p: any) => p.it_days_logged || 0),
    newDaysLogged,
    0
  );

  const profile = profileRes.data;
  const authMetadata = authUserRes?.data?.user?.user_metadata || {};
  const previousMaxRoadmapDays = Math.max(
    currentDaysLogged,
    ...allProgressFull
      .filter((p: any) => p.roadmap_id !== roadmapId)
      .map((p: any) => p.it_days_logged || 0),
    0
  );
  const baselineGlobalCount = Math.max(
    profile?.it_days_count || 0,
    authMetadata?.it_days_count || 0,
    previousMaxRoadmapDays
  );

  // Check whether global IT attendance was ALREADY counted today:
  // 1. Was this roadmap already checked in today prior to this call? (alreadyCheckedInToday)
  // 2. Was ANY OTHER roadmap checked in today?
  const otherRoadmapsCheckedInToday = allProgressFull.some(
    (p: any) => p.roadmap_id !== roadmapId && p.last_check_in_date && p.last_check_in_date.slice(0, 10) === today
  );
  // 3. Did user check in via modal "Yes" today?
  const modalAttendanceToday = Boolean(
    authMetadata.last_it_attendance_date && authMetadata.last_it_attendance_date.slice(0, 10) === today
  );

  const alreadyCountedGlobalToday = alreadyCheckedInToday || otherRoadmapsCheckedInToday || modalAttendanceToday;

  const incrementedGlobal = alreadyCountedGlobalToday ? baselineGlobalCount : baselineGlobalCount + 1;
  const newGlobalCount = Math.max(incrementedGlobal, maxRoadmapDays);

  // Update global user record
  await supabase
    .from('users')
    .update({
      it_days_count: newGlobalCount,
      last_it_check_date: today,
    })
    .eq('id', userId);

  // Update auth metadata
  try {
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...authMetadata,
        it_days_count: newGlobalCount,
        last_it_check_date: today,
        last_it_attendance_date: today,
      },
    });
  } catch (err) {
    console.error('Error updating auth metadata for it_days_count:', err);
  }

  return {
    success: true,
    roadmapDaysLogged: newDaysLogged,
    globalItDays: newGlobalCount,
    alreadyCheckedInToday,
    today,
  };
}
