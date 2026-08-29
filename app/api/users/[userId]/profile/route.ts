import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;

  // Fetch viewer role
  const { data: viewer } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const viewerRole = viewer?.role ?? 'trainer';

  // Trainers can only view their own profile
  if (viewerRole === 'trainer' && userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbAdmin = getAdminClient();
  const { data, error } = await dbAdmin.rpc('get_user_performance_profile', {
    target_user_id: userId,
  });

  if (error) {
    console.error('[profile/route] RPC error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || (data as any).error) {
    return NextResponse.json({ error: (data as any)?.error || 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ ...data, viewerRole });
}