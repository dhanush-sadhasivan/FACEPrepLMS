import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // Try to fetch user record
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Only trainers are prompted for IT attendance check
  if (profile.role !== 'trainer') {
    return NextResponse.json({ needsCheck: false, itDaysCount: 0 });
  }

  const lastCheckedDate = profile.last_it_check_date || user.user_metadata?.last_it_check_date || null;
  const itDaysCount = profile.it_days_count ?? user.user_metadata?.it_days_count ?? 0;

  const needsCheck = lastCheckedDate !== today;

  return NextResponse.json({
    needsCheck,
    itDaysCount,
    lastCheckedDate,
    today,
  });
}

export async function POST(req: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { didIT } = await req.json();
  const supabase = getAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const currentCount = profile?.it_days_count ?? user.user_metadata?.it_days_count ?? 0;
  const newCount = didIT ? currentCount + 1 : currentCount;

  // Try updating users table columns (or user_metadata as fallback)
  try {
    await supabase
      .from('users')
      .update({
        it_days_count: newCount,
        last_it_check_date: today,
      })
      .eq('id', user.id);
  } catch {
    // ignore if columns don't exist yet
  }

  // Always update Supabase auth user_metadata as well for multi-session sync
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      it_days_count: newCount,
      last_it_check_date: today,
    },
  });

  return NextResponse.json({
    success: true,
    newCount,
    today,
  });
}
