import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updatePayload: Record<string, any> = {};

  if (body.is_enabled !== undefined) {
    if (typeof body.is_enabled !== 'boolean') {
      return NextResponse.json({ error: 'is_enabled must be a boolean' }, { status: 400 });
    }
    updatePayload.is_enabled = body.is_enabled;
  }

  if (body.title !== undefined) {
    const cleanTitle = String(body.title).trim();
    if (!cleanTitle) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    updatePayload.title = cleanTitle;
  }

  if (body.domain !== undefined) {
    updatePayload.domain = String(body.domain).trim();
  }

  if (body.difficulty !== undefined) {
    if (!['Easy', 'Medium', 'Hard'].includes(body.difficulty)) {
      return NextResponse.json({ error: 'difficulty must be Easy, Medium, or Hard' }, { status: 400 });
    }
    updatePayload.difficulty = body.difficulty;
  }

  if (body.max_score !== undefined) {
    const score = Number(body.max_score);
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: 'max_score must be a positive number' }, { status: 400 });
    }
    updatePayload.max_score = score;
  }

  if (body.order_index !== undefined) {
    const idx = Number(body.order_index);
    if (Number.isInteger(idx) && idx >= 0) {
      updatePayload.order_index = idx;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid updatable fields provided' }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();

  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`[PATCH /api/questions/${id}] Error: ${error.message}`);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }

  if (question?.contest_id) {
    try {
      await generateAndUploadCdnSnapshots(question.contest_id);
    } catch (cdnErr) {
      console.warn(`[PATCH /api/questions/${id}] CDN snapshot error:`, cdnErr);
    }
    revalidatePath(`/contests/${question.contest_id}`);
    revalidateTag(`contest-${question.contest_id}`, 'max');
  }
  revalidatePath('/contests');
  revalidatePath('/dashboard');
  revalidateTag('contests', 'max');
  revalidateTag('leaderboard', 'max');
  revalidateTag('global-stats', 'max');

  console.log(`[PATCH /api/questions/${id}] Updated fields: ${Object.keys(updatePayload).join(', ')}`);
  return NextResponse.json({ success: true, question });
}
