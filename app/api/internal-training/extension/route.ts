import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// POST /api/internal-training/extension
// Admin/Manager manually extends plan duration for a specific trainer
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, roadmapId, extraDays } = await request.json();

  if (!userId || !roadmapId || typeof extraDays !== 'number' || extraDays <= 0) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();

  const { data: existing } = await dbAdmin
    .from('it_trainer_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();

  const currentExtended = existing?.extended_days || 0;
  const currentCount = existing?.extension_count || 0;
  const newExtended = currentExtended + extraDays;
  const newCount = currentCount + 1;

  let progress = null;
  if (existing) {
    const { data: updated } = await dbAdmin
      .from('it_trainer_progress')
      .update({
        extended_days: newExtended,
        extension_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    progress = updated;
  } else {
    const { data: created } = await dbAdmin
      .from('it_trainer_progress')
      .insert({
        user_id: userId,
        roadmap_id: roadmapId,
        started_at: new Date().toISOString().split('T')[0],
        current_day: 1,
        extended_days: newExtended,
        extension_count: newCount,
      })
      .select()
      .single();
    progress = created;
  }

  // Send notification to trainer
  try {
    const { data: rm } = await dbAdmin.from('roadmaps').select('title').eq('id', roadmapId).single();
    await dbAdmin.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title: 'Plan Extended by Manager 📅',
      message: `Your manager has granted +${extraDays} extra days to complete your "${rm?.title || 'IT Roadmap'}" day plan.`,
      related_id: roadmapId,
    });
  } catch (err) {
    console.error('Error inserting extension notification:', err);
  }

  return NextResponse.json({ success: true, progress });
}
