import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// POST /api/internal-training/question-click
// Records that the trainer clicked the question link from the webapp (portal-click confirmation)
// Does NOT auto-register IT attendance — trainer must use the explicit check-in button
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dayQuestionId } = await request.json();

  if (!dayQuestionId) {
    return NextResponse.json({ error: 'dayQuestionId is required' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();

  // Record clicked_at in it_question_completions
  const { data: existing } = await dbAdmin
    .from('it_question_completions')
    .select('*')
    .eq('user_id', user.id)
    .eq('day_question_id', dayQuestionId)
    .maybeSingle();

  if (existing) {
    await dbAdmin
      .from('it_question_completions')
      .update({
        clicked_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await dbAdmin
      .from('it_question_completions')
      .insert({
        user_id: user.id,
        day_question_id: dayQuestionId,
        clicked_at: new Date().toISOString(),
        is_completed: false,
      });
  }

  return NextResponse.json({
    success: true,
    dayQuestionId,
  });
}
