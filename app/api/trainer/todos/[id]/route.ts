import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PATCH /api/trainer/todos/[id] — Update (toggle complete, edit fields)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Build update payload - only allow valid fields
  const updates: Record<string, unknown> = {};
  if ('is_completed' in body) {
    updates.is_completed = body.is_completed;
    updates.completed_at = body.is_completed ? new Date().toISOString() : null;
  }
  if ('title' in body) updates.title = body.title?.trim();
  if ('description' in body) updates.description = body.description?.trim() || null;
  if ('priority' in body) updates.priority = body.priority;
  if ('category' in body) updates.category = body.category;
  if ('due_date' in body) updates.due_date = body.due_date || null;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('trainer_todos')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id) // RLS: user can only update their own
    .select()
    .single();

  if (error) {
    console.error(`[PATCH /api/trainer/todos/${id}] DB error:`, error.message);
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/trainer/todos/[id] — Delete a todo
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from('trainer_todos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error(`[DELETE /api/trainer/todos/${id}] DB error:`, error.message);
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
