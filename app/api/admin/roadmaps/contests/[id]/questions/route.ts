import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/roadmaps/contests/[id]/questions — Fetch contest & scraped questions for roadmap creator
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: contestId } = await params;

  // Fetch contest details and associated questions
  const [contestRes, questionsRes, assignmentsRes] = await Promise.all([
    supabase.from('contests').select('*').eq('id', contestId).single(),
    supabase.from('questions').select('*').eq('contest_id', contestId).order('order_index', { ascending: true }),
    supabase.from('contest_assignments').select('*, group:groups(id, name)').eq('contest_id', contestId),
  ]);

  if (contestRes.error) {
    return NextResponse.json({ error: contestRes.error.message }, { status: 404 });
  }

  return NextResponse.json({
    contest: contestRes.data,
    questions: questionsRes.data || [],
    assignments: assignmentsRes.data || [],
  });
}
