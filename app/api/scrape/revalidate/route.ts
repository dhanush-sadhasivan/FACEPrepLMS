import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(req: Request) {
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
