import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// POST /api/internal-training/attendance
// Admin/Manager manually adjusts or increments IT days attendance count for a trainer
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

  const { userId, newCount, action } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch current user data & auth metadata
  const { data: authUserData } = await dbAdmin.auth.admin.getUserById(userId);
  const metadata = authUserData?.user?.user_metadata || {};

  const { data: profile } = await dbAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const currentCount = profile?.it_days_count ?? metadata.it_days_count ?? 0;

  let targetCount = currentCount;
  if (action === 'increment') {
    targetCount = currentCount + 1;
  } else if (action === 'decrement') {
    targetCount = Math.max(0, currentCount - 1);
  } else if (typeof newCount === 'number') {
    targetCount = Math.max(0, newCount);
  }

  // 2. Update Supabase Auth user_metadata
  try {
    if (authUserData?.user) {
      await dbAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...metadata,
          it_days_count: targetCount,
          last_it_check_date: today,
        },
      });
    }
  } catch (authErr) {
    console.error('Error updating auth metadata for attendance:', authErr);
  }

  // 3. Update public.users table
  try {
    await dbAdmin
      .from('users')
      .update({
        it_days_count: targetCount,
        last_it_check_date: today,
      })
      .eq('id', userId);
  } catch (dbErr) {
    // Column might be in schema or added via migration
  }

  return NextResponse.json({
    success: true,
    userId,
    newCount: targetCount,
    message: `Updated IT Days count to ${targetCount} days.`,
  });
}
