import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// POST /api/internal-training/question-complete
// Toggles completion status for a question (manual check for custom questions or override)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dayQuestionId, isCompleted } = await request.json();

  if (!dayQuestionId) {
    return NextResponse.json({ error: 'dayQuestionId is required' }, { status: 400 });
  }

  const dbAdmin = getAdminClient();
  const completed = Boolean(isCompleted);
  const now = new Date().toISOString();

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
        is_completed: completed,
        completed_at: completed ? now : null,
        clicked_at: existing.clicked_at || (completed ? now : null),
      })
      .eq('id', existing.id);
  } else {
    await dbAdmin
      .from('it_question_completions')
      .insert({
        user_id: user.id,
        day_question_id: dayQuestionId,
        is_completed: completed,
        completed_at: completed ? now : null,
        clicked_at: completed ? now : null,
      });
  }

  // Note: IT attendance is no longer auto-recorded here.
  // Trainers must explicitly check in per-roadmap via the Check-In button.

  return NextResponse.json({
    success: true,
    dayQuestionId,
    isCompleted: completed,
  });
}
