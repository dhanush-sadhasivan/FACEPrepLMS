import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { formatISODate } from '@/lib/it-calendar';
import { recordITAttendance } from '@/lib/it-day-counter';

// GET /api/trainer/it-check
// Returns global IT attendance status for the current trainer (used by dashboard header)
export async function GET() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const today = formatISODate(new Date());

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.role !== 'trainer') {
    return NextResponse.json({
      needsCheck: false,
      itDaysCount: 0,
      today,
      userId: user.id,
    });
  }

  const authMetadata = user.user_metadata || {};
  const lastCheckedDate = profile.last_it_check_date || authMetadata.last_it_check_date || null;
  const itDaysCount = Math.max(profile.it_days_count || 0, authMetadata.it_days_count || 0);
  const isCheckedToday = Boolean(lastCheckedDate && lastCheckedDate.slice(0, 10) === today);
  const needsCheck = !isCheckedToday;

  return NextResponse.json({
    needsCheck,
    itDaysCount,
    lastCheckedDate,
    today,
    userId: user.id,
  });
}

// POST /api/trainer/it-check
// Handles daily IT check response from modal: { didIT: boolean, roadmapId?: string, location?: any }
// Also supports optional delegation to per-roadmap check-in if roadmapId is provided
export async function POST(req: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbAdmin = getAdminClient();
  const today = formatISODate(new Date());

  const body = await req.json().catch(() => ({}));
  const { didIT, roadmapId, location } = body;

  // If roadmapId is provided and didIT is not explicitly false, delegate to per-roadmap function
  if (roadmapId && didIT !== false) {
    try {
      const result = await recordITAttendance(user.id, roadmapId, location || null);
      return NextResponse.json({
        ...result,
        newCount: result.globalItDays,
      });
    } catch (err: any) {
      console.error('[POST /api/trainer/it-check] Error:', err);
      return NextResponse.json({ error: 'Failed to update IT attendance' }, { status: 500 });
    }
  }

  try {
    // 1. Fetch current profile, all progress rows, and auth metadata in parallel
    const [profileRes, progressRes, authUserRes] = await Promise.all([
      dbAdmin.from('users').select('it_days_count, last_it_check_date').eq('id', user.id).single(),
      dbAdmin.from('it_trainer_progress').select('roadmap_id, it_days_logged, last_check_in_date').eq('user_id', user.id),
      dbAdmin.auth.admin.getUserById(user.id).catch(() => ({ data: { user: null } })),
    ]);

    const profile = profileRes.data;
    const progressList = progressRes.data || [];
    const authMetadata = authUserRes?.data?.user?.user_metadata || user.user_metadata || {};

    const maxRoadmapDays = Math.max(
      ...progressList.map((p: any) => p.it_days_logged || 0),
      0
    );
    const baselineGlobalCount = Math.max(
      profile?.it_days_count || 0,
      authMetadata?.it_days_count || 0,
      maxRoadmapDays
    );

    // Check whether global IT attendance was already counted today:
    // (a) Auth metadata explicitly recorded attendance today
    const authAttendanceToday = Boolean(
      authMetadata.last_it_attendance_date && authMetadata.last_it_attendance_date.slice(0, 10) === today
    );
    // (b) Any roadmap was checked in today
    const anyRoadmapCheckedInToday = progressList.some(
      (p: any) => p.last_check_in_date && p.last_check_in_date.slice(0, 10) === today
    );

    const alreadyAttendanceCountedToday = authAttendanceToday || anyRoadmapCheckedInToday;

    let newGlobalCount = baselineGlobalCount;
    if (didIT) {
      if (!alreadyAttendanceCountedToday) {
        newGlobalCount = baselineGlobalCount + 1;
      }
    }

    // 2. Update users table with last_it_check_date and harmonized it_days_count
    const updateData: Record<string, any> = {
      last_it_check_date: today,
      it_days_count: newGlobalCount,
    };

    const { error: updateErr } = await dbAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateErr) {
      console.error('[POST /api/trainer/it-check] Error updating user:', updateErr);
      return NextResponse.json({ error: 'Failed to update IT check status' }, { status: 500 });
    }

    // 3. Synchronize auth metadata
    try {
      await dbAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...authMetadata,
          it_days_count: newGlobalCount,
          last_it_check_date: today,
          ...(didIT ? { last_it_attendance_date: today } : {}),
        },
      });
    } catch (authErr) {
      console.error('[POST /api/trainer/it-check] Error updating auth metadata:', authErr);
    }

    return NextResponse.json({
      success: true,
      didIT: Boolean(didIT),
      newCount: newGlobalCount,
      alreadyCheckedInToday: alreadyAttendanceCountedToday,
      today,
    });
  } catch (err: any) {
    console.error('[POST /api/trainer/it-check] Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to record IT check' }, { status: 500 });
  }
}
