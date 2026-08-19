import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/admin/questions — Fetch all questions across contests for roadmaps & day plans
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const contestId = searchParams.get('contestId');

  const dbAdmin = getAdminClient();
  let query = dbAdmin
    .from('questions')
    .select('id, contest_id, title, slug, domain, difficulty, max_score, hackerrank_url, order_index, contests(title)')
    .order('order_index', { ascending: true });

  if (contestId) {
    query = query.eq('contest_id', contestId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatted = (data || []).map((q: any) => ({
    id: q.id,
    contest_id: q.contest_id,
    contest_title: q.contests?.title || 'Contest',
    title: q.title,
    slug: q.slug,
    domain: q.domain || 'General',
    difficulty: q.difficulty || 'Easy',
    max_score: q.max_score || 10,
    hackerrank_url: q.hackerrank_url,
  }));

  return NextResponse.json({ questions: formatted });
}
