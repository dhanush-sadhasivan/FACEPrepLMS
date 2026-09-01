import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = process.env.RAILWAY_API_KEY;
  
  if (apiKey && expectedKey && apiKey === expectedKey) {
    // Service call from scraper — proceed
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

    // 1. Regenerate CDN snapshot from fresh DB data so the next page render
    //    sees up-to-date leaderboard regardless of when Supabase Storage CDN
    //    expires its own edge cache.
    try {
      await generateAndUploadCdnSnapshots(contestId || undefined);
      console.log(`[scrape/revalidate] CDN snapshot regenerated (contestId=${contestId || 'global only'})`);
    } catch (cdnErr: any) {
      console.warn(`[scrape/revalidate] CDN regeneration failed (non-fatal): ${cdnErr.message}`);
    }

    // 2. Bust Next.js data cache so even cached page renders get fresh data
    revalidatePath('/dashboard');
    revalidatePath('/contests');
    revalidatePath('/roadmaps');
    revalidatePath('/reports');
    revalidatePath('/internal-training');

    revalidateTag('leaderboard', 'max');
    revalidateTag('global-stats', 'max');
    revalidateTag('contests', 'max');
    revalidateTag('roadmaps', 'max');
    revalidateTag('roadmap-analytics', 'max');
    revalidateTag('internal-training', 'max');
    revalidateTag('it-overview', 'max');

    if (contestId) {
      revalidatePath(`/contests/${contestId}`);
      revalidateTag(`contest-${contestId}`, 'max');
    }

    console.log(`[scrape/revalidate] Revalidated paths & tags for /dashboard, /contests, /roadmaps, /reports, /internal-training, contestId=${contestId || 'all'}`);
    return NextResponse.json({ ok: true, revalidated: true, cdnRefreshed: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
