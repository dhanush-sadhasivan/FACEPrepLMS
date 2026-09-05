import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { formatISODate } from '@/lib/it-calendar';

// POST /api/internal-training/attendance
// Admin/Manager manually adjusts IT days for a trainer on a SPECIFIC roadmap
export async function POST(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabaseServer
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden: Only managers and admins can adjust attendance.' }, { status: 403 });
  }

  const { userId, roadmapId, newCount, action } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!roadmapId) {
    return NextResponse.json({ error: 'roadmapId is required' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();
  const today = formatISODate(new Date());

  // 1. Fetch per-roadmap progress
  const { data: progress } = await dbAdmin
    .from('it_trainer_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();

  const currentCount = progress?.it_days_logged || 0;

  let targetCount = currentCount;
  if (action === 'increment') {
    targetCount = currentCount + 1;
  } else if (action === 'decrement') {
    targetCount = Math.max(0, currentCount - 1);
  } else if (typeof newCount === 'number') {
    targetCount = Math.max(0, newCount);
  } else if (action === 'set' && newCount !== undefined && newCount !== null) {
    targetCount = Math.max(0, Number(newCount) || 0);
  }

  // 2. Update or insert per-roadmap it_trainer_progress
  if (progress) {
    await dbAdmin
      .from('it_trainer_progress')
      .update({
        it_days_logged: targetCount,
        current_day: targetCount,
        last_check_in_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('roadmap_id', roadmapId);
  } else {
    await dbAdmin
      .from('it_trainer_progress')
      .insert({
        user_id: userId,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: targetCount,
        it_days_logged: targetCount,
        last_check_in_date: today,
        extended_days: 0,
        extension_count: 0,
        updated_at: new Date().toISOString(),
      });
  }

  // 3. Recalculate global IT days for this user across all assigned roadmaps (two-tier contract)
  const { data: allUserItProgress } = await dbAdmin
    .from('it_trainer_progress')
    .select('it_days_logged')
    .eq('user_id', userId);

  const maxRoadmapDays = Math.max(
    ...((allUserItProgress || []).map((p: any) => p.it_days_logged || 0)),
    targetCount,
    0
  );

  const { data: userProfile } = await dbAdmin
    .from('users')
    .select('it_days_count, last_it_check_date')
    .eq('id', userId)
    .single();

  const currentGlobal = userProfile?.it_days_count || 0;
  let newGlobalCount = Math.max(currentGlobal, maxRoadmapDays);
  if (action === 'decrement') {
    newGlobalCount = Math.max(0, maxRoadmapDays);
  }

  await dbAdmin
    .from('users')
    .update({
      it_days_count: newGlobalCount,
      last_it_check_date: today,
    })
    .eq('id', userId);

  // Update auth metadata
  try {
    const { data: authUserData } = await dbAdmin.auth.admin.getUserById(userId);
    const metadata = authUserData?.user?.user_metadata || {};
    await dbAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        it_days_count: newGlobalCount,
        last_it_check_date: today,
        last_it_attendance_date: today,
      },
    });
  } catch (authErr) {
    console.error('Error updating auth metadata for attendance:', authErr);
  }

  return NextResponse.json({
    success: true,
    userId,
    roadmapId,
    roadmapDaysLogged: targetCount,
    globalItDays: newGlobalCount,
    message: `Updated roadmap IT Days to ${targetCount} days.`,
  });
}
