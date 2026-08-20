import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = process.env.RAILWAY_API_KEY;
  
  if (apiKey && expectedKey && apiKey === expectedKey) {
    // Service call - proceed
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (caller?.role !== 'admin' && caller?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const contestId = searchParams.get('contestId');

    revalidatePath('/dashboard');
    revalidatePath('/contests');
    revalidateTag('leaderboard', 'max');
    revalidateTag('global-stats', 'max');
    revalidateTag('contests', 'max');

    if (contestId) {
      revalidatePath(`/contests/${contestId}`);
      revalidateTag(`contest-${contestId}`, 'max');
    }

    console.log(`[scrape/revalidate] Revalidated paths & tags for /dashboard, /contests, contestId=${contestId || 'all'}`);
    return NextResponse.json({ ok: true, revalidated: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
