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
  }

  // 2. Update per-roadmap it_trainer_progress
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
  }

  // 3. Recalculate global IT days for this user
  //    Global = unique calendar dates checked in across any roadmap
  const { data: profile } = await dbAdmin
    .from('users')
    .select('it_days_count, last_it_check_date')
    .eq('id', userId)
    .single();

  const globalLastDate = profile?.last_it_check_date || null;
  const globalCount = profile?.it_days_count || 0;
  const newGlobalCount = globalLastDate === today ? globalCount : globalCount + 1;

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
