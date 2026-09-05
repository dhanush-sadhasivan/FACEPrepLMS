import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Helper: verify admin/manager auth
async function requireAdminOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return { error: NextResponse.json({ error: 'Forbidden: admin/manager only' }, { status: 403 }) };
  }

  return { user };
}

/**
 * GET /api/scrape/auto-config
 * Returns the global auto-scrape day configuration.
 * Response: { allowed_days: number[] }  — 0=Sun, 1=Mon, ..., 6=Sat
 */
export async function GET() {
  const auth = await requireAdminOrManager();
  if (auth.error) return auth.error;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('auto_scrape_config')
    .select('id, allowed_days, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[auto-config GET] DB error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch auto-scrape config' }, { status: 500 });
  }

  return NextResponse.json({ allowed_days: data?.allowed_days ?? [1, 2, 3, 4, 5] });
}

/**
 * PATCH /api/scrape/auto-config
 * Updates which days of the week auto-scraping is allowed.
 * Body: { allowed_days: number[] }  — 0=Sun, 1=Mon, ..., 6=Sat
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminOrManager();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const { allowed_days } = body;

  if (
    !Array.isArray(allowed_days) ||
    allowed_days.some((d: any) => typeof d !== 'number' || d < 0 || d > 6)
  ) {
    return NextResponse.json(
      { error: 'allowed_days must be an array of integers 0–6 (0=Sun, 6=Sat)' },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  // Update the singleton row (there's always exactly one)
  const { data: existing } = await supabase
    .from('auto_scrape_config')
    .select('id')
    .limit(1)
    .single();

  let result;
  if (existing) {
    result = await supabase
      .from('auto_scrape_config')
      .update({ allowed_days, updated_by: auth.user!.id, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('auto_scrape_config')
      .insert({ allowed_days, updated_by: auth.user!.id })
      .select()
      .single();
  }

  if (result.error) {
    console.error('[auto-config PATCH] DB error:', result.error.message);
    return NextResponse.json({ error: 'Failed to update auto-scrape config' }, { status: 500 });
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  console.log(`[auto-config] Updated allowed_days: [${allowed_days.map((d: number) => dayNames[d]).join(', ')}]`);
  return NextResponse.json({ ok: true, allowed_days: result.data.allowed_days });
}
