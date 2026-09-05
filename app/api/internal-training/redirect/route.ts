import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { isSafeRedirectUrl } from '@/lib/security';
import { NextResponse } from 'next/server';

// GET /api/internal-training/redirect?dqId=<uuid>&url=<encoded_url>
// Server-side redirect that records the click server-side and then redirects to destination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dqId = searchParams.get('dqId');
  const rawTargetUrl = searchParams.get('url');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
  }

  let validatedDestination: string | null = null;

  if (rawTargetUrl) {
    let decoded = rawTargetUrl;
    try {
      decoded = decodeURIComponent(rawTargetUrl);
    } catch {
      decoded = rawTargetUrl;
    }

    if (!isSafeRedirectUrl(decoded)) {
      return NextResponse.json(
        { error: 'Invalid or prohibited redirect URL: URL violates SSRF / security allowlist policies.' },
        { status: 400 }
      );
    }

    validatedDestination = decoded;
  }

  if (dqId) {
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

      // Note: IT attendance is no longer auto-recorded on redirect.
      // Trainers must explicitly check in per-roadmap.
    } catch (err) {
      console.error('Error recording click during redirect:', err);
    }
  }

  if (validatedDestination) {
    try {
      return NextResponse.redirect(new URL(validatedDestination, request.url));
    } catch {
      return NextResponse.redirect(new URL('/internal-training', request.url));
    }
  }

  return NextResponse.redirect(new URL('/internal-training', request.url));
}
