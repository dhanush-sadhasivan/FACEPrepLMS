import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { safeTimingCompare } from '@/lib/security';
import { revalidateTag, revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow service key via header OR authenticated admin/manager
  const authHeader = req.headers.get('authorization') || '';
  const apiKey = req.headers.get('x-api-key') || '';
  const railwayApiKey = process.env.RAILWAY_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const matchesRailwayKey = Boolean(railwayApiKey && apiKey && safeTimingCompare(apiKey, railwayApiKey));
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const matchesServiceRole = Boolean(serviceRoleKey && bearerToken && safeTimingCompare(bearerToken, serviceRoleKey));
  const isInternal = matchesRailwayKey || matchesServiceRole;

  if (!isInternal) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const contestId = searchParams.get('contestId') || undefined;

  const result = await generateAndUploadCdnSnapshots(contestId);

  // Invalidate Next.js cache tags and paths
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
    revalidateTag(`contest-${contestId}`, 'max');
    revalidatePath(`/contests/${contestId}`);
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
