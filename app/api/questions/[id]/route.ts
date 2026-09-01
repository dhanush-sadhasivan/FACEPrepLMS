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
  const { is_enabled } = body;

  if (is_enabled === undefined || typeof is_enabled !== 'boolean') {
    return NextResponse.json({ error: 'is_enabled (boolean) is required' }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();

  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .update({ is_enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`[PATCH /api/questions/${id}] Error: ${error.message}`);
    if (error.message.includes("is_enabled") || error.message.includes("schema cache")) {
      return NextResponse.json({
        error: "Missing Database Column: Please run 'ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;' in Supabase SQL Editor."
      }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  console.log(`[PATCH /api/questions/${id}] Updated is_enabled=${is_enabled}`);
  return NextResponse.json({ success: true, question });
}
