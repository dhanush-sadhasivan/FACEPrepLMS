import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { recordITAttendance } from '@/lib/it-day-counter';
import { NextResponse } from 'next/server';

// GET /api/internal-training/redirect?dqId=<uuid>&url=<encoded_url>
// Server-side redirect that records the click server-side and then redirects to destination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dqId = searchParams.get('dqId');
  const targetUrl = searchParams.get('url');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && dqId) {
    const dbAdmin = getAdminClient();
    try {
      // 1. Record clicked_at
      const { data: existing } = await dbAdmin
        .from('it_question_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_question_id', dqId)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existing) {
        await dbAdmin
          .from('it_question_completions')
          .update({ clicked_at: now })
          .eq('id', existing.id);
      } else {
        await dbAdmin
          .from('it_question_completions')
          .insert({
            user_id: user.id,
            day_question_id: dqId,
            clicked_at: now,
            is_completed: false,
          });
      }

      // 2. Count IT day attendance
      await recordITAttendance(user.id, true);
    } catch (err) {
      console.error('Error recording click during redirect:', err);
    }
  }

  if (targetUrl) {
    try {
      const decoded = decodeURIComponent(targetUrl);
      return NextResponse.redirect(new URL(decoded, request.url));
    } catch {
      return NextResponse.redirect(new URL(targetUrl, request.url));
    }
  }

  return NextResponse.redirect(new URL('/internal-training', request.url));
}
