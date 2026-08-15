import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { userIds } = await req.json();

  if (!Array.isArray(userIds)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const inserts = userIds.map((userId: string) => ({ group_id: groupId, user_id: userId }));
  const { error } = await supabase.from('group_members').insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { userId } = await req.json();

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
