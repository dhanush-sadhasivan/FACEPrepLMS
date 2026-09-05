import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { name } = await req.json();
  const { data, error } = await supabase.from('groups').update({ name }).eq('id', id).select().single();
  if (error) {
    console.error(`[PATCH /api/groups/${id}] DB error:`, error.message);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin' && caller?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) {
    console.error(`[DELETE /api/groups/${id}] DB error:`, error.message);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
