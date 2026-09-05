import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { formatISODate } from '@/lib/it-calendar';

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
    return NextResponse.json({ needsCheck: false, itDaysCount: 0 });
  }

  const lastCheckedDate = profile.last_it_check_date || null;
  const itDaysCount = profile.it_days_count || 0;
  const needsCheck = lastCheckedDate !== today;

  return NextResponse.json({
    needsCheck,
    itDaysCount,
    lastCheckedDate,
    today,
  });
}

// POST /api/trainer/it-check
// DEPRECATED: Per-roadmap check-in is now handled via POST /api/internal-training/day-plan/[roadmapId]/trainer
// This endpoint now requires a roadmapId in the body and delegates to the per-roadmap function
export async function POST(req: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roadmapId } = await req.json();

  if (!roadmapId) {
    return NextResponse.json(
      { error: 'roadmapId is required. Use POST /api/internal-training/day-plan/[roadmapId]/trainer instead.' },
      { status: 400 }
    );
  }

  // Delegate to per-roadmap function
  const { recordITAttendance } = await import('@/lib/it-day-counter');
  try {
    const result = await recordITAttendance(user.id, roadmapId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/trainer/it-check] Error:', err);
    return NextResponse.json({ error: 'Failed to update IT attendance' }, { status: 500 });
  }
}
