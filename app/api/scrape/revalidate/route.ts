import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contestId = searchParams.get('contestId');

    revalidatePath('/dashboard');
    revalidatePath('/contests');
    if (contestId) {
      revalidatePath(`/contests/${contestId}`);
    }

    console.log(`[scrape/revalidate] Revalidated /dashboard, /contests, and contestId=${contestId || 'all'}`);
    return NextResponse.json({ ok: true, revalidated: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
