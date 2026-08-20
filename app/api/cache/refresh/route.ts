import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';
import { revalidateTag, revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow service key via header OR authenticated admin/manager
  const authHeader = req.headers.get('authorization') || '';
  const apiKey = req.headers.get('x-api-key') || '';
  const isInternal = apiKey === process.env.RAILWAY_API_KEY || authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___none___');

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

  // Invalidate Next.js cache tags
  revalidateTag('leaderboard', 'max');
  revalidateTag('global-stats', 'max');
  revalidatePath('/dashboard');
  if (contestId) {
    revalidateTag(`contest-${contestId}`, 'max');
    revalidatePath(`/contests/${contestId}`);
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
