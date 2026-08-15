import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

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
  const { title, hackerrank_slug, start_date, end_date, groups, teams } = body;

  const supabaseAdmin = getAdminClient();

  // 1. Update contest details
  const updatePayload: Record<string, any> = {};
  if (title !== undefined) updatePayload.title = title;
  if (hackerrank_slug !== undefined) updatePayload.hackerrank_slug = hackerrank_slug;
  if (start_date !== undefined) updatePayload.start_date = start_date;
  if (end_date !== undefined) updatePayload.end_date = end_date;

  const { data: contest, error: contestError } = await supabaseAdmin
    .from('contests')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (contestError) return NextResponse.json({ error: contestError.message }, { status: 500 });

  // 2. Update assignments if groups or teams are provided
  if (Array.isArray(groups) || Array.isArray(teams)) {
    // Delete existing assignments
    const { error: deleteAssignError } = await supabaseAdmin
      .from('contest_assignments')
      .delete()
      .eq('contest_id', id);

    if (deleteAssignError) {
      console.error(`[contests/${id}] Failed to clear old assignments: ${deleteAssignError.message}`);
    }

    const assignmentRows: Array<{ contest_id: string; group_id: string | null; team: string | null }> = [];

    if (Array.isArray(groups)) {
      groups.forEach((groupId: string) => {
        if (groupId) assignmentRows.push({ contest_id: id, group_id: groupId, team: null });
      });
    }

    if (Array.isArray(teams)) {
      teams.forEach((teamName: string) => {
        if (teamName) assignmentRows.push({ contest_id: id, group_id: null, team: teamName });
      });
    }

    if (assignmentRows.length > 0) {
      const { error: insertAssignError } = await supabaseAdmin
        .from('contest_assignments')
        .insert(assignmentRows);

      if (insertAssignError) {
        console.error(`[contests/${id}] Failed to insert assignments: ${insertAssignError.message}`);
        return NextResponse.json({ error: `Failed to update assignments: ${insertAssignError.message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true, contest });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify role
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabaseAdmin = getAdminClient();

  // Verify contest exists
  const { data: contest, error: contestError } = await supabaseAdmin
    .from('contests')
    .select('id, hackerrank_slug')
    .eq('id', id)
    .single();

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
  }

  const body = await request.json();
  const { questions } = body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
  }

  console.log(`[contests/${id}] Re-scraping: inserting ${questions.length} questions`);

  // Delete existing questions for this contest
  const { error: deleteError } = await supabaseAdmin
    .from('questions')
    .delete()
    .eq('contest_id', id);

  if (deleteError) {
    console.error(`[contests/${id}] Failed to delete old questions: ${deleteError.message}`);
    return NextResponse.json({ error: `Failed to clear old questions: ${deleteError.message}` }, { status: 500 });
  }

  // Insert new questions
  const questionsData = questions.map((q: any, idx: number) => ({
    contest_id: id,
    slug: q.slug || `q-${idx}`,
    title: q.title || 'Untitled Problem',
    domain: q.domain || 'General',
    hackerrank_url: q.hackerrank_url || `https://www.hackerrank.com/contests/${contest.hackerrank_slug}/challenges/${q.slug}`,
    difficulty: q.difficulty || 'Medium',
    max_score: q.max_score ?? 10,
    order_index: idx,
  }));

  const { error: insertError } = await supabaseAdmin.from('questions').insert(questionsData);

  if (insertError) {
    console.error(`[contests/${id}] Failed to insert questions: ${insertError.message}`);
    return NextResponse.json({ error: `Failed to insert questions: ${insertError.message}` }, { status: 500 });
  }

  console.log(`[contests/${id}] Successfully inserted ${questionsData.length} questions`);
  return NextResponse.json({ success: true, count: questionsData.length });
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin.from('contests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
