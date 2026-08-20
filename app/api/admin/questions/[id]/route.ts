import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PATCH /api/admin/questions/[id] — Update question topic or details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin or manager role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updatePayload: Record<string, any> = {};
  if (body.topic !== undefined) updatePayload.topic = body.topic ? body.topic.trim() : null;
  if (body.title !== undefined) updatePayload.title = body.title.trim();
  if (body.difficulty !== undefined) updatePayload.difficulty = body.difficulty;
  if (body.domain !== undefined) updatePayload.domain = body.domain ? body.domain.trim() : 'General';

  const { data, error } = await supabase
    .from('questions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
