import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { recordITAttendance } from '@/lib/it-day-counter';

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

  // Fetch fresh auth user data
  const { data: authUserData } = await supabase.auth.admin.getUserById(user.id);
  const metadata = authUserData?.user?.user_metadata || {};

  const lastCheckedDate = profile.last_it_check_date || metadata.last_it_check_date || null;
  const itDaysCount = profile.it_days_count ?? metadata.it_days_count ?? 0;

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

  try {
    const result = await recordITAttendance(user.id, Boolean(didIT));
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update IT attendance' }, { status: 500 });
  }
}

