import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/trainer/todos — Fetch todos for the logged-in user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('trainer_todos')
    .select('*')
    .eq('user_id', user.id)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/trainer/todos — Create a new todo
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, task, description, priority, category, due_date } = body;
  const noteTitle = (title || task || '').trim();

  if (!noteTitle) {
    return NextResponse.json({ error: 'Note title or task content is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('trainer_todos')
    .insert({
      user_id: user.id,
      title: noteTitle,
      description: description?.trim() || null,
      priority: priority || 'medium',
      category: category || 'General',
      due_date: due_date || null,
      is_completed: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
