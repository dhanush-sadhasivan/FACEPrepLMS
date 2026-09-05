import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error(`[PATCH /api/notifications/${id}/read] Error:`, error.message);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
